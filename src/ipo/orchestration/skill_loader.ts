// file: src/ipo/orchestration/skill_loader.ts
// description: Lazy loader + cache for AGENT.md / SKILL.md markdown bundles.
//              Used by IpoOrchestrationService to surface agent prompts and
//              skill procedures into the dashboard and (Phase 2) the LLM
//              provider layer at execution time.
// reference: agents/ipo/**/AGENT.md, skills/ipo/**/SKILL.md, agent_registry.ts

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_IPO_AGENTS, get_ipo_agent, type IpoAgentDefinition } from './agent_registry';

const ROOT = resolve(import.meta.dir, '..', '..', '..');

export interface AgentSkillBundle {
  agent_id: string;
  agent_md_path: string;
  agent_md: string | null;          // null when file missing
  agent_md_bytes: number;
  skills: Array<{
    path: string;
    content: string | null;
    bytes: number;
  }>;
  resolved_at: string;
}

interface CacheEntry {
  bundle: AgentSkillBundle;
  // mtime stamps so we can cheaply invalidate without restarting in dev
  agent_mtime_ms: number;
  skill_mtimes_ms: number[];
}

const _cache: Map<string, CacheEntry> = new Map();

function read_if_exists(rel_path: string): { content: string | null; mtime_ms: number; bytes: number } {
  const abs = resolve(ROOT, rel_path);
  if (!existsSync(abs)) return { content: null, mtime_ms: 0, bytes: 0 };
  const stat = statSync(abs);
  const content = readFileSync(abs, 'utf8');
  return { content, mtime_ms: stat.mtimeMs, bytes: stat.size };
}

function build_bundle(agent: IpoAgentDefinition): { bundle: AgentSkillBundle; agent_mtime_ms: number; skill_mtimes_ms: number[] } {
  const agent_read = read_if_exists(agent.agent_md_path);
  const skill_reads = agent.skill_files.map(p => ({ path: p, ...read_if_exists(p) }));

  const bundle: AgentSkillBundle = {
    agent_id: agent.id,
    agent_md_path: agent.agent_md_path,
    agent_md: agent_read.content,
    agent_md_bytes: agent_read.bytes,
    skills: skill_reads.map(r => ({ path: r.path, content: r.content, bytes: r.bytes })),
    resolved_at: new Date().toISOString(),
  };
  return {
    bundle,
    agent_mtime_ms: agent_read.mtime_ms,
    skill_mtimes_ms: skill_reads.map(r => r.mtime_ms),
  };
}

/**
 * Returns the AGENT.md + SKILL.md bundle for the given agent id.
 * Re-reads from disk only when mtime has changed (cheap dev-loop friendliness).
 */
export function load_agent_skill_bundle(agent_id: string): AgentSkillBundle | null {
  const agent = get_ipo_agent(agent_id);
  if (!agent) return null;

  const cached = _cache.get(agent_id);
  if (cached) {
    // Quick mtime check
    const agent_abs = resolve(ROOT, agent.agent_md_path);
    const agent_now = existsSync(agent_abs) ? statSync(agent_abs).mtimeMs : 0;
    let stale = agent_now !== cached.agent_mtime_ms;
    if (!stale) {
      for (let i = 0; i < agent.skill_files.length; i++) {
        const skill_abs = resolve(ROOT, agent.skill_files[i]);
        const now = existsSync(skill_abs) ? statSync(skill_abs).mtimeMs : 0;
        if (now !== cached.skill_mtimes_ms[i]) { stale = true; break; }
      }
    }
    if (!stale) return cached.bundle;
  }

  const built = build_bundle(agent);
  _cache.set(agent_id, built);
  return built.bundle;
}

/**
 * Bulk preload — useful at boot to surface coverage statistics.
 */
export interface SkillCoverageReport {
  total_agents: number;
  agents_with_agent_md: number;
  agents_missing_agent_md: string[];
  total_skill_refs: number;
  unique_skills: number;
  skills_with_content: number;
  skills_missing: string[];
}

export function compute_skill_coverage(): SkillCoverageReport {
  const missing_agent: string[] = [];
  const skill_paths_seen = new Set<string>();
  const missing_skills = new Set<string>();
  let agents_with_agent_md = 0;
  let total_skill_refs = 0;
  let skills_with_content = 0;

  for (const agent of ALL_IPO_AGENTS) {
    const r = read_if_exists(agent.agent_md_path);
    if (r.content) agents_with_agent_md++;
    else missing_agent.push(agent.agent_md_path);

    for (const sk of agent.skill_files) {
      total_skill_refs++;
      if (skill_paths_seen.has(sk)) continue;
      skill_paths_seen.add(sk);
      const sr = read_if_exists(sk);
      if (sr.content) skills_with_content++;
      else missing_skills.add(sk);
    }
  }

  return {
    total_agents: ALL_IPO_AGENTS.length,
    agents_with_agent_md,
    agents_missing_agent_md: missing_agent,
    total_skill_refs,
    unique_skills: skill_paths_seen.size,
    skills_with_content,
    skills_missing: Array.from(missing_skills),
  };
}

export function clear_skill_cache(): void {
  _cache.clear();
}
