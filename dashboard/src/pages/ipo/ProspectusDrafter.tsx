// file: dashboard/src/pages/ipo/ProspectusDrafter.tsx
// description: Prospectus Drafter — each section now invokes the matching
//              drafting agent through /api/ipo/agents/:id/run so users get a
//              real (or dry-run) draft per section. SEC sections route to
//              specialized SEC drafters; HKEX sections route to hkex_a1_drafter
//              with section-specific framing, except ESG which routes to
//              hkex_esg_disclosure_drafter.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, FileText, Loader2, Play } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { ipo_api, type AgentRunResult } from '@/lib/ipo-api';

interface SectionEntry { code: string; name_key: TranslationKey; ref: string; agent_id: string }

const SEC_SECTIONS: SectionEntry[] = [
  { code: 'cover',             name_key: 'prosp.sec.cover',             ref: 'Item 501',              agent_id: 'sec_s1_drafter' },
  { code: 'summary',           name_key: 'prosp.sec.summary',           ref: 'Item 503',              agent_id: 'sec_s1_drafter' },
  { code: 'risk_factors',      name_key: 'prosp.sec.risk_factors',      ref: 'Item 105 / Item 503(c)', agent_id: 'ipo_risk_factors_drafter' },
  { code: 'use_of_proceeds',   name_key: 'prosp.sec.use_of_proceeds',   ref: 'Item 504',              agent_id: 'ipo_use_of_proceeds_drafter' },
  { code: 'mdna',              name_key: 'prosp.sec.mdna',              ref: 'Item 303',              agent_id: 'ipo_mdna_drafter' },
  { code: 'business',          name_key: 'prosp.sec.business',          ref: 'Item 101',              agent_id: 'ipo_business_section_drafter' },
  { code: 'management',        name_key: 'prosp.sec.management',        ref: 'Item 401-402',          agent_id: 'sec_s1_drafter' },
  { code: 'related_party',     name_key: 'prosp.sec.related_party',     ref: 'Item 404',              agent_id: 'ipo_related_party_tx_reviewer' },
  { code: 'principal_holders', name_key: 'prosp.sec.principal_holders', ref: 'Item 403',              agent_id: 'sec_s1_drafter' },
  { code: 'financials',        name_key: 'prosp.sec.financials',        ref: 'Reg S-X',               agent_id: 'sec_regsk_checker' },
];

const HKEX_SECTIONS: SectionEntry[] = [
  { code: 'summary',             name_key: 'prosp.hkex.summary',             ref: 'App.1A.6',     agent_id: 'hkex_a1_drafter' },
  { code: 'risk_factors',        name_key: 'prosp.hkex.risk_factors',        ref: 'App.1A.40',    agent_id: 'ipo_risk_factors_drafter' },
  { code: 'business',            name_key: 'prosp.hkex.business',            ref: 'App.1A.28',    agent_id: 'ipo_business_section_drafter' },
  { code: 'industry',            name_key: 'prosp.hkex.industry',            ref: 'App.1A.31',    agent_id: 'ipo_competitive_positioner' },
  { code: 'connected',           name_key: 'prosp.hkex.connected',           ref: 'Ch. 14A',      agent_id: 'hkex_connected_tx_analyzer' },
  { code: 'mdna',                name_key: 'prosp.hkex.mdna',                ref: 'App.1A.32-33', agent_id: 'ipo_mdna_drafter' },
  { code: 'directors',           name_key: 'prosp.hkex.directors',           ref: 'App.1A.41',    agent_id: 'hkex_a1_drafter' },
  { code: 'use_of_proceeds',     name_key: 'prosp.hkex.use_of_proceeds',     ref: 'App.1A.48',    agent_id: 'ipo_use_of_proceeds_drafter' },
  { code: 'esg',                 name_key: 'prosp.hkex.esg',                 ref: 'App.27',       agent_id: 'hkex_esg_disclosure_drafter' },
  { code: 'accountants_report',  name_key: 'prosp.hkex.accountants_report',  ref: 'Ch. 4',        agent_id: 'hkex_track_record_validator' },
];

interface RunState { loading: boolean; result?: AgentRunResult; error?: string }

export function IpoProspectusDrafter() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const [runs, set_runs] = useState<Record<string, RunState>>({});
  const [open, set_open] = useState<string | null>(null);

  const run_section = async (group: 'sec' | 'hkex', s: SectionEntry) => {
    const key = `${group}:${s.code}`;
    set_runs(r => ({ ...r, [key]: { loading: true } }));
    set_open(key);
    try {
      const section_label = t(s.name_key);
      const venue = group === 'sec' ? 'US SEC (S-1/F-1)' : 'HKEX Main Board';
      const prompt = locale === 'zh'
        ? `请为 IPO 项目 ${id} 起草招股说明书的「${section_label}」章节。\n\n上市地：${venue}\n监管引用：${s.ref}\n\n请输出符合该法规章节要求的初稿，并对每条声明附带可追溯的引用占位符。如果缺少公司具体数据，请用合理的示例数据填充并明确标注「[示例]」。请按 Findings → Reasoning → Next Actions 结构输出。`
        : `Draft the "${section_label}" section of the prospectus for IPO project ${id}.\n\nVenue: ${venue}\nRegulatory anchor: ${s.ref}\n\nReturn a compliant first draft. Attach traceable citation placeholders to every assertion. If concrete company data is missing, fill with reasonable examples clearly marked "[example]". Structure as Findings → Reasoning → Next Actions.`;
      const { result } = await ipo_api.run_agent(s.agent_id, { prompt, locale });
      set_runs(r => ({ ...r, [key]: { loading: false, result } }));
    } catch (e) {
      set_runs(r => ({ ...r, [key]: { loading: false, error: (e as Error).message } }));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back_to_dashboard')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" /> {t('prosp.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('prosp.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionGroup
          title={t('prosp.group.sec')}
          group="sec"
          sections={SEC_SECTIONS}
          runs={runs}
          open={open}
          set_open={set_open}
          on_run={run_section}
        />
        <SectionGroup
          title={t('prosp.group.hkex')}
          group="hkex"
          sections={HKEX_SECTIONS}
          runs={runs}
          open={open}
          set_open={set_open}
          on_run={run_section}
        />
      </div>
    </div>
  );
}

function SectionGroup({
  title, group, sections, runs, open, set_open, on_run,
}: {
  title: string;
  group: 'sec' | 'hkex';
  sections: SectionEntry[];
  runs: Record<string, RunState>;
  open: string | null;
  set_open: (k: string | null) => void;
  on_run: (group: 'sec' | 'hkex', s: SectionEntry) => void;
}) {
  const t = useT();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sections.map(s => {
          const key = `${group}:${s.code}`;
          const r = runs[key];
          const is_open = open === key;
          const status_label = r?.loading ? t('agents.run.button_running')
            : r?.result   ? (r.result.mode === 'live' ? t('agents.run.mode_live') : t('agents.run.mode_dry_run'))
            : r?.error    ? t('agents.run.error_label')
            : t('prosp.status.not_started');
          const status_variant = r?.error ? 'destructive' : r?.result?.mode === 'live' ? 'default' : 'outline';
          return (
            <div key={s.code} className="rounded border">
              <div className="flex items-center justify-between p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{t(s.name_key)}</div>
                  <div className="text-xs text-muted-foreground">{s.ref} · <code>{s.agent_id}</code></div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={status_variant as 'default' | 'outline' | 'destructive'}>{status_label}</Badge>
                  <Button size="sm" disabled={r?.loading} onClick={() => on_run(group, s)}>
                    {r?.loading
                      ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      : <Play className="h-3.5 w-3.5 mr-1" />}
                    {t('prosp.btn.draft')}
                  </Button>
                  {(r?.result || r?.error) && (
                    <Button size="sm" variant="ghost" onClick={() => set_open(is_open ? null : key)}>
                      {is_open ? '−' : '+'}
                    </Button>
                  )}
                </div>
              </div>
              {is_open && r?.error && (
                <div className="px-3 pb-3">
                  <div className="text-xs rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive font-mono">
                    {r.error}
                  </div>
                </div>
              )}
              {is_open && r?.result && (
                <div className="px-3 pb-3 space-y-1.5">
                  <div className="text-xs text-muted-foreground">
                    {t('agents.run.provider_label')}: <code>{r.result.provider}</code> ·{' '}
                    {t('agents.run.model_label')}: <code>{r.result.model}</code> · {r.result.ms_elapsed}ms
                    {r.result.citation_required && <span> · 📚</span>}
                  </div>
                  <pre className="text-xs whitespace-pre-wrap p-2 rounded border bg-muted/30 max-h-60 overflow-y-auto">
                    {r.result.output}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
