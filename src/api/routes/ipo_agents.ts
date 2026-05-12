// file: src/api/routes/ipo_agents.ts
// description: IPOPilot agent catalog + execution routes — list agents, fetch
//              profile, fetch the AGENT.md + SKILL.md bundle, and run any
//              agent against the configured LLM provider.
//
//              The /run endpoint is NON-BLOCKING: it registers the request in
//              the in-memory agent_run_registry and returns a run_id
//              immediately. Clients poll /runs/:run_id for status. This is
//              what allows the dashboard to keep generation going when the
//              user navigates away from the page that started it. See
//              src/ipo/orchestration/agent_run_registry.ts.
//
//              Slot-key mutual exclusion: while a slot is occupied by a
//              running task, a second POST /run with the same slot_key
//              returns the existing run_id with HTTP 409 Conflict so the UI
//              can disable the trigger button instead of double-spending
//              tokens.
// reference: src/ipo/orchestration/ipo_orchestration_service.ts,
//            src/ipo/orchestration/agent_runner.ts,
//            src/ipo/orchestration/agent_run_registry.ts,
//            src/ipo/orchestration/skill_loader.ts,
//            src/ipo/orchestration/agent_registry.ts

import { Hono } from 'hono';
import type { Sql as _Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import { ipo_orchestration_service } from '../../ipo/orchestration/ipo_orchestration_service';
import {
  AgentNotFoundError,
  InvalidPromptError,
  type AgentRunRequest,
} from '../../ipo/orchestration/agent_runner';
import {
  start_run,
  get_run,
  get_run_by_slot,
  list_runs,
  cancel_run,
  slot_generic,
} from '../../ipo/orchestration/agent_run_registry';
import { get_ipo_agent } from '../../ipo/orchestration/agent_registry';
import type { AiProviderCode } from '../../ipo/llm/provider';

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

  // -------------------------------------------------------------------------
  // Run-registry routes — defined BEFORE the parametric /:id routes so that
  // /runs and /runs/:run_id don't get captured by /:id.
  // -------------------------------------------------------------------------

  // GET /api/ipo/agents/runs — list runs (filterable). Query params:
  //   project_id, module, active=true, limit
  app.get('/runs', (c) => {
    const project_id = c.req.query('project_id') || undefined;
    const module = c.req.query('module') || undefined;
    const active_only = c.req.query('active') === 'true';
    const limit_raw = c.req.query('limit');
    const limit = limit_raw ? Math.min(parseInt(limit_raw, 10) || 50, 500) : 50;

    const runs = list_runs({ project_id, module, active_only, limit });
    return c.json({ count: runs.length, runs });
  });

  // GET /api/ipo/agents/runs/:run_id — single run snapshot
  app.get('/runs/:run_id', (c) => {
    const run_id = c.req.param('run_id');
    const snap = get_run(run_id);
    if (!snap) return c.json({ error: 'Run not found' }, 404);
    return c.json({ run: snap });
  });

  // POST /api/ipo/agents/runs/:run_id/cancel — mark run as cancelled
  app.post('/runs/:run_id/cancel', (c) => {
    const run_id = c.req.param('run_id');
    const snap = cancel_run(run_id);
    if (!snap) return c.json({ error: 'Run not found' }, 404);
    return c.json({ ok: true, run: snap });
  });

  // -------------------------------------------------------------------------
  // Per-agent routes
  // -------------------------------------------------------------------------

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

  // GET /api/ipo/agents/:id/slot?slot_key=... — peek the active run for a slot.
  // Used by pages on mount to recover "is generation already in flight for me?".
  app.get('/:id/slot', (c) => {
    const slot_key = c.req.query('slot_key');
    if (!slot_key) return c.json({ error: 'slot_key query parameter is required' }, 400);
    const snap = get_run_by_slot(slot_key);
    return c.json({ run: snap });
  });

  // POST /api/ipo/agents/:id/run — register a NON-BLOCKING run.
  //
  // Body: AgentRunRequest fields (prompt, locale, target_market, …) plus
  //       optional slot_key / project_id / module / label routing hints.
  //
  // Returns:
  //   201 { ok: true,  status: 'started',   run: <snapshot> }   — new run
  //   409 { ok: false, status: 'duplicate', run: <snapshot> }   — slot busy
  //   400 / 404 / 500 on input / unknown-agent / unexpected errors
  app.post('/:id/run', async (c) => {
    const id = c.req.param('id');

    // Reject early if the agent isn't in the registry — the runner would
    // throw later anyway, but we want a synchronous 404 here so the UI never
    // sees a "running" task that immediately fails.
    if (!get_ipo_agent(id)) {
      return c.json({ error: new AgentNotFoundError(id).message }, 404);
    }

    let body: Partial<AgentRunRequest> & {
      slot_key?: string;
      project_id?: string;
      module?: string;
      label?: string;
    } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    if (!prompt.trim()) {
      return c.json({ error: new InvalidPromptError('prompt is required').message }, 400);
    }

    const locale: 'en' | 'zh' = body.locale === 'zh' ? 'zh' : 'en';
    const project_id = typeof body.project_id === 'string' ? body.project_id : undefined;

    const request: AgentRunRequest = {
      agent_id:           id,
      prompt,
      locale,
      context:            typeof body.context === 'string' ? body.context : undefined,
      provider_code:      body.provider_code as AiProviderCode | undefined,
      model:              typeof body.model === 'string' ? body.model : undefined,
      temperature:        typeof body.temperature === 'number' ? body.temperature : undefined,
      max_tokens:         typeof body.max_tokens === 'number' ? body.max_tokens : undefined,
      target_market:      typeof body.target_market === 'string'
        ? (body.target_market as AgentRunRequest['target_market'])
        : undefined,
      prospectus_section: typeof body.prospectus_section === 'string'
        ? body.prospectus_section
        : undefined,
    };

    // Determine the slot key. Caller may supply one explicitly. Otherwise we
    // build a per-(project, agent) fallback so naive callers still get
    // de-duplication for repeated clicks.
    const slot_key = typeof body.slot_key === 'string' && body.slot_key.trim()
      ? body.slot_key.trim()
      : slot_generic(project_id, id);

    const module = typeof body.module === 'string' ? body.module : undefined;
    const label = typeof body.label === 'string' ? body.label : undefined;

    let outcome;
    try {
      outcome = start_run({
        slot_key,
        project_id,
        module,
        label,
        request,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[ipo/agents/run] registry start failed:', msg);
      return c.json({ error: msg }, 500);
    }

    if (outcome.kind === 'duplicate') {
      // 409 Conflict — caller should treat the existing run as the canonical
      // one, surface its status to the user, and disable the trigger UI.
      return c.json(
        {
          ok: false,
          status: 'duplicate',
          message: 'Slot is already running an earlier task; returning the existing run.',
          run: outcome.snapshot,
        },
        409,
      );
    }
    return c.json(
      {
        ok: true,
        status: 'started',
        run: outcome.snapshot,
      },
      201,
    );
  });

  // POST /api/ipo/agents/:id/run-sync — DEPRECATED legacy synchronous path.
  // Polls the run registry until completion and returns the result. Kept for
  // any legacy caller that still expects { ok, result } in a single response.
  // New callers MUST use POST /:id/run + polling via the runs-context.
  app.post('/:id/run-sync', async (c) => {
    const id = c.req.param('id');
    if (!get_ipo_agent(id)) {
      return c.json({ error: new AgentNotFoundError(id).message }, 404);
    }
    let body: Partial<AgentRunRequest> & { slot_key?: string; project_id?: string } = {};
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
    const project_id = typeof body.project_id === 'string' ? body.project_id : undefined;
    const request: AgentRunRequest = {
      agent_id: id,
      prompt,
      locale,
      context:            typeof body.context === 'string' ? body.context : undefined,
      provider_code:      body.provider_code as AiProviderCode | undefined,
      model:              typeof body.model === 'string' ? body.model : undefined,
      temperature:        typeof body.temperature === 'number' ? body.temperature : undefined,
      max_tokens:         typeof body.max_tokens === 'number' ? body.max_tokens : undefined,
      target_market:      typeof body.target_market === 'string'
        ? (body.target_market as AgentRunRequest['target_market']) : undefined,
      prospectus_section: typeof body.prospectus_section === 'string'
        ? body.prospectus_section : undefined,
    };
    // Use a unique slot per call so legacy sync callers don't collide.
    const slot_key = typeof body.slot_key === 'string' && body.slot_key.trim()
      ? body.slot_key.trim()
      : slot_generic(project_id, id, `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    const outcome = start_run({ slot_key, project_id, request });
    const run_id = outcome.snapshot.run_id;

    // Bounded poll loop — give up after 6 minutes so the HTTP socket can't
    // be held open forever.
    const deadline = Date.now() + 6 * 60 * 1000;
    while (Date.now() < deadline) {
      const snap = get_run(run_id);
      if (!snap) return c.json({ error: 'Run vanished' }, 500);
      if (snap.status === 'completed' && snap.result) {
        return c.json({ ok: true, result: snap.result });
      }
      if (snap.status === 'failed') {
        return c.json(
          { error: snap.error?.message ?? 'Agent run failed' },
          (snap.error?.status as 400 | 404 | 412 | 500 | 502) ?? 500,
        );
      }
      if (snap.status === 'cancelled') {
        return c.json({ error: 'Run cancelled' }, 409);
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return c.json({ error: 'Timed out waiting for agent run' }, 504);
  });

  return app;
}
