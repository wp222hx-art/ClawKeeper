// file: dashboard/src/pages/ipo/FinancialDiagnosis.tsx
// description: Financial Diagnosis workspace — each analysis card invokes the
//              corresponding ipo_*_analyzer agent through the global runs
//              context (slot-key per project × agent). Tasks survive page
//              navigation; the slot is locked until the run finishes so the
//              same analysis cannot be triggered twice in parallel.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, TrendingUp, Loader2, Play, X } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { use_slot_run, slot_keys } from '@/lib/runs-context';

interface AnalysisDef { code: string; agent_id: string }

const ANALYSES: AnalysisDef[] = [
  { code: 'revenue_quality',          agent_id: 'ipo_revenue_quality_analyzer' },
  { code: 'pl_diagnosis',             agent_id: 'ipo_pl_diagnostician' },
  { code: 'balance_sheet_diagnosis',  agent_id: 'ipo_balance_sheet_diagnostician' },
  { code: 'cash_flow_analysis',       agent_id: 'ipo_cash_flow_analyst' },
  { code: 'capital_efficiency',       agent_id: 'ipo_capital_efficiency_analyzer' },
  { code: 'working_capital',          agent_id: 'ipo_working_capital_analyzer' },
  { code: 'kpi_tracking',             agent_id: 'ipo_kpi_tracker' },
];

export function IpoFinancialDiagnosis() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back_to_dashboard')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" /> {t('fin.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('fin.subtitle')}
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <strong>{t('fin.copilot.title')}</strong> {t('fin.copilot.desc')}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ANALYSES.map(a => (
          <FinancialAnalysisCard
            key={a.code}
            project_id={id || ''}
            def={a}
            t={t}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  project_id: string;
  def: AnalysisDef;
  t: ReturnType<typeof useT>;
  locale: 'en' | 'zh';
}

function FinancialAnalysisCard({ project_id, def, t, locale }: CardProps) {
  // Bind the slot — this card now reads/writes through the global runs
  // registry. Even when the user leaves this page mid-generation, the slot
  // stays locked and the result will be here when they come back.
  const slot_key = project_id ? slot_keys.financial(project_id, def.agent_id) : '';
  const name = t(`fin.an.${def.code}.name` as TranslationKey);
  const desc = t(`fin.an.${def.code}.desc` as TranslationKey);

  const run = use_slot_run({
    agent_id:   def.agent_id,
    slot_key,
    project_id,
    module:     'financial',
    label:      name,
  });

  const start = async () => {
    if (!project_id) return;
    const prompt = locale === 'zh'
      ? `请针对 IPO 项目 ${project_id} 执行《${name}》分析。\n\n分析目标：${desc}\n\n请按 Findings → Reasoning → Next Actions 输出结构化结论；如缺少具体数据，请基于行业基准给出合理示例。`
      : `Run a "${name}" analysis for IPO project ${project_id}.\n\nObjective: ${desc}\n\nReturn a structured Findings → Reasoning → Next-Actions output. If concrete data is missing, illustrate with industry benchmarks.`;
    await run.start({ prompt, locale });
  };

  const status_label = run.is_running    ? `${t('fin.status.running')} · ${run.elapsed_s}s`
    : run.is_completed && run.result?.mode === 'live'    ? t('agents.run.mode_live')
    : run.is_completed                    ? t('agents.run.mode_dry_run')
    : run.is_failed                       ? t('agents.run.error_label')
    : run.is_cancelled                    ? '已取消'
    : t('fin.status.idle');
  const status_variant = run.is_failed ? 'destructive'
    : run.is_completed && run.result?.mode === 'live' ? 'default'
    : 'outline';

  return (
    <Card className={run.is_completed ? 'border-primary/40' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{name}</CardTitle>
          <Badge variant={status_variant as 'default' | 'outline' | 'destructive'}>{status_label}</Badge>
        </div>
        <CardDescription>{desc}</CardDescription>
        <div className="text-xs text-muted-foreground mt-1">
          agent: <code>{def.agent_id}</code>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={start} disabled={run.is_running || !project_id}>
            {run.is_running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
            {run.is_running ? `${t('agents.run.button_running')} (${run.elapsed_s}s)` : t('fin.btn.run')}
          </Button>
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
        {run.is_completed && run.result && (
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">
              {t('agents.run.provider_label')}: <code>{run.result.provider}</code> · {t('agents.run.model_label')}: <code>{run.result.model}</code> · {run.result.ms_elapsed}ms
            </div>
            <pre className="text-xs whitespace-pre-wrap p-2 rounded border bg-muted/30 max-h-60 overflow-y-auto">
              {run.result.output}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
