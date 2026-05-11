// file: dashboard/src/pages/ipo/ProjectDashboard.tsx
// description: Project Dashboard — 7-stage progress, workstream grid,
//              risk radar, signoffs queue. Fully localized via i18n hooks.

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, ShieldCheck, AlertTriangle, FileText, Bot } from 'lucide-react';
import {
  ipo_api,
  STAGE_ORDER,
  type ProjectStage,
} from '@/lib/ipo-api';
import {
  useT,
  useStageLabel,
  useMarketLabel,
  useIndustryLabel,
  useStructureLabel,
} from '@/lib/i18n';

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-yellow-500 text-black',
  LOW: 'bg-blue-500 text-white',
  INFO: 'bg-gray-300 text-black',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-200',
  in_progress: 'bg-blue-100',
  blocked: 'bg-red-100',
  completed: 'bg-green-100',
};

export function IpoProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const stage_label = useStageLabel();
  const market_label = useMarketLabel();
  const industry_label = useIndustryLabel();
  const structure_label = useStructureLabel();

  const { data, isLoading, error } = useQuery({
    queryKey: ['ipo-project-dashboard', id],
    queryFn: () => ipo_api.get_dashboard(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6">{t('dashboard.loading')}</div>;
  if (error) return <div className="p-6 text-destructive">{t('common.failed_to_load')}: {(error as Error).message}</div>;
  if (!data) return null;

  const current_idx = STAGE_ORDER.indexOf(data.current_stage as ProjectStage);

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link to="/ipo/projects">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
        </Link>
        <div className="flex items-end justify-between mt-2 gap-4">
          <div>
            <h1 className="text-3xl font-bold">{data.project.company_legal_name}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span>{market_label(data.project.target_market)}</span>
              <span>•</span>
              <span>{industry_label(data.project.industry)}</span>
              {data.project.listing_structure && (<><span>•</span><span>{structure_label(data.project.listing_structure)}</span></>)}
              {data.project.proposed_ticker && (<><span>•</span><Badge variant="outline">{data.project.proposed_ticker}</Badge></>)}
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/ipo/projects/${id}/financial`}><Button variant="outline" size="sm">{t('dashboard.action.financial')}</Button></Link>
            <Link to={`/ipo/projects/${id}/prospectus`}><Button variant="outline" size="sm">{t('dashboard.action.prospectus')}</Button></Link>
            <Link to={`/ipo/projects/${id}/regulator-qa`}><Button variant="outline" size="sm">{t('dashboard.action.qa')}</Button></Link>
            <Link to={`/ipo/projects/${id}/valuation`}><Button variant="outline" size="sm">{t('dashboard.action.valuation')}</Button></Link>
            <Link to={`/ipo/projects/${id}/simulator`}><Button variant="outline" size="sm">{t('dashboard.action.simulator')}</Button></Link>
          </div>
        </div>
      </div>

      {/* Stage gate ribbon */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('dashboard.section.stages')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-x-auto">
            {STAGE_ORDER.map((s, i) => {
              const is_done = i < current_idx;
              const is_current = i === current_idx;
              return (
                <div key={s} className="flex-1 min-w-[120px]">
                  <div className={`h-2 rounded ${is_done ? 'bg-green-500' : is_current ? 'bg-primary' : 'bg-muted'}`} />
                  <div className={`text-xs mt-2 ${is_current ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {stage_label(s)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top-line KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard icon={<Bot className="h-5 w-5" />} label={t('dashboard.kpi.agents')}    value={data.plan_summary.total_active_agents.toString()} />
        <KpiCard icon={<FileText className="h-5 w-5" />} label={t('dashboard.kpi.workstreams')} value={data.plan_summary.total_workstreams.toString()} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label={t('dashboard.kpi.findings')}
                 value={data.findings_by_severity.reduce((s, r) => s + r.n, 0).toString()} />
        <KpiCard icon={<ShieldCheck className="h-5 w-5" />} label={t('dashboard.kpi.signoffs')} value={data.signoffs_pending.length.toString()} />
      </div>

      {/* Workstream grid + Findings/Signoffs panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">{t('dashboard.section.workstreams')}</CardTitle></CardHeader>
          <CardContent>
            {data.workstreams.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dashboard.workstreams.empty')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.workstreams.map(w => (
                  <div key={w.id} className={`p-3 rounded border ${STATUS_COLOR[w.status] ?? ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{w.workstream_type}</span>
                      <Badge variant="outline">{w.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('dashboard.workstream.lead')} {w.lead_agent_id ?? t('common.dash')}
                      {w.risk_level && <> · {t('dashboard.workstream.risk')} <span className="font-medium">{w.risk_level}</span></>}
                      {w.blocker_count > 0 && <> · <span className="text-red-600">{t('dashboard.workstream.blockers', { n: w.blocker_count })}</span></>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">{t('dashboard.section.findings')}</CardTitle></CardHeader>
            <CardContent>
              {data.findings_by_severity.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.findings.empty')}</p>
              ) : (
                <div className="space-y-1">
                  {data.findings_by_severity.map(r => (
                    <div key={r.severity} className="flex items-center justify-between text-sm">
                      <Badge className={SEVERITY_COLOR[r.severity] ?? ''}>{r.severity}</Badge>
                      <span className="font-medium">{r.n}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">{t('dashboard.section.signoffs')}</CardTitle></CardHeader>
            <CardContent>
              {data.signoffs_pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.signoffs.empty')}</p>
              ) : (
                <ul className="text-sm space-y-2">
                  {data.signoffs_pending.slice(0, 8).map(s => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span>{s.reviewer_role}</span>
                      <span className="text-xs text-muted-foreground">{new Date(s.requested_at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to={`/ipo/projects/${id}/review`}>
                <Button variant="link" className="px-0 mt-2">{t('dashboard.signoffs.view_queue')}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="p-2 rounded-md bg-primary/10 text-primary">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
