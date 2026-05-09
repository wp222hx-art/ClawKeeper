// file: src/api/routes/ipo_regulations.ts
// description: IPOPilot regulation registry + RAG search routes.
//              In Phase 1, search is text-only (LIKE / full-text); the pgvector
//              path is wired but only activated when an embedding-capable
//              provider is configured.
// reference: db/ipo_schema.sql (ipo_regulations, ipo_regulation_chunks),
//            src/ipo/llm/registry.ts

import { Hono } from 'hono';
import { z } from 'zod';
import type { Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import { llm_provider_registry } from '../../ipo/llm/registry';

const SearchSchema = z.object({
  query: z.string().min(2).max(500),
  jurisdiction: z.enum(['US', 'HK', 'INTL']).optional(),
  industry_filter: z.enum(['SAAS', 'BIOPHARMA', 'CLEAN_ENERGY', 'OTHER']).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export function create_ipo_regulation_routes(sql: Sql<Record<string, unknown>>) {
  const app = new Hono<AppEnv>();

  // GET /api/ipo/regulations — list regulation registry
  app.get('/', async (c) => {
    const jurisdiction = c.req.query('jurisdiction');
    try {
      const rows = jurisdiction
        ? await sql`SELECT id, code, title, jurisdiction, authority, version,
                           effective_date, source_url, summary, tags
                    FROM ipo_regulations
                    WHERE jurisdiction = ${jurisdiction}
                    ORDER BY authority, code LIMIT 500`
        : await sql`SELECT id, code, title, jurisdiction, authority, version,
                           effective_date, source_url, summary, tags
                    FROM ipo_regulations
                    ORDER BY jurisdiction, authority, code LIMIT 500`;
      return c.json({ regulations: rows, count: rows.length });
    } catch (e) {
      console.error('[ipo/regulations GET] error:', e);
      return c.json({ error: 'Failed to list regulations' }, 500);
    }
  });

  // POST /api/ipo/regulations/search — RAG search (text or vector when available)
  app.post('/search', async (c) => {
    let body: unknown;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = SearchSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 422);
    const input = parsed.data;

    try {
      // Try vector path if an embedding-capable provider is configured.
      let strategy: 'vector' | 'text' = 'text';
      let chunks: Array<Record<string, unknown>> = [];

      if (llm_provider_registry.is_configured()) {
        const default_provider = (() => {
          try { return llm_provider_registry.get_default(); } catch { return null; }
        })();

        if (default_provider && default_provider.default_embedding_model) {
          try {
            const embed = await default_provider.embed({
              model: default_provider.default_embedding_model,
              input: input.query,
            });
            const vec = embed.embeddings[0];
            if (vec && vec.length === 1536) {
              strategy = 'vector';
              const vec_literal = `[${vec.join(',')}]`;
              chunks = input.jurisdiction
                ? await sql`
                    SELECT c.id, c.regulation_id, c.section, c.heading, c.content,
                           1 - (c.embedding <=> ${vec_literal}::vector) AS score,
                           r.code, r.title, r.jurisdiction, r.authority, r.source_url
                    FROM ipo_regulation_chunks c
                    JOIN ipo_regulations r ON r.id = c.regulation_id
                    WHERE r.jurisdiction = ${input.jurisdiction}
                      AND c.embedding IS NOT NULL
                    ORDER BY c.embedding <=> ${vec_literal}::vector ASC
                    LIMIT ${input.limit}
                  `
                : await sql`
                    SELECT c.id, c.regulation_id, c.section, c.heading, c.content,
                           1 - (c.embedding <=> ${vec_literal}::vector) AS score,
                           r.code, r.title, r.jurisdiction, r.authority, r.source_url
                    FROM ipo_regulation_chunks c
                    JOIN ipo_regulations r ON r.id = c.regulation_id
                    WHERE c.embedding IS NOT NULL
                    ORDER BY c.embedding <=> ${vec_literal}::vector ASC
                    LIMIT ${input.limit}
                  `;
            }
          } catch (e) {
            console.warn('[ipo/regulations/search] vector path failed, falling back to text:', e);
          }
        }
      }

      if (strategy === 'text') {
        const like_q = `%${input.query.replace(/[%_]/g, ' ')}%`;
        chunks = input.jurisdiction
          ? await sql`
              SELECT c.id, c.regulation_id, c.section, c.heading, c.content,
                     0.0 AS score,
                     r.code, r.title, r.jurisdiction, r.authority, r.source_url
              FROM ipo_regulation_chunks c
              JOIN ipo_regulations r ON r.id = c.regulation_id
              WHERE r.jurisdiction = ${input.jurisdiction}
                AND (c.content ILIKE ${like_q} OR c.heading ILIKE ${like_q})
              LIMIT ${input.limit}
            `
          : await sql`
              SELECT c.id, c.regulation_id, c.section, c.heading, c.content,
                     0.0 AS score,
                     r.code, r.title, r.jurisdiction, r.authority, r.source_url
              FROM ipo_regulation_chunks c
              JOIN ipo_regulations r ON r.id = c.regulation_id
              WHERE c.content ILIKE ${like_q} OR c.heading ILIKE ${like_q}
              LIMIT ${input.limit}
            `;
      }

      return c.json({
        strategy,
        query: input.query,
        results: chunks,
        count: chunks.length,
      });
    } catch (e) {
      console.error('[ipo/regulations/search POST] error:', e);
      return c.json({ error: 'Search failed' }, 500);
    }
  });

  // GET /api/ipo/regulations/:id — single regulation + its chunks
  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    try {
      const reg_rows = await sql`SELECT * FROM ipo_regulations WHERE id = ${id} LIMIT 1`;
      if (reg_rows.length === 0) return c.json({ error: 'Not found' }, 404);
      const chunks = await sql`
        SELECT id, section, heading, content, ordinal
        FROM ipo_regulation_chunks
        WHERE regulation_id = ${id}
        ORDER BY ordinal ASC
        LIMIT 500
      `;
      return c.json({ regulation: reg_rows[0], chunks });
    } catch (e) {
      console.error('[ipo/regulations/:id GET] error:', e);
      return c.json({ error: 'Failed to fetch regulation' }, 500);
    }
  });

  return app;
}
