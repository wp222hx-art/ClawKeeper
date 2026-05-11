// file: src/api/routes/ipo_agents.ts
// description: IPOPilot agent catalog + execution routes — list agents, fetch
//              profile, fetch the AGENT.md + SKILL.md bundle, and (NEW) run
//              any agent against the configured LLM provider. When no provider
//              is configured the runner returns a deterministic dry-run so
//              every agent stays "runnable" end-to-end.
// reference: src/ipo/orchestration/ipo_orchestration_service.ts,
//            src/ipo/orchestration/agent_runner.ts,
//            src/ipo/orchestration/skill_loader.ts,
//            src/ipo/orchestration/agent_registry.ts

import { Hono } from 'hono';
import type { Sql as _Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import { ipo_orchestration_service } from '../../ipo/orchestration/ipo_orchestration_service';
import {
  agent_runner,
  AgentNotFoundError,
  InvalidPromptError,
  type AgentRunRequest,
} from '../../ipo/orchestration/agent_runner';
import { NotConfiguredError, ProviderError, type AiProviderCode } from '../../ipo/llm/provider';

export function create_ipo_agent_routes(_sql: _Sql<Record<string, unknown>>) {
  const app = new Hono<AppEnv>();

  // GET /api/ipo/agents — full catalog (optionally filtered by tier / category)
  app.get('/', (c) => {
    const tier = c.req.query('tier');
    const category = c.req.query('category');
    let catalog = ipo_orchestration_service.get_agent_catalog();
    if (tier) catalog = catalog.filter(a => a.tier === tier);
    if (category) catalog = catalog.filter(a => a.category === category);
    return c.json({ count: catalog.length, agents: catalog });
  });

  // GET /api/ipo/agents/coverage — AGENT.md / SKILL.md presence stats
  app.get('/coverage', (c) => {
    const coverage = ipo_orchestration_service.get_skill_coverage();
    return c.json(coverage);
  });

  // GET /api/ipo/agents/:id — single agent profile
  app.get('/:id', (c) => {
    const id = c.req.param('id');
    const profile = ipo_orchestration_service.get_agent_profile(id);
    if (!profile) return c.json({ error: 'Agent not found' }, 404);
    return c.json({ agent: profile });
  });

  // GET /api/ipo/agents/:id/bundle — AGENT.md + SKILL.md content bundle
  app.get('/:id/bundle', (c) => {
    const id = c.req.param('id');
    const bundle = ipo_orchestration_service.load_agent_bundle(id);
    if (!bundle) return c.json({ error: 'Agent not found' }, 404);
    return c.json(bundle);
  });

  // POST /api/ipo/agents/:id/run — execute the agent against the configured
  // LLM provider. Body: { prompt, locale?, context?, provider_code?, model?,
  // temperature?, max_tokens? }. When no provider is registered this returns
  // a deterministic dry-run so the UI flow still works end-to-end.
  app.post('/:id/run', async (c) => {
    const id = c.req.param('id');

    let body: Partial<AgentRunRequest> = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    if (!prompt.trim()) {
      return c.json({ error: 'prompt is required' }, 400);
    }

    const locale: 'en' | 'zh' = body.locale === 'zh' ? 'zh' : 'en';

    try {
      const result = await agent_runner.run({
        agent_id:      id,
        prompt,
        locale,
        context:       typeof body.context === 'string' ? body.context : undefined,
        provider_code: body.provider_code as AiProviderCode | undefined,
        model:         typeof body.model === 'string' ? body.model : undefined,
        temperature:   typeof body.temperature === 'number' ? body.temperature : undefined,
        max_tokens:    typeof body.max_tokens === 'number' ? body.max_tokens : undefined,
      });
      return c.json({ ok: true, result });
    } catch (e) {
      if (e instanceof AgentNotFoundError) {
        return c.json({ error: e.message }, 404);
      }
      if (e instanceof InvalidPromptError) {
        return c.json({ error: e.message }, 400);
      }
      if (e instanceof NotConfiguredError) {
        // Should not normally hit this — runner falls back to dry-run when
        // the registry is empty — but explicit provider override can land
        // here if the requested provider isn't registered.
        return c.json({ error: e.message }, 412);
      }
      if (e instanceof ProviderError) {
        return c.json({
          error: e.message,
          provider: e.provider,
          status:   e.status,
        }, 502);
      }
      console.error('[ipo/agents/run] unexpected error:', e);
      return c.json({ error: 'Agent run failed: ' + (e as Error).message }, 500);
    }
  });

  return app;
}
