// file: dashboard/src/pages/ipo/FinancialDiagnosis.tsx
// description: Financial Diagnosis workspace — Phase 1 placeholder showing the
//              checklist of analyses the financial-diagnosis agents will run
//              once an AI provider is configured.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, TrendingUp } from 'lucide-react';

const ANALYSES = [
  { id: 'revenue_quality', name: 'Revenue Quality', desc: 'Concentration, channel-stuffing risk, recognition timing' },
  { id: 'pl_diagnosis', name: 'P&L Diagnosis', desc: 'Margin trend, opex discipline, non-recurring items' },
  { id: 'balance_sheet_diagnosis', name: 'Balance Sheet Diagnosis', desc: 'Leverage, liquidity, asset quality' },
  { id: 'cash_flow_analysis', name: 'Cash Flow Analysis', desc: 'Operating / investing / financing reconciliation, FCF normalization' },
  { id: 'capital_efficiency', name: 'Capital Efficiency', desc: 'ROIC, ROE, asset turnover' },
  { id: 'working_capital', name: 'Working Capital Cycles', desc: 'DSO / DPO / DIO and sensitivity' },
  { id: 'kpi_tracking', name: 'KPI vs Industry Benchmarks', desc: 'Quartile placement against curated peer set' },
];

export function IpoFinancialDiagnosis() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" /> Financial Diagnosis
        </h1>
        <p className="text-muted-foreground mt-1">
          Pre-IPO financial readiness diagnostic. Each analysis produces findings that route
          to the CFO + Auditor sign-off queue before becoming part of the diagnostic memo.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <strong>AI Co-Pilot mode:</strong> Phase 1 surfaces the analytics catalog only.
          Configure an AI provider (Settings → AI Providers) to enable agent-driven analyses.
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ANALYSES.map(a => (
          <Card key={a.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{a.name}</CardTitle>
                <Badge variant="outline">Idle</Badge>
              </div>
              <CardDescription>{a.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" disabled>Run analysis (Phase 2)</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
