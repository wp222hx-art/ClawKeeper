// file: dashboard/src/pages/ipo/FinancialDiagnosis.tsx
// description: Financial Diagnosis workspace — each analysis card invokes the
//              corresponding ipo_*_analyzer agent through /api/ipo/agents/:id/run
//              so users get real (or dry-run) AI output per analysis.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, TrendingUp, Loader2, Play } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { ipo_api, type AgentRunResult } from '@/lib/ipo-api';

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

interface RunState { loading: boolean; result?: AgentRunResult; error?: string }

export function IpoFinancialDiagnosis() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const [runs, set_runs] = useState<Record<string, RunState>>({});

  const run_one = async (def: AnalysisDef) => {
    set_runs(r => ({ ...r, [def.code]: { loading: true } }));
    try {
      const name = t(`fin.an.${def.code}.name` as TranslationKey);
      const desc = t(`fin.an.${def.code}.desc` as TranslationKey);
      const prompt = locale === 'zh'
        ? `请针对 IPO 项目 ${id} 执行《${name}》分析。\n\n分析目标：${desc}\n\n请按 Findings → Reasoning → Next Actions 输出结构化结论；如缺少具体数据，请基于行业基准给出合理示例。`
        : `Run a "${name}" analysis for IPO project ${id}.\n\nObjective: ${desc}\n\nReturn a structured Findings → Reasoning → Next-Actions output. If concrete data is missing, illustrate with industry benchmarks.`;
      const { result } = await ipo_api.run_agent(def.agent_id, { prompt, locale });
      set_runs(r => ({ ...r, [def.code]: { loading: false, result } }));
    } catch (e) {
      set_runs(r => ({ ...r, [def.code]: { loading: false, error: (e as Error).message } }));
    }
  };

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
        {ANALYSES.map(a => {
          const r = runs[a.code];
          const status_label = r?.loading ? t('fin.status.running')
            : r?.result   ? (r.result.mode === 'live' ? t('agents.run.mode_live') : t('agents.run.mode_dry_run'))
            : r?.error    ? t('agents.run.error_label')
            : t('fin.status.idle');
          const status_variant = r?.error ? 'destructive' : r?.result?.mode === 'live' ? 'default' : 'outline';
          return (
            <Card key={a.code} className={r?.result ? 'border-primary/40' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{t(`fin.an.${a.code}.name` as TranslationKey)}</CardTitle>
                  <Badge variant={status_variant as 'default' | 'outline' | 'destructive'}>{status_label}</Badge>
                </div>
                <CardDescription>{t(`fin.an.${a.code}.desc` as TranslationKey)}</CardDescription>
                <div className="text-xs text-muted-foreground mt-1">
                  agent: <code>{a.agent_id}</code>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button size="sm" onClick={() => run_one(a)} disabled={r?.loading}>
                  {r?.loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                  {r?.loading ? t('agents.run.button_running') : t('fin.btn.run')}
                </Button>
                {r?.error && (
                  <div className="text-xs rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive font-mono">
                    {r.error}
                  </div>
                )}
                {r?.result && (
                  <div className="space-y-1.5">
                    <div className="text-xs text-muted-foreground">
                      {t('agents.run.provider_label')}: <code>{r.result.provider}</code> · {t('agents.run.model_label')}: <code>{r.result.model}</code> · {r.result.ms_elapsed}ms
                    </div>
                    <pre className="text-xs whitespace-pre-wrap p-2 rounded border bg-muted/30 max-h-60 overflow-y-auto">
                      {r.result.output}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
