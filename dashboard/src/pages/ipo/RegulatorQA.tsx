// file: dashboard/src/pages/ipo/RegulatorQA.tsx
// description: Regulator Q&A workspace — paste an SEC comment-letter or HKEX
//              hearing question, route it to the matching responder agent
//              (sec_comment_responder / hkex_sponsor_qa_handler / ipo_director),
//              and surface a cited draft response. Live or dry-run, depending
//              on whether an AI provider is registered.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, MessageSquare, Loader2, Play } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import { ipo_api, type AgentRunResult } from '@/lib/ipo-api';

type QaSource = 'SEC_COMMENT_LETTER' | 'HKEX_HEARING' | 'INTERNAL';

interface QaDraft {
  id: string;
  source: QaSource;
  question: string;
  agent_id: string;
  status: 'PENDING' | 'DRAFTING' | 'AWAITING_LAWYER' | 'ERROR';
  result?: AgentRunResult;
  error?: string;
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
  const [drafts, set_drafts] = useState<QaDraft[]>([]);

  const submit = async () => {
    if (!question.trim()) return;
    const draft_id = crypto.randomUUID();
    const agent_id = SOURCE_TO_AGENT[source];
    const new_draft: QaDraft = {
      id: draft_id,
      source,
      question,
      agent_id,
      status: 'DRAFTING',
    };
    set_drafts(d => [new_draft, ...d]);
    set_question('');

    try {
      const venue =
        source === 'SEC_COMMENT_LETTER' ? 'US SEC' :
        source === 'HKEX_HEARING'       ? 'HKEX'   : 'Internal';
      const prompt = locale === 'zh'
        ? `针对 IPO 项目 ${id}，请回应来自 ${venue} 的以下问询：\n\n"""\n${new_draft.question}\n"""\n\n请提供：\n1) 直接、专业、可作为正式书面回复的应答；\n2) 对每条声明给出可追溯的法规/披露引用占位符；\n3) 标注还需要哪些底稿、签批或额外披露才能定稿。`
        : `For IPO project ${id}, draft a response to the following ${venue} inquiry:\n\n"""\n${new_draft.question}\n"""\n\nProvide:\n1) A direct, formal-tone draft suitable for a written response;\n2) Traceable citation placeholders for every assertion;\n3) The workpapers, sign-offs, or additional disclosures still required before this can be finalized.`;
      const { result } = await ipo_api.run_agent(agent_id, { prompt, locale });
      set_drafts(d => d.map(x => x.id === draft_id
        ? { ...x, status: 'AWAITING_LAWYER', result }
        : x));
    } catch (e) {
      set_drafts(d => d.map(x => x.id === draft_id
        ? { ...x, status: 'ERROR', error: (e as Error).message }
        : x));
    }
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
                <li key={d.id} className="p-3 rounded border space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{d.source}</Badge>
                      <code className="text-xs text-muted-foreground">{d.agent_id}</code>
                    </div>
                    <Badge
                      variant={
                        d.status === 'ERROR'           ? 'destructive' :
                        d.status === 'AWAITING_LAWYER' ? 'default'     : 'outline'
                      }
                    >
                      {d.status === 'DRAFTING' && <Loader2 className="h-3 w-3 mr-1 animate-spin inline" />}
                      {d.status}
                      {d.result && d.result.mode === 'dry_run' && ' · DRY-RUN'}
                      {d.result && d.result.mode === 'live'    && ' · LIVE'}
                    </Badge>
                  </div>
                  <p className="text-sm whitespace-pre-line">{d.question}</p>
                  {d.error && (
                    <div className="text-xs rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive font-mono">
                      {d.error}
                    </div>
                  )}
                  {d.result ? (
                    <div className="space-y-1.5">
                      <div className="text-xs text-muted-foreground">
                        {t('agents.run.provider_label')}: <code>{d.result.provider}</code> ·{' '}
                        {t('agents.run.model_label')}: <code>{d.result.model}</code> · {d.result.ms_elapsed}ms
                        {d.result.citation_required && <span> · 📚</span>}
                      </div>
                      <pre className="text-xs whitespace-pre-wrap p-2 rounded border bg-muted/30 max-h-72 overflow-y-auto">
                        {d.result.output}
                      </pre>
                    </div>
                  ) : (
                    !d.error && (
                      <p className="text-xs text-muted-foreground">
                        {t('qa.awaiting')}
                      </p>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
