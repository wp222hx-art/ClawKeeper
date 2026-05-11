// file: dashboard/src/pages/ipo/ValuationLab.tsx
// description: Valuation Lab — DCF / Comps / Precedent / SOTP / Option models
//              now invoke their dedicated valuation agents through
//              /api/ipo/agents/:id/run, returning structured findings + a
//              valuation range.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Calculator, Loader2, Play } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { ipo_api, type AgentRunResult } from '@/lib/ipo-api';

interface ModelDef { code: string; agent_id: string }

const MODELS: ModelDef[] = [
  { code: 'DCF',          agent_id: 'ipo_dcf_modeler' },
  { code: 'COMPS',        agent_id: 'ipo_comparable_company_valuator' },
  { code: 'PRECEDENT_TX', agent_id: 'ipo_precedent_transaction_analyzer' },
  { code: 'SUM_OF_PARTS', agent_id: 'ipo_valuation_lead' },
  { code: 'OPTION',       agent_id: 'ipo_valuation_lead' },
];

interface RunState { loading: boolean; result?: AgentRunResult; error?: string }

export function IpoValuationLab() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const [runs, set_runs] = useState<Record<string, RunState>>({});

  const build = async (m: ModelDef) => {
    set_runs(r => ({ ...r, [m.code]: { loading: true } }));
    try {
      const name = t(`val.model.${m.code}.name` as TranslationKey);
      const desc = t(`val.model.${m.code}.desc` as TranslationKey);
      const prompt = locale === 'zh'
        ? `请为 IPO 项目 ${id} 构建《${name}》估值模型（${m.code}）。\n\n模型定位：${desc}\n\n请输出：\n1) 关键输入与假设（如缺少数据请用合理示例并标注「[示例]」）；\n2) 估值结果与区间（含敏感性）；\n3) 与可比公司或先例交易的对照；\n4) 仍需要哪些数据或签批才能定稿。\n\n请按 Findings → Reasoning → Next Actions 输出。`
        : `Build a "${name}" valuation model (${m.code}) for IPO project ${id}.\n\nModel scope: ${desc}\n\nReturn:\n1) Key inputs & assumptions (use reasonable examples marked "[example]" if data is missing);\n2) Resulting valuation point and range (with sensitivity);\n3) Cross-check against comparable companies or precedent transactions;\n4) Data or sign-offs still required before finalization.\n\nStructure as Findings → Reasoning → Next Actions.`;
      const { result } = await ipo_api.run_agent(m.agent_id, { prompt, locale });
      set_runs(r => ({ ...r, [m.code]: { loading: false, result } }));
    } catch (e) {
      set_runs(r => ({ ...r, [m.code]: { loading: false, error: (e as Error).message } }));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back_to_dashboard')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-8 w-8 text-primary" /> {t('val.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('val.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODELS.map(m => {
          const r = runs[m.code];
          const status_label = r?.loading ? t('agents.run.button_running')
            : r?.result   ? (r.result.mode === 'live' ? t('agents.run.mode_live') : t('agents.run.mode_dry_run'))
            : r?.error    ? t('agents.run.error_label')
            : m.code;
          const status_variant = r?.error ? 'destructive' : r?.result?.mode === 'live' ? 'default' : 'outline';
          return (
            <Card key={m.code} className={r?.result ? 'border-primary/40' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{t(`val.model.${m.code}.name` as TranslationKey)}</CardTitle>
                  <Badge variant={status_variant as 'default' | 'outline' | 'destructive'}>{status_label}</Badge>
                </div>
                <CardDescription>{t(`val.model.${m.code}.desc` as TranslationKey)}</CardDescription>
                <div className="text-xs text-muted-foreground mt-1">
                  agent: <code>{m.agent_id}</code>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button size="sm" onClick={() => build(m)} disabled={r?.loading}>
                  {r?.loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                  {r?.loading ? t('agents.run.button_running') : t('val.btn.build')}
                </Button>
                {r?.error && (
                  <div className="text-xs rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive font-mono">
                    {r.error}
                  </div>
                )}
                {r?.result && (
                  <div className="space-y-1.5">
                    <div className="text-xs text-muted-foreground">
                      {t('agents.run.provider_label')}: <code>{r.result.provider}</code> ·{' '}
                      {t('agents.run.model_label')}: <code>{r.result.model}</code> · {r.result.ms_elapsed}ms
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
