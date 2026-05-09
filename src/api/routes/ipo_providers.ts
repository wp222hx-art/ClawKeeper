// file: src/api/routes/ipo_providers.ts
// description: IPOPilot AI Provider configuration routes — list / register /
//              health-check / set-default. Phase 1 stores credentials in-memory
//              (registry) and as plaintext rows in ipo_ai_providers; Phase 2
//              will move secrets into a KMS-backed secret store.
// reference: src/ipo/llm/registry.ts, db/ipo_schema.sql (ipo_ai_providers)

import { Hono } from 'hono';
import { z } from 'zod';
import type { Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import { llm_provider_registry } from '../../ipo/llm/registry';

// Phase 1 only supports the 4 codes wired in src/ipo/llm/*. Additional codes
// (AZURE_OPENAI, GOOGLE_GEMINI, CUSTOM) are reserved in the DB enum but not
// yet implemented in the provider abstraction.
const ImplementedProviderCodeSchema = z.enum(['TOKENHOT', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK']);

const RegisterProviderSchema = z.object({
  code: ImplementedProviderCodeSchema,
  api_key: z.string().min(8),
  base_url: z.string().url().optional(),
  default_chat_model: z.string().optional(),
  default_embedding_model: z.string().optional(),
  display_name: z.string().optional(),
  make_default: z.boolean().optional(),
  persist: z.boolean().optional(),  // when true, also write to ipo_ai_providers
});

const SetDefaultSchema = z.object({ code: ImplementedProviderCodeSchema });

export function create_ipo_provider_routes(sql: Sql<Record<string, unknown>>) {
  const app = new Hono<AppEnv>();

  // GET /api/ipo/providers — list providers (status only, no api keys)
  app.get('/', async (c) => {
    const tenant_id = c.get('tenant_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    const live = llm_provider_registry.list_status();
    let persisted: Array<Record<string, unknown>> = [];
    try {
      persisted = await sql`
        SELECT id, code, display_name, base_url, default_chat_model,
               default_embedding_model, is_default, status, last_health_check_at,
               created_at, updated_at
        FROM ipo_ai_providers
        WHERE tenant_id = ${tenant_id}
        ORDER BY created_at DESC
      `;
    } catch {
      // Table may not exist yet in some environments; surface live entries only.
    }
    return c.json({
      live,
      persisted,
      configured: llm_provider_registry.is_configured(),
    });
  });

  // POST /api/ipo/providers — register a provider (and optionally persist)
  app.post('/', async (c) => {
    const tenant_id = c.get('tenant_id');
    const user_id = c.get('user_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    let body: unknown;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = RegisterProviderSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 422);
    const input = parsed.data;

    try {
      llm_provider_registry.register(
        {
          code: input.code,
          api_key: input.api_key,
          base_url: input.base_url,
          default_chat_model: input.default_chat_model,
          default_embedding_model: input.default_embedding_model,
          display_name: input.display_name,
        },
        { make_default: input.make_default ?? false },
      );

      if (input.persist) {
        await sql`
          INSERT INTO ipo_ai_providers (
            tenant_id, code, display_name, base_url, default_chat_model,
            default_embedding_model, api_key_ciphertext, is_default,
            status, created_by_user_id, created_at, updated_at
          ) VALUES (
            ${tenant_id}, ${input.code}, ${input.display_name ?? input.code},
            ${input.base_url ?? null}, ${input.default_chat_model ?? null},
            ${input.default_embedding_model ?? null},
            ${input.api_key},
            ${input.make_default ?? false},
            'ACTIVE', ${user_id}, NOW(), NOW()
          )
          ON CONFLICT (tenant_id, code) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                base_url = EXCLUDED.base_url,
                default_chat_model = EXCLUDED.default_chat_model,
                default_embedding_model = EXCLUDED.default_embedding_model,
                api_key_ciphertext = EXCLUDED.api_key_ciphertext,
                is_default = EXCLUDED.is_default,
                updated_at = NOW()
        `;
      }

      return c.json({
        ok: true,
        provider: input.code,
        is_default: input.make_default ?? false,
        live: llm_provider_registry.list_status(),
      });
    } catch (e) {
      console.error('[ipo/providers POST] error:', e);
      return c.json({ error: 'Failed to register provider', detail: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // POST /api/ipo/providers/default — set default provider
  app.post('/default', async (c) => {
    const tenant_id = c.get('tenant_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    let body: unknown;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = SetDefaultSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation failed' }, 422);
    try {
      llm_provider_registry.set_default(parsed.data.code);
      return c.json({ ok: true, default_provider: parsed.data.code });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  // POST /api/ipo/providers/health — health-check all configured providers
  app.post('/health', async (c) => {
    const tenant_id = c.get('tenant_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    const result = await llm_provider_registry.health_check_all();
    return c.json({ checked_at: new Date().toISOString(), results: result });
  });

  return app;
}
