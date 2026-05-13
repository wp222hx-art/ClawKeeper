// file: dashboard/src/pages/ipo/RegulatorQA.tsx
// description: Regulator Q&A workspace — paste an SEC comment-letter or HKEX
//              hearing question, route it to the matching responder agent
//              (sec_comment_responder / hkex_sponsor_qa_handler / ipo_director),
//              and surface a cited draft response. Each draft is its own slot
//              in the global runs registry — drafts survive page navigation
//              and the slot is locked until the draft finishes so the same
//              question cannot be re-triggered while it's still running.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, MessageSquare, Loader2, Play, X } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import { use_slot_run, slot_keys } from '@/lib/runs-context';

type QaSource = 'SEC_COMMENT_LETTER' | 'HKEX_HEARING' | 'INTERNAL';

interface QaDraft {
  /** Local-only id for the queue entry (also embedded in the slot_key so
   *  parallel drafts get independent slots). */
  draft_id: string;
  source: QaSource;
  question: string;
  agent_id: string;
}

const SOURCE_TO_AGENT: Record<QaSource, string> = {
  SEC_COMMENT_LETTER: 'sec_comment_responder',
  HKEX_HEARING:       'hkex_sponsor_qa_handler',
  INTERNAL:           'ipo_director',
};

export function IpoRegulatorQa() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const [question, set_question] = useState('');
  const [source, set_source] = useState<QaSource>('SEC_COMMENT_LETTER');
  // Local list of submitted drafts. Their actual run state lives in the
  // global runs registry, keyed by slot — that's what survives navigation.
  const [drafts, set_drafts] = useState<QaDraft[]>([]);

  const submit = () => {
    if (!question.trim()) return;
    const draft_id = crypto.randomUUID();
    const agent_id = SOURCE_TO_AGENT[source];
    set_drafts(d => [{ draft_id, source, question, agent_id }, ...d]);
    set_question('');
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back_to_dashboard')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-primary" /> {t('qa.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('qa.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('qa.new_question')}</CardTitle>
          <CardDescription>{t('qa.new_question.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(['SEC_COMMENT_LETTER', 'HKEX_HEARING', 'INTERNAL'] as QaSource[]).map(s => (
              <Button
                key={s}
                size="sm"
                variant={source === s ? 'default' : 'outline'}
                onClick={() => set_source(s)}
              >
                {s} → <code className="ml-1 text-xs">{SOURCE_TO_AGENT[s]}</code>
              </Button>
            ))}
          </div>
          <Textarea
            rows={4}
            placeholder={t('qa.textarea.ph')}
            value={question}
            onChange={(e) => set_question(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={!question.trim()}>
              <Play className="h-3.5 w-3.5 mr-1" />
              {t('qa.btn.queue')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">{t('qa.queue', { n: drafts.length })}</CardTitle></CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('qa.empty')}
            </p>
          ) : (
            <ul className="space-y-3">
              {drafts.map(d => (
                <QaDraftRow
                  key={d.draft_id}
                  project_id={id || ''}
                  draft={d}
                  t={t}
                  locale={locale}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface RowProps {
  project_id: string;
  draft: QaDraft;
  t: ReturnType<typeof useT>;
  locale: 'en' | 'zh';
}

function QaDraftRow({ project_id, draft, t, locale }: RowProps) {
  // Each draft gets its own slot. We embed the draft_id in the slot suffix
  // so multiple parallel drafts (different questions, even on the same
  // agent) run independently — but the SAME draft can never be re-triggered
  // while still in flight.
  const slot_key = project_id
    ? `${slot_keys.regulator_qa(project_id, draft.agent_id)}::${draft.draft_id}`
    : `solo::${draft.agent_id}::${draft.draft_id}`;

  const run = use_slot_run({
    agent_id:   draft.agent_id,
    slot_key,
    project_id,
    module:     'regulator_qa',
    label:      `${draft.source}: ${draft.question.slice(0, 40)}${draft.question.length > 40 ? '…' : ''}`,
  });

  // Auto-submit on first mount: the moment the draft is queued we kick off
  // the run. After mount, this card behaves like the other slot-bound cards
  // (idempotent — repeat clicks while is_running just hit the dedup path).
  const start = async () => {
    if (run.is_running) return;
    const venue =
      draft.source === 'SEC_COMMENT_LETTER' ? 'US SEC' :
      draft.source === 'HKEX_HEARING'       ? 'HKEX'   : 'Internal';
    const project_label = project_id || '(no project)';
    const prompt = locale === 'zh'
      ? `针对 IPO 项目 ${project_label}，请回应来自 ${venue} 的以下问询：\n\n"""\n${draft.question}\n"""\n\n请提供：\n1) 直接、专业、可作为正式书面回复的应答；\n2) 对每条声明给出可追溯的法规/披露引用占位符；\n3) 标注还需要哪些底稿、签批或额外披露才能定稿。`
      : `For IPO project ${project_label}, draft a response to the following ${venue} inquiry:\n\n"""\n${draft.question}\n"""\n\nProvide:\n1) A direct, formal-tone draft suitable for a written response;\n2) Traceable citation placeholders for every assertion;\n3) The workpapers, sign-offs, or additional disclosures still required before this can be finalized.`;
    await run.start({ prompt, locale });
  };

  // Auto-start once on mount when nothing is bound yet. Using a one-shot
  // effect keyed on draft_id; after slot binding the registry handles
  // dedup so this is safe even on Strict-Mode double-mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useAutoStart(draft.draft_id, start, run);

  // Surface state — running / completed / failed / cancelled.
  const status_label = run.is_running    ? `DRAFTING · ${run.elapsed_s}s`
    : run.is_completed                    ? 'AWAITING_LAWYER'
    : run.is_failed                       ? 'ERROR'
    : run.is_cancelled                    ? 'CANCELLED'
    : 'PENDING';
  const status_variant = run.is_failed ? 'destructive'
    : run.is_completed ? 'default'
    : 'outline';

  return (
    <li className="p-3 rounded border space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{draft.source}</Badge>
          <code className="text-xs text-muted-foreground">{draft.agent_id}</code>
        </div>
        <Badge variant={status_variant as 'default' | 'outline' | 'destructive'}>
          {run.is_running && <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />}
          {status_label}
          {run.result && run.result.mode === 'dry_run' && ' · DRY-RUN'}
          {run.result && run.result.mode === 'live'    && ' · LIVE'}
        </Badge>
      </div>
      <p className="text-sm whitespace-pre-line">{draft.question}</p>

      <div className="flex items-center gap-2">
        {!run.is_running && !run.is_completed && (
          <Button size="sm" onClick={start}>
            <Play className="h-3.5 w-3.5 mr-1" />
            {run.is_failed || run.is_cancelled ? '重试' : '开始'}
          </Button>
        )}
        {run.is_running && (
          <Button size="sm" variant="ghost" onClick={() => { void run.cancel(); }}>
            <X className="h-3.5 w-3.5 mr-1" /> 取消
          </Button>
        )}
      </div>

      {run.is_failed && run.current?.error?.message && (
        <div className="text-xs rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive font-mono">
          {run.current.error.message}
        </div>
      )}
      {run.is_completed && run.result ? (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            {t('agents.run.provider_label')}: <code>{run.result.provider}</code> ·{' '}
            {t('agents.run.model_label')}: <code>{run.result.model}</code> · {run.result.ms_elapsed}ms
            {run.result.citation_required && <span> · 📚</span>}
          </div>
          <pre className="text-xs whitespace-pre-wrap p-2 rounded border bg-muted/30 max-h-72 overflow-y-auto">
            {run.result.output}
          </pre>
        </div>
      ) : (
        !run.is_failed && !run.is_running && (
          <p className="text-xs text-muted-foreground">
            {t('qa.awaiting')}
          </p>
        )
      )}
    </li>
  );
}

// Tiny helper hook so the auto-start effect is centralized and avoids
// re-firing on every render. Fires `start()` exactly once per draft_id when
// the slot is empty (no current run) — repeat triggers are deduplicated by
// the registry anyway, but this keeps the component clean.
import { useEffect, useRef } from 'react';
function useAutoStart(
  draft_id: string,
  start: () => Promise<void> | void,
  run: { current: unknown },
) {
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (fired.current.has(draft_id)) return;
    if (run.current) {
      // Already bound to an existing run (e.g. user navigated back); skip.
      fired.current.add(draft_id);
      return;
    }
    fired.current.add(draft_id);
    void start();
  // We deliberately depend only on draft_id — start is rebuilt every render
  // but always closes over the latest draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft_id]);
}
