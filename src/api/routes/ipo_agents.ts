// file: src/api/routes/ipo_agents.ts
// description: IPOPilot agent catalog routes — list agents, fetch profile,
//              fetch the AGENT.md + SKILL.md bundle for an agent, get
//              skill-coverage stats. Read-only in Phase 1.
// reference: src/ipo/orchestration/ipo_orchestration_service.ts,
//            src/ipo/orchestration/skill_loader.ts,
//            src/ipo/orchestration/agent_registry.ts

import { Hono } from 'hono';
import type { Sql as _Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import { ipo_orchestration_service } from '../../ipo/orchestration/ipo_orchestration_service';

export function create_ipo_agent_routes(_sql: _Sql<Record<string, unknown>>) {
  const app = new Hono<AppEnv>();

  // GET /api/ipo/agents — full catalog
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

  return app;
}
