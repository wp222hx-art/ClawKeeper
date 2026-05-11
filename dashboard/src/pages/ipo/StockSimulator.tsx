// file: dashboard/src/pages/ipo/StockSimulator.tsx
// description: Post-IPO Stock Price Simulator — deterministic GBM Monte-Carlo
//              client-side preview, plus a "Get AI commentary" button that
//              ships the input parameters + summary stats to the
//              ipo_stock_price_simulator agent and renders its analysis.

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, LineChart, Loader2, Play } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n';
import { ipo_api, type AgentRunResult } from '@/lib/ipo-api';

interface SimResult {
  paths: number[][];
  p10: number[];
  p50: number[];
  p90: number[];
}

function gbm_paths(s0: number, mu: number, sigma: number, days: number, n_paths: number, seed: number): SimResult {
  // Deterministic LCG so results are reproducible per seed.
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const norm = () => {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const dt = 1 / 252;
  const paths: number[][] = [];
  for (let p = 0; p < n_paths; p++) {
    const path = [s0];
    for (let t = 1; t <= days; t++) {
      const z = norm();
      const prev = path[t - 1];
      const next = prev * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
      path.push(next);
    }
    paths.push(path);
  }
  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  for (let t = 0; t <= days; t++) {
    const slice = paths.map(p => p[t]).sort((a, b) => a - b);
    p10.push(slice[Math.floor(0.1 * slice.length)]);
    p50.push(slice[Math.floor(0.5 * slice.length)]);
    p90.push(slice[Math.floor(0.9 * slice.length)]);
  }
  return { paths, p10, p50, p90 };
}

const SIM_AGENT_ID = 'ipo_stock_price_simulator';

export function IpoStockSimulator() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const [s0, set_s0] = useState(20);
  const [mu, set_mu] = useState(0.08);
  const [sigma, set_sigma] = useState(0.45);
  const [days, set_days] = useState(252);
  const [n_paths, set_n] = useState(200);
  const [ai_loading, set_ai_loading] = useState(false);
  const [ai_result, set_ai_result] = useState<AgentRunResult | null>(null);
  const [ai_error, set_ai_error] = useState<string | null>(null);

  const result = useMemo(() => gbm_paths(s0, mu, sigma, days, n_paths, 42), [s0, mu, sigma, days, n_paths]);

  // Build inline SVG sparkline for p10/p50/p90 + a sample of paths.
  const W = 760, H = 280;
  const max_y = Math.max(...result.p90, ...result.paths.flatMap(p => p)) * 1.05;
  const min_y = Math.min(...result.p10, 0);
  const x = (t: number) => (t / days) * W;
  const y = (v: number) => H - ((v - min_y) / (max_y - min_y)) * H;
  const to_path = (arr: number[]) => arr.map((v, t) => `${t === 0 ? 'M' : 'L'} ${x(t).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
  const sample_paths = result.paths.slice(0, 30);

  const ask_ai = async () => {
    set_ai_loading(true);
    set_ai_error(null);
    set_ai_result(null);
    try {
      const med  = result.p50[days].toFixed(2);
      const p10v = result.p10[days].toFixed(2);
      const p90v = result.p90[days].toFixed(2);
      const ret_med = (((result.p50[days] / s0) - 1) * 100).toFixed(1);
      const prompt = locale === 'zh'
        ? `针对 IPO 项目 ${id} 的上市后股价 Monte-Carlo 模拟，请给出专业评估。\n\n输入参数：\n- 发行价 S0 = $${s0}\n- 预期年化漂移 μ = ${(mu*100).toFixed(2)}%\n- 年化波动率 σ = ${(sigma*100).toFixed(2)}%\n- 交易日 = ${days}（约 ${(days/252).toFixed(1)} 年）\n- 路径数 = ${n_paths}（GBM）\n\n模拟结果（终值）：\n- 中位数 = $${med}（中位收益 ${ret_med}%）\n- P10 = $${p10v}\n- P90 = $${p90v}\n\n请给出：\n1) 该参数组合是否符合该行业的真实波动特征；\n2) 关键尾部风险与可能的触发事件（锁定期解禁、盈利缺失、监管事件等）；\n3) 对发行人 / 投行 / 投资者的建议；\n4) 改进模型的建议（GARCH、跳跃扩散、隐含波动率校准等）。\n\n按 Findings → Reasoning → Next Actions 输出。`
        : `Provide a professional review of this post-IPO stock-price Monte-Carlo simulation for project ${id}.\n\nInputs:\n- IPO price S0 = $${s0}\n- Drift μ = ${(mu*100).toFixed(2)}% annual\n- Volatility σ = ${(sigma*100).toFixed(2)}% annual\n- Horizon = ${days} trading days (~${(days/252).toFixed(1)} years)\n- Paths = ${n_paths} (GBM)\n\nTerminal stats:\n- Median = $${med} (median return ${ret_med}%)\n- P10 = $${p10v}\n- P90 = $${p90v}\n\nDeliver:\n1) Whether these parameters are realistic for the industry;\n2) Key tail risks and likely triggers (lockup expiry, earnings miss, regulatory events, etc.);\n3) Recommendations for the issuer / underwriter / investors;\n4) Suggestions to improve the model (GARCH, jump-diffusion, IV calibration).\n\nStructure as Findings → Reasoning → Next Actions.`;
      const { result: r } = await ipo_api.run_agent(SIM_AGENT_ID, { prompt, locale });
      set_ai_result(r);
    } catch (e) {
      set_ai_error((e as Error).message);
    } finally {
      set_ai_loading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back_to_dashboard')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <LineChart className="h-8 w-8 text-primary" /> {t('sim.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('sim.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('sim.inputs.title')}</CardTitle>
          <CardDescription>{t('sim.inputs.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <NumberField label={t('sim.field.s0')}      value={s0}      on_change={set_s0}    step={0.5} />
          <NumberField label={t('sim.field.mu')}      value={mu}      on_change={set_mu}    step={0.01} />
          <NumberField label={t('sim.field.sigma')}   value={sigma}   on_change={set_sigma} step={0.05} />
          <NumberField label={t('sim.field.days')}    value={days}    on_change={(v) => set_days(Math.round(v))} step={21} />
          <NumberField label={t('sim.field.n_paths')} value={n_paths} on_change={(v) => set_n(Math.round(v))}    step={50} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sim.chart.title')}</CardTitle>
          <CardDescription>{t('sim.chart.desc', { n: n_paths })}</CardDescription>
        </CardHeader>
        <CardContent>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full border rounded bg-muted/20">
            {sample_paths.map((p, i) => (
              <path key={i} d={to_path(p)} fill="none" stroke="currentColor"
                    strokeOpacity={0.06} strokeWidth={1} className="text-foreground" />
            ))}
            <path d={to_path(result.p10)} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" />
            <path d={to_path(result.p50)} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
            <path d={to_path(result.p90)} fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" />
          </svg>
          <div className="mt-3 text-xs flex gap-4">
            <span><span className="inline-block w-3 h-1 align-middle bg-red-500" /> {t('sim.legend.p10')}</span>
            <span><span className="inline-block w-3 h-1 align-middle bg-blue-500" /> {t('sim.legend.p50')}</span>
            <span><span className="inline-block w-3 h-1 align-middle bg-green-500" /> {t('sim.legend.p90')}</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <Stat label={t('sim.stat.median')} value={`$${result.p50[days].toFixed(2)}`} />
            <Stat label={t('sim.stat.p10')}    value={`$${result.p10[days].toFixed(2)}`} />
            <Stat label={t('sim.stat.p90')}    value={`$${result.p90[days].toFixed(2)}`} />
          </div>
        </CardContent>
      </Card>

      <Card className={ai_result ? 'border-primary/40' : ''}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg">{t('sim.ai.title')}</CardTitle>
              <CardDescription>{t('sim.ai.desc')}</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">agent: <code className="ml-1">{SIM_AGENT_ID}</code></Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={ask_ai} disabled={ai_loading}>
            {ai_loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
            {ai_loading ? t('agents.run.button_running') : t('sim.ai.button')}
          </Button>
          {ai_error && (
            <div className="text-xs rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive font-mono">
              {ai_error}
            </div>
          )}
          {ai_result && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={ai_result.mode === 'live' ? 'default' : 'outline'}>
                  {ai_result.mode === 'live' ? t('agents.run.mode_live') : t('agents.run.mode_dry_run')}
                </Badge>
                <span className="text-muted-foreground">
                  {t('agents.run.provider_label')}: <code>{ai_result.provider}</code> ·{' '}
                  {t('agents.run.model_label')}: <code>{ai_result.model}</code> ·{' '}
                  {ai_result.ms_elapsed}ms
                </span>
              </div>
              <pre className="text-xs whitespace-pre-wrap p-3 rounded border bg-muted/30 max-h-72 overflow-y-auto">
                {ai_result.output}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({ label, value, on_change, step }: { label: string; value: number; on_change: (v: number) => void; step: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step={step} value={value}
             onChange={(e) => on_change(Number(e.target.value))} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
