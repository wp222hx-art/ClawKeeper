// file: dashboard/src/pages/ipo/StockSimulator.tsx
// description: Post-IPO Stock Price Simulator — Monte-Carlo / GARCH path
//              simulation workspace. Phase 1 surfaces a deterministic
//              client-side preview using GBM with user-configurable inputs
//              so users get a feel for the workspace without LLM calls.

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ArrowLeft, LineChart } from 'lucide-react';

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

export function IpoStockSimulator() {
  const { id } = useParams<{ id: string }>();
  const [s0, set_s0] = useState(20);
  const [mu, set_mu] = useState(0.08);
  const [sigma, set_sigma] = useState(0.45);
  const [days, set_days] = useState(252);
  const [n_paths, set_n] = useState(200);

  const result = useMemo(() => gbm_paths(s0, mu, sigma, days, n_paths, 42), [s0, mu, sigma, days, n_paths]);

  // Build inline SVG sparkline for p10/p50/p90 + a sample of paths.
  const W = 760, H = 280;
  const max_y = Math.max(...result.p90, ...result.paths.flatMap(p => p)) * 1.05;
  const min_y = Math.min(...result.p10, 0);
  const x = (t: number) => (t / days) * W;
  const y = (v: number) => H - ((v - min_y) / (max_y - min_y)) * H;
  const to_path = (arr: number[]) => arr.map((v, t) => `${t === 0 ? 'M' : 'L'} ${x(t).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
  const sample_paths = result.paths.slice(0, 30);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <LineChart className="h-8 w-8 text-primary" /> Post-IPO Stock Simulator
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize post-listing price-path scenarios. The Phase-1 preview uses Geometric
          Brownian Motion entirely client-side; Phase 2 adds GARCH, jump-diffusion, and
          earnings-driven shocks via the post_ipo agent.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>Adjust IPO price, drift, vol, and horizon.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <NumberField label="IPO price (S₀)" value={s0} on_change={set_s0} step={0.5} />
          <NumberField label="Drift μ (annual)" value={mu} on_change={set_mu} step={0.01} />
          <NumberField label="Vol σ (annual)" value={sigma} on_change={set_sigma} step={0.05} />
          <NumberField label="Days" value={days} on_change={(v) => set_days(Math.round(v))} step={21} />
          <NumberField label="# paths" value={n_paths} on_change={(v) => set_n(Math.round(v))} step={50} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulated Price Paths</CardTitle>
          <CardDescription>P10 / P50 / P90 envelope over {n_paths} GBM paths.</CardDescription>
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
            <span><span className="inline-block w-3 h-1 align-middle bg-red-500" /> P10 downside</span>
            <span><span className="inline-block w-3 h-1 align-middle bg-blue-500" /> Median</span>
            <span><span className="inline-block w-3 h-1 align-middle bg-green-500" /> P90 upside</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <Stat label="Day-end Median" value={`$${result.p50[days].toFixed(2)}`} />
            <Stat label="P10 (downside)" value={`$${result.p10[days].toFixed(2)}`} />
            <Stat label="P90 (upside)" value={`$${result.p90[days].toFixed(2)}`} />
          </div>
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
