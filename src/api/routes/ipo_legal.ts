// file: src/api/routes/ipo_legal.ts
// description: Global Finance Law knowledge-base ingestion + browse routes.
//              Powers the `ipo_global_finance_law_agent`. Uses the active
//              LLM provider (per llm_provider_registry.get_default()) to
//              (1) discover candidate legal sources for a topic + jurisdiction
//              set, (2) classify each as STATUTE / REGULATOR_RULE / GUIDANCE
//              / CASE_LAW / MARKET_PRACTICE, (3) extract citation triple, and
//              optionally (4) embed chunks into ipo_regulation_chunks tagged
//              metadata.domain = 'GLOBAL_FINANCE_LAW'.
// reference: src/ipo/orchestration/agent_registry.ts (ipo_global_finance_law_agent),
//            src/ipo/llm/registry.ts, db/ipo_schema.sql

import { Hono } from 'hono';
import { z } from 'zod';
import type { Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import { llm_provider_registry } from '../../ipo/llm/registry';
import { get_ipo_agent } from '../../ipo/orchestration/agent_registry';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const DiscoverSchema = z.object({
  topic: z.string().min(3).max(500),
  jurisdictions: z.array(z.string().min(2).max(20)).min(1).max(11),
  max_sources: z.number().int().min(1).max(20).default(8),
  // When true, the discovered sources are also written into ipo_regulations
  // with metadata.domain='GLOBAL_FINANCE_LAW'. When false, the route only
  // returns the discovered list (dry-run).
  persist: z.boolean().default(false),
  // When true and an embedding-capable provider is configured, each persisted
  // regulation is chunked from its summary text and embedded.
  embed: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Types for the LLM-curated discovery payload
// ---------------------------------------------------------------------------

type LegalSourceClass =
  | 'STATUTE'
  | 'REGULATOR_RULE'
  | 'GUIDANCE'
  | 'CASE_LAW'
  | 'MARKET_PRACTICE';

interface DiscoveredLegalSource {
  class: LegalSourceClass;
  jurisdiction: string;          // matches knowledge_acquisition.jurisdictions
  authority: string;             // e.g. 'SEC', 'HKEX', 'SFC', 'FCA'
  code: string;                  // e.g. 'Reg S-K Item 105', 'Listing Rule 14A.07'
  title: string;                 // human-readable title
  source_url: string | null;
  effective_year: number | null;
  summary: string;               // 1-3 paragraphs, citation-anchored
  in_scope_reason: string;       // why this fits the legal agent's scope_in
}

interface DiscoveryResult {
  topic: string;
  jurisdictions: string[];
  sources: DiscoveredLegalSource[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// LLM prompting — discovery + classification in a single call
// ---------------------------------------------------------------------------

function build_discovery_messages(
  topic: string,
  jurisdictions: string[],
  scope_in: string[],
  scope_out: string[],
  max_sources: number,
) {
  const sys = `You are the Global Finance Law agent inside IPOPilot, an IPO advisory co-pilot.
Your single job is to surface authoritative legal sources for a given topic across multiple listing jurisdictions.

STRICT SCOPE — IN:
${scope_in.map(s => `  - ${s}`).join('\n')}

STRICT SCOPE — OUT (REFUSE these):
${scope_out.map(s => `  - ${s}`).join('\n')}

TASK: For the user's TOPIC and JURISDICTION SET, return up to ${max_sources} authoritative legal sources.
For each source provide:
  - class: one of STATUTE | REGULATOR_RULE | GUIDANCE | CASE_LAW | MARKET_PRACTICE
  - jurisdiction: one of the requested codes (US_SEC, US_PCAOB, HK_HKEX, HK_SFC, EU, UK_FCA, SG_SGX, JP_FSA, PRC_CSRC, CAYMAN, BVI)
  - authority: the issuing body (e.g. 'SEC', 'HKEX', 'SFC', 'FCA', 'CSRC')
  - code: the formal citation token (e.g. 'Reg S-K Item 105', 'Listing Rule 14A.07', 'Prospectus Regulation Art 8')
  - title: human-readable name
  - source_url: official URL when known, else null
  - effective_year: 4-digit year, or null
  - summary: 1-3 short paragraphs explaining what the source says, with the citation woven in
  - in_scope_reason: ONE SHORT SENTENCE explaining which scope_in bucket this belongs to

OUTPUT CONTRACT:
Return a single JSON object, no prose, matching:
{
  "topic": string,
  "jurisdictions": string[],
  "sources": Source[],
  "warnings": string[]
}
If a requested jurisdiction has no relevant authoritative source, OMIT it from sources and add an entry to warnings.
NEVER fabricate URLs — when uncertain, set source_url to null.
NEVER include sources outside the IN scope. If the topic is entirely OUT-of-scope, return an empty sources[] and a single warning.`;

  const usr = `TOPIC: ${topic}
JURISDICTION SET: ${jurisdictions.join(', ')}
MAX SOURCES: ${max_sources}

Return the JSON object now.`;

  return [
    { role: 'system' as const, content: sys },
    { role: 'user' as const, content: usr },
  ];
}

function parse_discovery_response(raw: string, topic: string, jurisdictions: string[]): DiscoveryResult {
  // Tolerate models that wrap JSON in ``` fences or add a leading prose line.
  const cleaned = raw
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/i, '')
    .trim();

  let payload: unknown;
  try {
    payload = JSON.parse(cleaned);
  } catch {
    // Last-ditch: find the first { ... } block.
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) {
      return { topic, jurisdictions, sources: [], warnings: ['LLM returned non-JSON output.'] };
    }
    try { payload = JSON.parse(m[0]); }
    catch { return { topic, jurisdictions, sources: [], warnings: ['LLM JSON unparseable.'] }; }
  }

  const obj = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
  const sources_raw = Array.isArray(obj.sources) ? obj.sources : [];
  const warnings = Array.isArray(obj.warnings) ? obj.warnings.filter((w): w is string => typeof w === 'string') : [];

  const sources: DiscoveredLegalSource[] = [];
  for (const s of sources_raw) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const cls = String(r.class ?? '').toUpperCase() as LegalSourceClass;
    if (!['STATUTE', 'REGULATOR_RULE', 'GUIDANCE', 'CASE_LAW', 'MARKET_PRACTICE'].includes(cls)) continue;
    sources.push({
      class: cls,
      jurisdiction: String(r.jurisdiction ?? '').trim(),
      authority: String(r.authority ?? '').trim(),
      code: String(r.code ?? '').trim(),
      title: String(r.title ?? '').trim(),
      source_url: typeof r.source_url === 'string' && r.source_url ? r.source_url : null,
      effective_year: typeof r.effective_year === 'number' ? r.effective_year : null,
      summary: String(r.summary ?? '').trim(),
      in_scope_reason: String(r.in_scope_reason ?? '').trim(),
    });
  }

  return { topic, jurisdictions, sources, warnings };
}

// ---------------------------------------------------------------------------
// Persistence: maps a DiscoveredLegalSource → ipo_regulations row.
// jurisdiction needs to land in the ipo_regulations enum
// (SEC | HKEX | PCAOB | FASB | IASB | IRS | IRD_HK | NASDAQ | NYSE | CSRC | SGX | OTHER)
// — anything else falls through to OTHER, with the original code preserved in metadata.
// ---------------------------------------------------------------------------
function map_jurisdiction_to_db(j: string): string {
  const u = j.toUpperCase();
  if (u.startsWith('US_SEC') || u === 'SEC') return 'SEC';
  if (u.startsWith('US_PCAOB') || u === 'PCAOB') return 'PCAOB';
  if (u.startsWith('HK_HKEX') || u === 'HKEX') return 'HKEX';
  if (u.startsWith('SG_SGX') || u === 'SGX') return 'SGX';
  if (u.startsWith('PRC_CSRC') || u === 'CSRC') return 'CSRC';
  return 'OTHER';
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export function create_ipo_legal_routes(sql: Sql<Record<string, unknown>>) {
  const app = new Hono<AppEnv>();

  // GET /api/ipo/legal/agent — surface the legal agent's manifest
  // (jurisdictions, scope_in, scope_out, content-acquisition contract).
  app.get('/agent', (c) => {
    const def = get_ipo_agent('ipo_global_finance_law_agent');
    if (!def) return c.json({ error: 'Legal agent not registered' }, 500);
    return c.json({
      id: def.id,
      display_name: def.display_name,
      display_name_zh: def.display_name_zh,
      tier: def.tier,
      category: def.category,
      description: def.description,
      description_zh: def.description_zh,
      capabilities: def.capabilities,
      citation_required: def.citation_required,
      required_signoff_for_outputs: def.required_signoff_for_outputs ?? [],
      knowledge_acquisition: def.knowledge_acquisition ?? null,
    });
  });

  // GET /api/ipo/legal/kb — list ingested legal-domain regulations.
  app.get('/kb', async (c) => {
    const tenant_id = c.get('tenant_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const rows = await sql`
        SELECT id, jurisdiction, doc_type, title, section, version,
               effective_date, source_url, language, metadata
        FROM ipo_regulations
        WHERE metadata->>'domain' = 'GLOBAL_FINANCE_LAW'
        ORDER BY jurisdiction, doc_type, title
        LIMIT 500
      `;
      return c.json({ count: rows.length, regulations: rows });
    } catch (e) {
      console.error('[ipo/legal/kb GET] error:', e);
      return c.json({ error: 'Failed to list legal KB' }, 500);
    }
  });

  // POST /api/ipo/legal/ingest — drive a discovery + classification + (optional)
  // persistence run via the configured LLM provider.
  app.post('/ingest', async (c) => {
    const tenant_id = c.get('tenant_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = DiscoverSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 422);
    const input = parsed.data;

    // 1. Resolve the legal-agent manifest (scope_in / scope_out / jurisdictions)
    const def = get_ipo_agent('ipo_global_finance_law_agent');
    if (!def || !def.knowledge_acquisition) {
      return c.json({ error: 'Legal agent manifest missing' }, 500);
    }
    const ka = def.knowledge_acquisition;

    // Refuse jurisdictions outside the agent's declared coverage.
    const unknown_juris = input.jurisdictions.filter(j => !ka.jurisdictions.includes(j));
    if (unknown_juris.length > 0) {
      return c.json({
        error: 'Jurisdiction(s) outside agent coverage',
        unsupported: unknown_juris,
        supported: ka.jurisdictions,
      }, 422);
    }

    // 2. Resolve provider — discovery requires a chat-capable provider.
    if (!llm_provider_registry.is_configured()) {
      return c.json({
        error: 'No AI provider configured',
        hint: 'Register a provider via Settings → AI Providers before running legal ingest.',
      }, 412);
    }
    let provider;
    try { provider = llm_provider_registry.get_default(); }
    catch { return c.json({ error: 'No default AI provider' }, 412); }

    // 3. Run discovery
    const messages = build_discovery_messages(
      input.topic, input.jurisdictions, ka.scope_in, ka.scope_out, input.max_sources,
    );

    let llm_raw: string;
    let chat_usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    try {
      const resp = await provider.chat({
        model: provider.default_chat_model,
        messages,
        temperature: 0.1,
        max_tokens: 3500,
      });
      llm_raw = resp.content;
      chat_usage = resp.usage;
    } catch (e) {
      console.error('[ipo/legal/ingest] LLM chat failed:', e);
      return c.json({ error: 'LLM discovery failed', detail: String(e) }, 502);
    }

    const result = parse_discovery_response(llm_raw, input.topic, input.jurisdictions);

    // 4. Optional persistence — write each source to ipo_regulations with
    // metadata.domain='GLOBAL_FINANCE_LAW', then chunk-and-embed if requested.
    let persisted_ids: string[] = [];
    let embedded_chunks = 0;
    const persist_warnings: string[] = [];

    if (input.persist && result.sources.length > 0) {
      for (const src of result.sources) {
        try {
          const db_jurisdiction = map_jurisdiction_to_db(src.jurisdiction);
          const effective_date = src.effective_year ? `${src.effective_year}-01-01` : null;
          const metadata = {
            domain: 'GLOBAL_FINANCE_LAW',
            class: src.class,
            agent_id: def.id,
            ingest_topic: input.topic,
            requested_jurisdiction: src.jurisdiction,
            authority: src.authority,
            code: src.code,
            in_scope_reason: src.in_scope_reason,
            llm_curated: true,
            curated_by_provider: provider.code,
            curated_at: new Date().toISOString(),
          };

          const inserted = await sql`
            INSERT INTO ipo_regulations
              (jurisdiction, doc_type, title, section, effective_date,
               source_url, full_text, language, metadata)
            VALUES
              (${db_jurisdiction}, ${src.class}, ${src.title.slice(0, 500)},
               ${src.code.slice(0, 255)}, ${effective_date},
               ${src.source_url}, ${src.summary}, 'en', ${sql.json(metadata)})
            RETURNING id
          `;
          const reg_id = inserted[0]?.id as string | undefined;
          if (!reg_id) continue;
          persisted_ids.push(reg_id);

          // 5. Optional embedding step — only if embedding-capable provider.
          if (input.embed && provider.default_embedding_model && src.summary.length > 0) {
            try {
              const chunks = split_into_chunks(src.summary, 800);
              for (let i = 0; i < chunks.length; i++) {
                const chunk_text = chunks[i];
                const embed_resp = await provider.embed({
                  model: provider.default_embedding_model,
                  input: chunk_text,
                });
                const vec = embed_resp.embeddings[0];
                if (!vec || vec.length !== 1536) {
                  persist_warnings.push(
                    `Embedding dim mismatch for source ${src.code} chunk ${i} (got ${vec?.length}; expected 1536)`,
                  );
                  continue;
                }
                const vec_literal = `[${vec.join(',')}]`;
                await sql`
                  INSERT INTO ipo_regulation_chunks
                    (regulation_id, chunk_index, chunk_text, chunk_heading,
                     section_path, token_count, embedding, embedding_model, embedded_at, metadata)
                  VALUES
                    (${reg_id}, ${i}, ${chunk_text},
                     ${src.title.slice(0, 500)},
                     ${src.code.slice(0, 500)},
                     ${Math.ceil(chunk_text.length / 4)},
                     ${vec_literal}::vector,
                     ${provider.default_embedding_model},
                     NOW(),
                     ${sql.json({ class: src.class, domain: 'GLOBAL_FINANCE_LAW' })})
                `;
                embedded_chunks++;
              }
            } catch (e) {
              persist_warnings.push(`Embedding failed for ${src.code}: ${String(e)}`);
            }
          }
        } catch (e) {
          persist_warnings.push(`Persist failed for ${src.code}: ${String(e)}`);
        }
      }
    }

    return c.json({
      topic: result.topic,
      jurisdictions: result.jurisdictions,
      sources: result.sources,
      llm_warnings: result.warnings,
      persist: {
        enabled: input.persist,
        regulations_written: persisted_ids.length,
        regulation_ids: persisted_ids,
        embeddings_written: embedded_chunks,
        warnings: persist_warnings,
      },
      llm_provider: provider.code,
      llm_model: provider.default_chat_model,
      llm_usage: chat_usage,
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function split_into_chunks(text: string, target_chars: number): string[] {
  const cleaned = text.trim();
  if (cleaned.length <= target_chars) return [cleaned];
  const chunks: string[] = [];
  // Prefer paragraph boundaries first.
  const paragraphs = cleaned.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  let buf = '';
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > target_chars && buf.length > 0) {
      chunks.push(buf.trim());
      buf = '';
    }
    buf += (buf ? '\n\n' : '') + p;
    while (buf.length > target_chars * 1.4) {
      chunks.push(buf.slice(0, target_chars).trim());
      buf = buf.slice(target_chars);
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
