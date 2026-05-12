// file: dashboard/src/lib/runs-context.tsx
// description: Global agent-run scheduler context. The whole point: when the
//              user starts an AI generation on one page (招股书 / 财务体检 / 估值
//              / 监管问询 / 股价模拟) and then navigates away, the task must
//              continue on the server and reappear with its current status if
//              the user comes back. While a task is running on a slot, we
//              must NOT accept a second generation request for the same slot.
//
//              Architecture
//              ------------
//              - Mounted ONCE at the React root (above <BrowserRouter />), so
//                it survives every route change.
//              - Polls GET /api/ipo/agents/runs?active=true every 2 seconds
//                while at least one task is active. Adds finished tasks to a
//                short-lived "recent" cache so pages can read final output
//                without storing it locally.
//              - Exposes:
//                  start_run(opts)       — fire a new run (slot-aware mutex)
//                  get_run_by_slot(key)  — page reads its own slot's state
//                  get_run(run_id)       — read by id
//                  cancel_run(run_id)
//                  active_runs           — for the global "n tasks running"
//                                          indicator
//
// reference: src/api/routes/ipo_agents.ts (run / runs / runs/:id endpoints),
//            src/ipo/orchestration/agent_run_registry.ts (slot semantics).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ipo_api,
  type AgentRunSnapshot,
  type AgentRunStatus,
  type StartRunRequest,
  type StartRunResponse,
} from './ipo-api';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type { AgentRunSnapshot, AgentRunStatus, StartRunRequest } from './ipo-api';

export interface StartRunArgs {
  /** Agent id to invoke. */
  agent_id: string;
  /** Mutual-exclusion key. While a slot is busy, repeated calls return the
   *  existing run; the UI should disable its trigger button. */
  slot_key: string;
  /** Project id (optional but recommended; drives per-project listings). */
  project_id?: string;
  /** Logical module — financial / prospectus / regulator_qa / valuation / stock_sim. */
  module?: string;
  /** Short label, shown in the "running tasks" indicator. */
  label?: string;
  /** The actual agent request body (prompt, locale, target_market, …). */
  request: Omit<StartRunRequest, 'slot_key' | 'project_id' | 'module' | 'label'>;
}

export interface RunsContextValue {
  /** All known runs the client has touched (keyed by run_id). Includes
   *  completed and recently-finished entries up to ~30 minutes. */
  runs_by_id: Record<string, AgentRunSnapshot>;
  /** All currently-active runs (status = 'running'), oldest first. */
  active_runs: AgentRunSnapshot[];

  /** Start a run. Returns the snapshot — possibly the existing one if the
   *  slot was already occupied. Result.is_duplicate flag tells the caller
   *  whether a new task was actually created. */
  start_run: (args: StartRunArgs) => Promise<{ snapshot: AgentRunSnapshot; is_duplicate: boolean }>;

  /** Read by run_id. Returns null if we haven't seen it. */
  get_run: (run_id: string | null | undefined) => AgentRunSnapshot | null;

  /** Read the active run on a slot (returns null when slot is free). */
  get_run_by_slot: (slot_key: string) => AgentRunSnapshot | null;

  /** Cancel a run (frees the slot immediately, marks status='cancelled'). */
  cancel_run: (run_id: string) => Promise<void>;

  /** Manually refetch — fires immediately rather than waiting for the next
   *  scheduled poll. Useful right after start_run(). */
  refetch_runs: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const RunsContext = createContext<RunsContextValue | null>(null);

const ACTIVE_POLL_INTERVAL_MS = 2000;     // while at least one run is active
const IDLE_POLL_INTERVAL_MS   = 15000;    // when no runs are active — keep an
                                          // occasional ping so we still notice
                                          // tasks started in another tab.

function is_active(s: AgentRunStatus): boolean {
  return s === 'running';
}

interface ProviderProps {
  children: ReactNode;
}

export function RunsProvider({ children }: ProviderProps) {
  const [runs_by_id, set_runs_by_id] = useState<Record<string, AgentRunSnapshot>>({});

  // Index slot_key → run_id for the currently-running run, if any. Rebuilt
  // from runs_by_id whenever it changes.
  const slot_index = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of Object.values(runs_by_id)) {
      if (is_active(r.status)) out[r.slot_key] = r.run_id;
    }
    return out;
  }, [runs_by_id]);

  const active_runs = useMemo(() => {
    return Object.values(runs_by_id)
      .filter(r => is_active(r.status))
      .sort((a, b) => a.started_at - b.started_at);
  }, [runs_by_id]);

  // ------------------------------------------------------------------------
  // Apply snapshots — merge into the map. Notify listeners when a previously
  // active run transitions to a terminal state (so callers can fire toasts
  // and refetch dependent queries).
  // ------------------------------------------------------------------------
  const finished_listeners = useRef<Set<(snap: AgentRunSnapshot) => void>>(new Set());

  const merge_snapshots = useCallback((snaps: AgentRunSnapshot[]) => {
    if (snaps.length === 0) return;
    set_runs_by_id(prev => {
      const next = { ...prev };
      for (const s of snaps) {
        const before = next[s.run_id];
        next[s.run_id] = s;
        if (before && is_active(before.status) && !is_active(s.status)) {
          // Transitioned to terminal — notify listeners.
          for (const fn of finished_listeners.current) {
            try { fn(s); } catch { /* swallow */ }
          }
        }
      }
      return next;
    });
  }, []);

  // ------------------------------------------------------------------------
  // Polling loop. We poll only active=true (cheap) and also include any
  // tracked-but-still-running ids that are no longer in the active list
  // (e.g. cleared from server cache) by re-fetching them individually.
  // ------------------------------------------------------------------------
  const poll_in_flight = useRef(false);

  const refetch_runs = useCallback(async () => {
    if (poll_in_flight.current) return;
    poll_in_flight.current = true;
    try {
      // Fetch all runs, not just active — we want to see freshly-completed
      // ones the next tick so the UI flips from "running" to result instantly.
      const { runs } = await ipo_api.list_runs({ limit: 100 });
      merge_snapshots(runs);

      // Backfill: any run we had marked active that didn't appear in the
      // listing — fetch by id (could have aged out, in which case 404 → null
      // and we just leave the local copy alone).
      const seen = new Set(runs.map(r => r.run_id));
      const missing_active = Object.values(runs_by_id_ref.current).filter(
        r => is_active(r.status) && !seen.has(r.run_id),
      );
      for (const m of missing_active) {
        try {
          const fresh = await ipo_api.get_run(m.run_id);
          if (fresh) merge_snapshots([fresh]);
        } catch {
          /* network blip — ignore */
        }
      }
    } catch (e) {
      // Polling errors are non-fatal — try again next tick.
      // eslint-disable-next-line no-console
      console.warn('[runs-context] poll failed:', (e as Error).message);
    } finally {
      poll_in_flight.current = false;
    }
  }, [merge_snapshots]);

  // We need a ref to the latest map so the polling loop's closure stays fresh
  // without re-creating intervals on every snapshot update.
  const runs_by_id_ref = useRef(runs_by_id);
  useEffect(() => { runs_by_id_ref.current = runs_by_id; }, [runs_by_id]);

  // Driver: choose interval based on whether anything is active. The interval
  // re-installs itself on activity changes so we don't waste polls when idle.
  useEffect(() => {
    const interval =
      Object.values(runs_by_id).some(r => is_active(r.status))
        ? ACTIVE_POLL_INTERVAL_MS
        : IDLE_POLL_INTERVAL_MS;

    // Kick off one immediate fetch on mount / activity change.
    void refetch_runs();

    const t = setInterval(() => { void refetch_runs(); }, interval);
    return () => clearInterval(t);
  }, [refetch_runs, runs_by_id]);

  // ------------------------------------------------------------------------
  // start_run / cancel_run
  // ------------------------------------------------------------------------
  const start_run = useCallback(
    async (args: StartRunArgs): Promise<{ snapshot: AgentRunSnapshot; is_duplicate: boolean }> => {
      const body: StartRunRequest = {
        ...args.request,
        slot_key:   args.slot_key,
        project_id: args.project_id,
        module:     args.module,
        label:      args.label,
      };
      const resp: StartRunResponse = await ipo_api.start_run(args.agent_id, body);
      // Both 201 and 409 paths return a snapshot — merge it so the UI updates
      // immediately rather than waiting for the next poll tick.
      merge_snapshots([resp.run]);
      // Also kick off an immediate refetch so the global indicator updates.
      void refetch_runs();
      return { snapshot: resp.run, is_duplicate: resp.ok === false };
    },
    [merge_snapshots, refetch_runs],
  );

  const get_run = useCallback(
    (run_id: string | null | undefined): AgentRunSnapshot | null => {
      if (!run_id) return null;
      return runs_by_id[run_id] ?? null;
    },
    [runs_by_id],
  );

  const get_run_by_slot = useCallback(
    (slot_key: string): AgentRunSnapshot | null => {
      const run_id = slot_index[slot_key];
      if (!run_id) return null;
      return runs_by_id[run_id] ?? null;
    },
    [runs_by_id, slot_index],
  );

  const cancel_run = useCallback(async (run_id: string) => {
    const snap = await ipo_api.cancel_run(run_id);
    if (snap) merge_snapshots([snap]);
  }, [merge_snapshots]);

  // ------------------------------------------------------------------------
  // Memoize the context value so consumers re-render only on actual state
  // changes.
  // ------------------------------------------------------------------------
  const value: RunsContextValue = useMemo(() => ({
    runs_by_id,
    active_runs,
    start_run,
    get_run,
    get_run_by_slot,
    cancel_run,
    refetch_runs,
  }), [runs_by_id, active_runs, start_run, get_run, get_run_by_slot, cancel_run, refetch_runs]);

  return <RunsContext.Provider value={value}>{children}</RunsContext.Provider>;
}

/**
 * Hook for consumers. Returns the global runs context. Calling this outside
 * <RunsProvider /> throws so we surface mistakes loudly during dev.
 */
export function use_runs(): RunsContextValue {
  const ctx = useContext(RunsContext);
  if (!ctx) {
    throw new Error('use_runs() must be called inside <RunsProvider />');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Slot-key builders — keep parity with backend src/ipo/orchestration/agent_run_registry.ts
// ---------------------------------------------------------------------------

export const slot_keys = {
  financial:    (project_id: string, agent_id: string) =>
    `${project_id}::financial::${agent_id}`,
  prospectus:   (project_id: string, section_code: string) =>
    `${project_id}::prospectus::${section_code}`,
  regulator_qa: (project_id: string, agent_id: string) =>
    `${project_id}::regulator_qa::${agent_id}`,
  valuation:    (project_id: string, agent_id: string) =>
    `${project_id}::valuation::${agent_id}`,
  stock_sim:    (project_id: string) =>
    `${project_id}::stock_sim`,
  generic:      (project_id: string | undefined, agent_id: string, suffix?: string) => {
    const p = project_id || 'no_project';
    const base = `${p}::generic::${agent_id}`;
    return suffix ? `${base}::${suffix}` : base;
  },
};

// ---------------------------------------------------------------------------
// Helper hook for pages: bind a slot, get back { current, start, cancel,
// is_running, is_blocked }. The whole 5-page rewrite uses this.
// ---------------------------------------------------------------------------

export interface UseSlotRunResult {
  /** Snapshot for the current slot, or null when nothing is running and no
   *  finished result is yet known by the local cache. */
  current: AgentRunSnapshot | null;
  /** Convenience flags. */
  is_running: boolean;
  is_completed: boolean;
  is_failed: boolean;
  is_cancelled: boolean;
  /** Trigger a new run on this slot. If the slot is already busy, returns
   *  the existing run (is_duplicate = true) without creating a second one. */
  start: (req: StartRunArgs['request']) => Promise<{ snapshot: AgentRunSnapshot; is_duplicate: boolean }>;
  /** Cancel the currently-running task on this slot, if any. */
  cancel: () => Promise<void>;
  /** Convenience for the result body once the run completes. */
  result: AgentRunSnapshot['result'] | null;
  /** Elapsed seconds (live for running, frozen for finished). */
  elapsed_s: number;
}

export interface UseSlotRunOptions {
  agent_id: string;
  slot_key: string;
  project_id?: string;
  module?: string;
  label?: string;
}

export function use_slot_run(opts: UseSlotRunOptions): UseSlotRunResult {
  const { start_run, cancel_run, get_run_by_slot, get_run, runs_by_id } = use_runs();

  // Track the run_id we last associated with this slot so we can keep
  // showing the result even after the slot is freed (terminal status).
  const [last_run_id, set_last_run_id] = useState<string | null>(null);

  // On mount / slot change: try to recover a server-side run for this slot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await ipo_api.get_slot(opts.agent_id, opts.slot_key);
        if (!cancelled && snap) set_last_run_id(snap.run_id);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [opts.agent_id, opts.slot_key]);

  const active = get_run_by_slot(opts.slot_key);
  const tracked = last_run_id ? get_run(last_run_id) : null;
  const current = active ?? tracked ?? null;

  const start = useCallback(
    async (req: StartRunArgs['request']) => {
      const out = await start_run({
        agent_id:   opts.agent_id,
        slot_key:   opts.slot_key,
        project_id: opts.project_id,
        module:     opts.module,
        label:      opts.label,
        request:    req,
      });
      set_last_run_id(out.snapshot.run_id);
      return out;
    },
    [start_run, opts.agent_id, opts.slot_key, opts.project_id, opts.module, opts.label],
  );

  const cancel = useCallback(async () => {
    if (!current || current.status !== 'running') return;
    await cancel_run(current.run_id);
  }, [cancel_run, current]);

  // Live elapsed counter — drives the "已运行 12s" label.
  const [elapsed_s, set_elapsed_s] = useState(0);
  useEffect(() => {
    if (!current) { set_elapsed_s(0); return; }
    const update = () => {
      const end = current.finished_at ?? Date.now();
      set_elapsed_s(Math.max(0, Math.round((end - current.started_at) / 1000)));
    };
    update();
    if (current.status === 'running') {
      const t = setInterval(update, 1000);
      return () => clearInterval(t);
    }
    return undefined;
  // We deliberately depend on the run_id and status — ms_elapsed updates on
  // every poll and we don't want to reset the timer needlessly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.run_id, current?.status, current?.started_at, current?.finished_at, runs_by_id]);

  return {
    current,
    is_running:   current?.status === 'running',
    is_completed: current?.status === 'completed',
    is_failed:    current?.status === 'failed',
    is_cancelled: current?.status === 'cancelled',
    start,
    cancel,
    result:       current?.result ?? null,
    elapsed_s,
  };
}
