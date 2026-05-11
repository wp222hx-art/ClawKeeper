// file: src/index.ts
// description: IPOPilot main entry point - boots ClawKeeper agent runtime
//              (foundation), then registers the IPOPilot agent catalog and
//              orchestration service on top.
// reference: src/api/server.ts, src/agents/index.ts,
//            src/ipo/orchestration/ipo_orchestration_service.ts

import { agent_runtime } from './agents/index';
import { flush_opik } from './core/observability';
import { ipo_orchestration_service } from './ipo/orchestration/ipo_orchestration_service';
import { ALL_IPO_AGENTS, IPO_AGENT_COUNT } from './ipo/orchestration/agent_registry';
import { llm_provider_registry } from './ipo/llm/registry';

console.log('');
console.log('═'.repeat(60));
console.log('  🚀 IPOPilot');
console.log('  AI Co-Pilot for Global IPO Readiness');
console.log('  (powered by ClawKeeper agent runtime)');
console.log('═'.repeat(60));
console.log('');

// Start ClawKeeper foundation runtime
console.log('[Foundation] Initializing ClawKeeper agent runtime...');
const _clawkeeper = await agent_runtime.get_agent('clawkeeper');
console.log('[Foundation] ✅ ClawKeeper CEO agent: ONLINE');
void _clawkeeper;

try {
  const _ap_lead = await agent_runtime.get_agent('accounts_payable_lead');
  console.log('[Foundation] ✅ Accounts Payable Lead: ONLINE');
  void _ap_lead;
} catch {
  console.log('[Foundation] ⏳ Accounts Payable Lead: pending implementation');
}

// Display foundation agent status (collapsed)
const profiles = agent_runtime.get_all_profiles();
console.log(`[Foundation] ${profiles.length} ClawKeeper agents registered.`);

// -----------------------------------------------------------------------------
// IPOPilot agent catalog (Phase 1: registry only — no LLM calls yet)
// -----------------------------------------------------------------------------
console.log('');
console.log('[IPOPilot] Loading IPO agent catalog...');
const ipo_catalog = ipo_orchestration_service.get_agent_catalog();
const tier_counts: Record<string, number> = {};
for (const a of ipo_catalog) {
  tier_counts[a.tier] = (tier_counts[a.tier] || 0) + 1;
}
console.log(`[IPOPilot] ✅ ${IPO_AGENT_COUNT} IPO agents registered:`);
for (const [tier, count] of Object.entries(tier_counts)) {
  console.log(`           - ${tier}: ${count}`);
}
console.log('[IPOPilot] Stage gates, workstream blueprints, and signoff rules: LOADED');

// Skill / AGENT.md coverage report
const _coverage = ipo_orchestration_service.get_skill_coverage();
console.log(
  `[IPOPilot] Skill coverage: AGENT.md ${_coverage.agents_with_agent_md}/${_coverage.total_agents}, ` +
  `SKILL.md ${_coverage.skills_with_content}/${_coverage.unique_skills}`
);
// Bootstrap LLM provider registry from environment variables FIRST
// (env wins over DB if both are present for the same code).
const _llm_boot = llm_provider_registry.bootstrap_from_env();
if (_llm_boot.registered.length > 0) {
  console.log(
    `[IPOPilot] AI providers from env: ${_llm_boot.registered.join(', ')} ` +
    `(default: ${_llm_boot.default_provider ?? 'none'})`
  );
}

// Then rehydrate any DB-persisted providers (POST /api/ipo/providers with
// persist=true). This lets keys saved through the UI survive restarts.
try {
  const { sql } = await import('./api/server');
  const _db_boot = await llm_provider_registry.bootstrap_from_db(sql);
  if (_db_boot.rehydrated.length > 0) {
    console.log(
      `[IPOPilot] AI providers from DB: ${_db_boot.rehydrated.join(', ')} ` +
      `(default: ${_db_boot.default_provider ?? 'none'})`
    );
  }
  if (_db_boot.errors.length > 0) {
    for (const e of _db_boot.errors) {
      console.warn(`[IPOPilot] DB rehydration warning [${e.code}]: ${e.error}`);
    }
  }
} catch (e) {
  console.warn('[IPOPilot] DB rehydration skipped:', e instanceof Error ? e.message : e);
}

if (!llm_provider_registry.is_configured()) {
  console.log('[IPOPilot] AI provider: NOT CONFIGURED — set IPO_TOKENHOT_API_KEY (or OPENAI/ANTHROPIC/DEEPSEEK), or POST to /api/ipo/providers with persist=true');
} else {
  console.log('[IPOPilot] ✅ AI providers ready — agents will run in LIVE mode');
}
void ALL_IPO_AGENTS; // keep import live for tree-shaking awareness

// Start API server
console.log('');
console.log('[API] Starting server...');

const port = Number(process.env.PORT) || 4004;
const server_module = await import('./api/server');

// Start Bun server
Bun.serve({
  port,
  fetch: server_module.default.fetch,
});

console.log(`[API] ✅ Server running on http://localhost:${port}`);
console.log(`[API]    Health: http://localhost:${port}/health`);
console.log(`[API]    Agents: http://localhost:${port}/api/agents/status`);

console.log('');
console.log('═'.repeat(60));
console.log('  ✅ IPOPilot is ONLINE');
console.log('═'.repeat(60));
console.log('');
console.log('Press Ctrl+C to stop');

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  await flush_opik();
  await agent_runtime.stop_all();
  console.log('👋 IPOPilot stopped');
  process.exit(0);
});

// Keep process alive
await new Promise(() => {});
