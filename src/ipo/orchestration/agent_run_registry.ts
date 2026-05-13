// file: src/ipo/orchestration/agent_run_registry.ts
// description: In-memory registry for asynchronous agent runs. The dashboard
//              fires off long-running LLM calls and then walks away (switches
//              pages, closes the panel, etc.). The registry keeps the run
//              alive on the server side, exposes its status for polling, and
//              enforces "same slot can only have one in-flight run at a time"
//              so the user can't accidentally double-trigger generation.
//
//              Slot key strategy (caller-supplied via /run body.slot_key):
//                financial   : "{project_id}::financial::{agent_id}"
//                prospectus  : "{project_id}::prospectus::{section_code}"
//                regulator   : "{project_id}::regulator_qa::{agent_id}"
//                valuation   : "{project_id}::valuation::{agent_id}"
//                stock_sim   : "{project_id}::stock_sim"
//                fallback    : built by slot_generic(project_id, agent_id)
//
//              Persistence: in-memory only for now. Server restart drops
//              in-flight tasks (the LLM keeps running upstream; we just lose
//              the record). Phase 2 will add a Postgres table.
//
//              Public surface (function-style — what src/api/routes/ipo_agents
//              imports):
//                start_run(opts)         → { kind: 'started'|'duplicate'; snapshot }
//                get_run(run_id)         → AgentRunSnapshot | null
//                get_run_by_slot(slot)   → AgentRunSnapshot | null   (only RUNNING)
//                list_runs(filters)      → AgentRunSnapshot[]
//                cancel_run(run_id)      → AgentRunSnapshot | null
//                slot_generic(p_id, ag, suffix?) → string
//
// reference: src/ipo/orchestration/agent_runner.ts (the worker that actually
//            calls the LLM provider).

import { randomUUID } from 'node:crypto';
import {
  agent_runner,
  AgentNotFoundError,
  InvalidPromptError,
  type AgentRunRequest,
  type AgentRunResult,
} from './agent_runner';
import { NotConfiguredError, ProviderError } from '../llm/provider';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

interface AgentRunRecord {
  run_id: string;
  slot_key: string;
  agent_id: string;
  project_id?: string;
  module?: string;
  label?: string;
  status: RunStatus;
  started_at: number;
  finished_at?: number;
  request: AgentRunRequest;
  result?: AgentRunResult;
  error?: { message: string; status?: number; provider?: string };
}

/** Wire-format snapshot — what we send to the client. The full request blob
 *  may carry a long prompt, so we trim it to the first 200 chars for clients. */
export interface AgentRunSnapshot {
  run_id: string;
  slot_key: string;
  agent_id: string;
  project_id?: string;
  module?: string;
  label?: string;
  status: RunStatus;
  started_at: number;
  finished_at?: number;
  ms_elapsed: number;
  prompt_preview: string;
  result?: AgentRunResult;
  error?: { message: string; status?: number; provider?: string };
}

export interface StartRunOptions {
  slot_key: string;
  request: AgentRunRequest;
  project_id?: string;
  module?: string;
  label?: string;
}

export type StartRunOutcome =
  | { kind: 'started';   snapshot: AgentRunSnapshot }
  | { kind: 'duplicate'; snapshot: AgentRunSnapshot };

export interface ListRunsFilters {
  project_id?: string;
  module?: string;
  active_only?: boolean;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** How long to keep COMPLETED / FAILED / CANCELLED records around so the
 *  client can still fetch them. Older entries are evicted lazily. */
const TERMINAL_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Hard cap on RUNNING records to defend against runaway loops. */
const MAX_CONCURRENT_RUNNING = 200;

// ---------------------------------------------------------------------------
// Registry (singleton inside this module)
// ---------------------------------------------------------------------------

const by_id   = new Map<string, AgentRunRecord>();
const by_slot = new Map<string, string>(); // slot_key → run_id (active only)

function count_running(): number {
  let n = 0;
  for (const rec of by_id.values()) {
    if (rec.status === 'running') n++;
  }
  return n;
}

function evict_stale(): void {
  const now = Date.now();
  for (const [run_id, rec] of by_id.entries()) {
    if (rec.status === 'running') continue;
    const t = rec.finished_at ?? rec.started_at;
    if (now - t > TERMINAL_TTL_MS) {
      by_id.delete(run_id);
    }
  }
}

function to_snapshot(rec: AgentRunRecord): AgentRunSnapshot {
  const now = Date.now();
  return {
    run_id:         rec.run_id,
    slot_key:       rec.slot_key,
    agent_id:       rec.agent_id,
    project_id:     rec.project_id,
    module:         rec.module,
    label:          rec.label,
    status:         rec.status,
    started_at:     rec.started_at,
    finished_at:    rec.finished_at,
    ms_elapsed:     (rec.finished_at ?? now) - rec.started_at,
    prompt_preview: rec.request.prompt.slice(0, 200),
    result:         rec.result,
    error:          rec.error,
  };
}

async function execute(rec: AgentRunRecord): Promise<void> {
  try {
    const result = await agent_runner.run(rec.request);
    if (rec.status === 'cancelled') return; // user pressed cancel mid-flight
    rec.result = result;
    rec.status = 'completed';
    rec.finished_at = Date.now();
  } catch (e) {
    if (rec.status === 'cancelled') return;
    const msg = e instanceof Error ? e.message : String(e);
    let status: number | undefined;
    let provider: string | undefined;
    if (e instanceof AgentNotFoundError) {
      status = 404;
    } else if (e instanceof InvalidPromptError) {
      status = 400;
    } else if (e instanceof NotConfiguredError) {
      status = 412;
    } else if (e instanceof ProviderError) {
      status = e.status ?? undefined;
      provider = e.provider ?? undefined;
    }
    rec.error = { message: msg, status, provider };
    rec.status = 'failed';
    rec.finished_at = Date.now();
  } finally {
    // Free the slot regardless of outcome (so user can retry).
    if (by_slot.get(rec.slot_key) === rec.run_id) {
      by_slot.delete(rec.slot_key);
    }
  }
}

// ---------------------------------------------------------------------------
// Public function-style API (matches src/api/routes/ipo_agents.ts imports)
// ---------------------------------------------------------------------------

/** Build a default slot_key for a (project_id, agent_id) pair. */
export function slot_generic(
  project_id: string | undefined,
  agent_id: string,
  suffix?: string,
): string {
  const p = project_id || 'no_project';
  const base = `${p}::generic::${agent_id}`;
  return suffix ? `${base}::${suffix}` : base;
}

/**
 * Schedule a new run. If a run with the same slot_key is already active
 * (status='running'), returns kind:'duplicate' with that existing run's
 * snapshot — the API layer should respond 409 and the UI should treat the
 * existing run as canonical.
 */
export function start_run(opts: StartRunOptions): StartRunOutcome {
  // Same-slot dedup
  const existing_id = by_slot.get(opts.slot_key);
  if (existing_id) {
    const existing = by_id.get(existing_id);
    if (existing && existing.status === 'running') {
      return { kind: 'duplicate', snapshot: to_snapshot(existing) };
    }
    // Stale slot binding (e.g. record expired) — fall through and rebind.
    by_slot.delete(opts.slot_key);
  }

  if (count_running() >= MAX_CONCURRENT_RUNNING) {
    throw new Error(`Too many concurrent agent runs (>${MAX_CONCURRENT_RUNNING})`);
  }

  const run_id = randomUUID();
  const rec: AgentRunRecord = {
    run_id,
    slot_key:   opts.slot_key,
    agent_id:   opts.request.agent_id,
    project_id: opts.project_id,
    module:     opts.module,
    label:      opts.label,
    status:     'running',
    started_at: Date.now(),
    request:    opts.request,
  };
  by_id.set(run_id, rec);
  by_slot.set(opts.slot_key, run_id);

  // Fire-and-forget. The promise lives independent of any HTTP request.
  execute(rec).catch((e) => {
    console.error('[run_registry] execute() escaped error for', run_id, e);
  });

  return { kind: 'started', snapshot: to_snapshot(rec) };
}

/** Fetch a single run snapshot by id. Returns null if unknown or evicted. */
export function get_run(run_id: string): AgentRunSnapshot | null {
  const rec = by_id.get(run_id);
  if (!rec) return null;
  return to_snapshot(rec);
}

/**
 * Fetch the currently-running snapshot for a slot, if any. Returns null when
 * the slot is free or the previous run already finished. The UI uses this on
 * page mount to recover state — "is something already running for me?".
 */
export function get_run_by_slot(slot_key: string): AgentRunSnapshot | null {
  const run_id = by_slot.get(slot_key);
  if (!run_id) return null;
  const rec = by_id.get(run_id);
  if (!rec) {
    by_slot.delete(slot_key);
    return null;
  }
  if (rec.status !== 'running') {
    // Defensive — execute() should already have cleared this binding, but
    // we double-check on read.
    by_slot.delete(slot_key);
    return null;
  }
  return to_snapshot(rec);
}

/**
 * List runs, filtered by project / module / active-only / limit. Sorted with
 * active runs first (oldest start first), then recent terminal runs.
 */
export function list_runs(filters: ListRunsFilters = {}): AgentRunSnapshot[] {
  evict_stale();
  const { project_id, module, active_only, limit } = filters;

  const all: AgentRunRecord[] = [];
  for (const rec of by_id.values()) {
    if (project_id && rec.project_id !== project_id) continue;
    if (module && rec.module !== module) continue;
    if (active_only && rec.status !== 'running') continue;
    all.push(rec);
  }

  all.sort((a, b) => {
    // running first
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (a.status !== 'running' && b.status === 'running') return 1;
    // then most recent activity
    const ta = a.finished_at ?? a.started_at;
    const tb = b.finished_at ?? b.started_at;
    return tb - ta;
  });

  const sliced = typeof limit === 'number' ? all.slice(0, limit) : all;
  return sliced.map(to_snapshot);
}

/**
 * Mark a run cancelled. The underlying LLM call cannot be aborted (no
 * AbortSignal plumbing into the provider yet), but the slot frees up
 * immediately and the eventual result is discarded by execute().
 */
export function cancel_run(run_id: string): AgentRunSnapshot | null {
  const rec = by_id.get(run_id);
  if (!rec) return null;
  if (rec.status === 'running') {
    rec.status = 'cancelled';
    rec.finished_at = Date.now();
    if (by_slot.get(rec.slot_key) === run_id) {
      by_slot.delete(rec.slot_key);
    }
  }
  return to_snapshot(rec);
}
