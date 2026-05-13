// file: dashboard/src/pages/ipo/ValuationLab.tsx
// description: Valuation Lab — DCF / Comps / Precedent / SOTP / Option models
//              now invoke their dedicated valuation agents through the global
//              runs context (slot per project × agent). Tasks survive page
//              navigation; the slot is locked while a model is being built so
//              the same model cannot be triggered twice in parallel.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Calculator, Loader2, Play, X } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { use_slot_run, slot_keys } from '@/lib/runs-context';

interface ModelDef { code: string; agent_id: string }

const MODELS: ModelDef[] = [
  { code: 'DCF',          agent_id: 'ipo_dcf_modeler' },
  { code: 'COMPS',        agent_id: 'ipo_comparable_company_valuator' },
  { code: 'PRECEDENT_TX', agent_id: 'ipo_precedent_transaction_analyzer' },
  { code: 'SUM_OF_PARTS', agent_id: 'ipo_valuation_lead' },
  { code: 'OPTION',       agent_id: 'ipo_valuation_lead' },
];

export function IpoValuationLab() {
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
          <Calculator className="h-8 w-8 text-primary" /> {t('val.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('val.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODELS.map(m => (
          <ValuationModelCard
            key={m.code}
            project_id={id || ''}
            model={m}
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
  model: ModelDef;
  t: ReturnType<typeof useT>;
  locale: 'en' | 'zh';
}

function ValuationModelCard({ project_id, model, t, locale }: CardProps) {
  // Slot key uniquely identifies (project × valuation agent). When the user
  // navigates away mid-build the slot stays locked and the result returns
  // here on remount via the runs registry.
  // Note: we suffix with model.code so SUM_OF_PARTS and OPTION (which share
  // the ipo_valuation_lead agent) get distinct slots — two parallel slots
  // on the same agent is allowed by design.
  const slot_key = project_id
    ? `${slot_keys.valuation(project_id, model.agent_id)}::${model.code}`
    : '';
  const name = t(`val.model.${model.code}.name` as TranslationKey);
  const desc = t(`val.model.${model.code}.desc` as TranslationKey);

  const run = use_slot_run({
    agent_id:   model.agent_id,
    slot_key,
    project_id,
    module:     'valuation',
    label:      `${model.code} · ${name}`,
  });

  const start = async () => {
    if (!project_id) return;
    const prompt = locale === 'zh'
      ? `请为 IPO 项目 ${project_id} 构建《${name}》估值模型（${model.code}）。\n\n模型定位：${desc}\n\n请输出：\n1) 关键输入与假设（如缺少数据请用合理示例并标注「[示例]」）；\n2) 估值结果与区间（含敏感性）；\n3) 与可比公司或先例交易的对照；\n4) 仍需要哪些数据或签批才能定稿。\n\n请按 Findings → Reasoning → Next Actions 输出。`
      : `Build a "${name}" valuation model (${model.code}) for IPO project ${project_id}.\n\nModel scope: ${desc}\n\nReturn:\n1) Key inputs & assumptions (use reasonable examples marked "[example]" if data is missing);\n2) Resulting valuation point and range (with sensitivity);\n3) Cross-check against comparable companies or precedent transactions;\n4) Data or sign-offs still required before finalization.\n\nStructure as Findings → Reasoning → Next Actions.`;
    await run.start({ prompt, locale });
  };

  const status_label = run.is_running    ? `${t('agents.run.button_running')} · ${run.elapsed_s}s`
    : run.is_completed && run.result?.mode === 'live'    ? t('agents.run.mode_live')
    : run.is_completed                    ? t('agents.run.mode_dry_run')
    : run.is_failed                       ? t('agents.run.error_label')
    : run.is_cancelled                    ? '已取消'
    : model.code;
  const status_variant = run.is_failed ? 'destructive'
    : run.is_completed && run.result?.mode === 'live' ? 'default'
    : 'outline';

  return (
    <Card className={run.is_completed ? 'border-primary/40' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{name}</CardTitle>
          <Badge variant={status_variant as 'default' | 'outline' | 'destructive'}>{status_label}</Badge>
        </div>
        <CardDescription>{desc}</CardDescription>
        <div className="text-xs text-muted-foreground mt-1">
          agent: <code>{model.agent_id}</code>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={start} disabled={run.is_running || !project_id}>
            {run.is_running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
            {run.is_running ? `${t('agents.run.button_running')} (${run.elapsed_s}s)` : t('val.btn.build')}
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
              {t('agents.run.provider_label')}: <code>{run.result.provider}</code> ·{' '}
              {t('agents.run.model_label')}: <code>{run.result.model}</code> · {run.result.ms_elapsed}ms
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
