// file: dashboard/src/pages/ipo/ValuationLab.tsx
// description: Valuation Lab — DCF / Comparable / Precedent Tx valuation
//              workspace. Phase 1 shows the model registry; Phase 2 will let
//              the valuation_lead agent build models with citations.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Calculator } from 'lucide-react';

const MODEL_TYPES = [
  { code: 'DCF',         name: 'Discounted Cash Flow',     desc: 'Forecast → discount → terminal value with sensitivities' },
  { code: 'COMPS',       name: 'Comparable Companies',     desc: 'Public-company multiples (EV/Rev, EV/EBITDA, P/E, P/S)' },
  { code: 'PRECEDENT_TX',name: 'Precedent Transactions',   desc: 'M&A and IPO precedents with control premiums' },
  { code: 'SUM_OF_PARTS',name: 'Sum-of-the-Parts',         desc: 'Segment-by-segment valuation aggregation' },
  { code: 'OPTION',      name: 'Option-Based',             desc: 'Real-options for clinical-stage / convertible securities' },
];

export function IpoValuationLab() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-8 w-8 text-primary" /> Valuation Lab
        </h1>
        <p className="text-muted-foreground mt-1">
          Build, version, and stress-test valuation models. Every model requires CFO + Sponsor
          signoff before being included in the offer-pricing memo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODEL_TYPES.map(m => (
          <Card key={m.code}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{m.name}</CardTitle>
                <Badge variant="outline">{m.code}</Badge>
              </div>
              <CardDescription>{m.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" disabled>Build model (Phase 2)</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
