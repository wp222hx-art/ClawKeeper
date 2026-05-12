// file: dashboard/src/pages/ipo/ProspectusDrafter.tsx
// description: Prospectus Drafter — each section invokes the matching drafting
//              agent through /api/ipo/agents/:id/run. The request now also
//              passes target_market + prospectus_section so the backend's
//              Prospectus Format Standards (PFS) registry injects the correct
//              jurisdiction-specific format requirements (Reg S-K items, HKEX
//              App.1A anchors, mandatory disclosure phrases, required
//              subheadings, word-count floors) into the agent's system prompt
//              and lints the output for compliance. The result panel renders
//              both the draft and the PFS compliance report (score, missing
//              subheadings, required-element coverage, disclosure coverage,
//              gaps reported by the model itself).

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, FileText, Loader2, Play, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useT, useLocale, useMarketLabel } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';
import { ipo_api, type AgentRunResult, type PfsReport, type TargetMarket } from '@/lib/ipo-api';

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

// Map UI group → the canonical TargetMarket used by the PFS registry.
// SEC group: default to NASDAQ_GS (most stringent SEC tier; standards are
// shared across all SEC venues anyway). HKEX group: default to HKEX_MAIN.
// If the project has its own target_market, prefer that.
function pick_target_market(group: 'sec' | 'hkex', project_market: TargetMarket | undefined): TargetMarket {
  if (group === 'sec') {
    if (project_market && project_market.startsWith('SEC_')) return project_market;
    return 'SEC_NASDAQ_GS';
  }
  if (project_market === 'HKEX_GEM') return 'HKEX_GEM';
  return 'HKEX_MAIN';
}

export function IpoProspectusDrafter() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const market_label = useMarketLabel();
  const [runs, set_runs] = useState<Record<string, RunState>>({});
  const [open, set_open] = useState<string | null>(null);

  // Pull the project so we know the user's chosen target_market.
  const { data: project_data } = useQuery({
    queryKey: ['ipo-project', id],
    queryFn: () => ipo_api.get_project(id!),
    enabled: !!id,
  });
  const project_market = project_data?.project.target_market;

  const run_section = async (group: 'sec' | 'hkex', s: SectionEntry) => {
    const key = `${group}:${s.code}`;
    set_runs(r => ({ ...r, [key]: { loading: true } }));
    set_open(key);
    try {
      const target_market = pick_target_market(group, project_market);
      const section_label = t(s.name_key);
      const venue_label = market_label(target_market);
      const prompt = locale === 'zh'
        ? `请为 IPO 项目 ${id} 起草招股说明书的「${section_label}」章节。\n\n上市地：${venue_label}（${target_market}）\n监管引用：${s.ref}\n\n你必须严格遵守上方「格式标准（强制约束）」中列出的所有要求：必备子节标题、必备要素、强制披露语句、字数要求与引用要求。如果缺少公司具体数据，请用合理示例数据填充并明确标注「[示例]」；不可虚构关键披露事实。\n\n⚠️ Token 预算分配（硬性要求）：\n1. 你的总输出预算约为 12000 token。\n2. 必须为末尾的 \`\`\`json 合规信封预留至少 600 token，信封不可省略。\n3. 如果正文预算紧张，请压缩每条要素的描述长度，但禁止删减必备子节标题或必备要素。\n4. 写完正文后立即输出 \`\`\`json 信封，不要任何客套话。\n\n输出顺序：Markdown 章节正文（按必备子节标题分节）→ 空行 → \`\`\`json 信封 → \`\`\` 结束。`
        : `Draft the "${section_label}" section of the prospectus for IPO project ${id}.\n\nVenue: ${venue_label} (${target_market})\nRegulatory anchor: ${s.ref}\n\nYou MUST strictly conform to the "Format Standard (binding)" block above: produce every required subheading in order, cover every required element, include the mandatory disclosure language, hit the word-count band, and cite the listed authorities. Where concrete company data is missing, fill with reasonable examples clearly marked "[example]" — do NOT fabricate key disclosure facts.\n\n⚠️ Token budget allocation (hard requirement):\n1. Your total output budget is ~12000 tokens.\n2. You MUST reserve at least 600 tokens at the very end for the \`\`\`json compliance envelope. The envelope is non-optional and is parsed by the PFS linter.\n3. If the body budget is tight, compress per-element prose — but NEVER drop a required subheading or required element.\n4. Immediately after the body, emit the \`\`\`json envelope. No closing pleasantries.\n\nOutput order: Markdown body (under the required subheadings) → blank line → \`\`\`json envelope → closing \`\`\`.`;
      const { result } = await ipo_api.run_agent(s.agent_id, {
        prompt,
        locale,
        target_market,
        prospectus_section: s.code,
        // Long-form sections (risk_factors, mdna, business) need ~6000-25000
        // words to satisfy the PFS word-count band. 12000 tokens gives the
        // model headroom for ~7000-8000 words of body PLUS the mandatory JSON
        // compliance envelope at the end (which the linter parses for score).
        // The prompt also explicitly reserves >=600 tokens for the envelope so
        // the model doesn't blow its budget on prose and drop the envelope.
        max_tokens: 12000,
      });
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
        {project_market && (
          <div className="mt-2 text-xs text-muted-foreground">
            {locale === 'zh' ? '项目上市地：' : 'Project listing venue: '}
            <code className="px-1.5 py-0.5 rounded bg-muted">{project_market}</code> · {market_label(project_market)}
            <span className="ml-2 text-muted-foreground/70">
              {locale === 'zh'
                ? '— 起草请求会自动注入对应的 PFS 格式标准。'
                : '— PFS format standards will be injected automatically into each draft request.'}
            </span>
          </div>
        )}
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
                  {r?.result?.pfs_report && (
                    <PfsScoreBadge score={r.result.pfs_report.compliance_score} />
                  )}
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
                <div className="px-3 pb-3 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {t('agents.run.provider_label')}: <code>{r.result.provider}</code> ·{' '}
                    {t('agents.run.model_label')}: <code>{r.result.model}</code> · {r.result.ms_elapsed}ms
                    {r.result.citation_required && <span> · 📚</span>}
                  </div>
                  {r.result.pfs_report && <PfsReportPanel report={r.result.pfs_report} />}
                  <pre className="text-xs whitespace-pre-wrap p-2 rounded border bg-muted/30 max-h-72 overflow-y-auto">
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

// ---------------------------------------------------------------------------
// PFS UI components
// ---------------------------------------------------------------------------

function PfsScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85 ? 'bg-green-600 text-white'
    : score >= 65 ? 'bg-yellow-500 text-black'
    : 'bg-red-600 text-white';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-mono ${tone}`}>
      <ShieldCheck className="h-3 w-3" /> PFS {score}
    </span>
  );
}

function PfsReportPanel({ report }: { report: PfsReport }) {
  const { locale } = useLocale();
  const zh = locale === 'zh';
  const wc_band = report.word_count_min || report.word_count_max
    ? `${report.word_count_min ?? 0}–${report.word_count_max ?? '∞'}`
    : '—';
  return (
    <div className="rounded border bg-card p-2 space-y-1.5 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          {zh ? 'PFS 合规校验' : 'PFS Compliance Report'}
        </span>
        <PfsScoreBadge score={report.compliance_score} />
        <code className="text-[10px] px-1 py-0.5 rounded bg-muted">{report.target_market}</code>
        <span className="text-muted-foreground text-[10px]">{report.statutory_anchor}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px]">
        <Metric
          label={zh ? '子节标题' : 'Subheadings'}
          value={`${report.subheadings_present.length}/${report.required_subheadings.length}`}
          ok={report.subheadings_missing.length === 0}
        />
        <Metric
          label={zh ? '必备要素' : 'Elements'}
          value={`${report.required_elements_covered}/${report.required_elements_total}`}
          ok={report.required_elements_covered === report.required_elements_total}
        />
        <Metric
          label={zh ? '强制披露' : 'Disclosures'}
          value={`${report.mandatory_disclosures_covered}/${report.mandatory_disclosures_total}`}
          ok={report.mandatory_disclosures_covered === report.mandatory_disclosures_total}
        />
        <Metric
          label={zh ? `字数 (${wc_band})` : `Words (${wc_band})`}
          value={String(report.word_count)}
          ok={report.word_count_ok}
        />
      </div>

      {report.subheadings_missing.length > 0 && (
        <div className="text-[11px]">
          <div className="text-muted-foreground mb-0.5">
            {zh ? '缺失子节：' : 'Missing subheadings:'}
          </div>
          <ul className="list-disc list-inside text-destructive">
            {report.subheadings_missing.slice(0, 6).map(h => <li key={h}>{h}</li>)}
            {report.subheadings_missing.length > 6 && (
              <li className="text-muted-foreground">… +{report.subheadings_missing.length - 6}</li>
            )}
          </ul>
        </div>
      )}

      {report.parsed_envelope_gaps.length > 0 && (
        <div className="text-[11px]">
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 mb-0.5">
            <AlertTriangle className="h-3 w-3" />
            {zh ? '模型自报缺口（gaps）：' : 'Model-reported gaps:'}
          </div>
          <ul className="list-disc list-inside">
            {report.parsed_envelope_gaps.slice(0, 6).map((g, i) => <li key={i}>{g}</li>)}
            {report.parsed_envelope_gaps.length > 6 && (
              <li className="text-muted-foreground">… +{report.parsed_envelope_gaps.length - 6}</li>
            )}
          </ul>
        </div>
      )}

      {report.lint_violations.length > 0 && (
        <div className="text-[11px]">
          <div className="text-muted-foreground mb-0.5">
            {zh ? '校验器违规：' : 'Linter violations:'}
          </div>
          <ul className="list-disc list-inside text-destructive">
            {report.lint_violations.slice(0, 4).map((v, i) => <li key={i}>{v}</li>)}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground">
        {zh ? 'JSON 合规信封：' : 'JSON envelope:'}{' '}
        {report.json_envelope_present
          ? <span className="text-green-700">✓</span>
          : <span className="text-destructive">✗ {zh ? '未检测到' : 'not detected'}</span>}
      </div>
    </div>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`rounded px-1.5 py-1 ${ok ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
      <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`font-mono ${ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
        {value}
      </div>
    </div>
  );
}
