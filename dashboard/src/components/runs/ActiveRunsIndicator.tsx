// file: dashboard/src/components/runs/ActiveRunsIndicator.tsx
// description: Floating top-right indicator that shows how many AI generations
//              are currently running across the whole app. Always visible
//              regardless of the current page, because the RunsProvider lives
//              above the router. Clicking the badge expands a panel listing
//              every active task with its elapsed time, agent name, label,
//              and a Cancel button.
//
//              The indicator hides itself entirely when no runs are active so
//              it never interferes with normal navigation.
// reference: dashboard/src/lib/runs-context.tsx

import { useState } from 'react';
import { use_runs, type AgentRunSnapshot } from '../../lib/runs-context';

function fmt_elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r.toString().padStart(2, '0')}s`;
}

function status_color(s: AgentRunSnapshot['status']): string {
  switch (s) {
    case 'running':   return 'bg-blue-500 animate-pulse';
    case 'completed': return 'bg-green-500';
    case 'failed':    return 'bg-red-500';
    case 'cancelled': return 'bg-gray-400';
    default:          return 'bg-yellow-400';
  }
}

export function ActiveRunsIndicator() {
  const { active_runs, runs_by_id, cancel_run } = use_runs();
  const [expanded, set_expanded] = useState(false);

  // Recently-finished tasks (within 60s) — show below the active list so
  // users see "✓ MD&A 起草已完成" briefly even after switching pages.
  const recent_finished = Object.values(runs_by_id)
    .filter(r => {
      if (r.status === 'running') return false;
      if (!r.finished_at) return false;
      return Date.now() - r.finished_at < 60_000;
    })
    .sort((a, b) => (b.finished_at ?? 0) - (a.finished_at ?? 0))
    .slice(0, 5);

  if (active_runs.length === 0 && recent_finished.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[1000] select-none">
      {/* Compact badge */}
      {!expanded && (
        <button
          type="button"
          onClick={() => set_expanded(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition"
          aria-label="查看进行中的 AI 任务"
        >
          {active_runs.length > 0 ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              <span className="text-sm font-medium">
                {active_runs.length} 个 AI 任务进行中
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-green-300" />
              <span className="text-sm font-medium">
                {recent_finished.length} 个任务刚完成
              </span>
            </>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="w-96 max-w-[90vw] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI 任务面板
            </div>
            <button
              type="button"
              onClick={() => set_expanded(false)}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 text-lg leading-none"
              aria-label="收起"
            >
              ×
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {active_runs.length === 0 && recent_finished.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                当前无任务
              </div>
            )}

            {active_runs.map(r => (
              <RunRow
                key={r.run_id}
                run={r}
                on_cancel={() => { void cancel_run(r.run_id); }}
              />
            ))}

            {recent_finished.length > 0 && (
              <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900">
                最近完成
              </div>
            )}
            {recent_finished.map(r => (
              <RunRow key={r.run_id} run={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RunRow({
  run,
  on_cancel,
}: {
  run: AgentRunSnapshot;
  on_cancel?: () => void;
}) {
  const elapsed_ms = (run.finished_at ?? Date.now()) - run.started_at;
  const label = run.label || run.agent_id;
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <span className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${status_color(run.status)}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {label}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
          <span>agent: {run.agent_id}</span>
          {run.module && <span>· {run.module}</span>}
          <span>· {fmt_elapsed(elapsed_ms)}</span>
          <span>· {status_label(run.status)}</span>
        </div>
        {run.status === 'failed' && run.error?.message && (
          <div className="text-xs text-red-600 mt-1 truncate" title={run.error.message}>
            ✗ {run.error.message}
          </div>
        )}
      </div>
      {run.status === 'running' && on_cancel && (
        <button
          type="button"
          onClick={on_cancel}
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          取消
        </button>
      )}
    </div>
  );
}

function status_label(s: AgentRunSnapshot['status']): string {
  switch (s) {
    case 'running':   return '生成中';
    case 'completed': return '已完成';
    case 'failed':    return '失败';
    case 'cancelled': return '已取消';
  }
}
