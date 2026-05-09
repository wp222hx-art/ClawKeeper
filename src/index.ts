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
console.log('[IPOPilot] AI provider: NOT CONFIGURED (Phase 2 — agents idle)');
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
