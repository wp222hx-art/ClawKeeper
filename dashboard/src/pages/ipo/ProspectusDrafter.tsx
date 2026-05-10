// file: dashboard/src/pages/ipo/ProspectusDrafter.tsx
// description: Prospectus Drafter — section-by-section drafting workspace.
//              Phase 1 surfaces the section list aligned to S-1 / F-1 (Reg S-K)
//              and HKEX listing document chapters; AI drafting activates in
//              Phase 2.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, FileText } from 'lucide-react';

const SEC_SECTIONS = [
  { code: 'cover', name: 'Cover Page',                      ref: 'Item 501' },
  { code: 'summary', name: 'Prospectus Summary',            ref: 'Item 503' },
  { code: 'risk_factors', name: 'Risk Factors',             ref: 'Item 105 / Item 503(c)' },
  { code: 'use_of_proceeds', name: 'Use of Proceeds',       ref: 'Item 504' },
  { code: 'mdna', name: 'MD&A',                             ref: 'Item 303' },
  { code: 'business', name: 'Business',                     ref: 'Item 101' },
  { code: 'management', name: 'Management & Compensation',  ref: 'Item 401-402' },
  { code: 'related_party', name: 'Related Party Tx',        ref: 'Item 404' },
  { code: 'principal_holders', name: 'Principal Stockholders', ref: 'Item 403' },
  { code: 'financials', name: 'Financial Statements',       ref: 'Reg S-X' },
];

const HKEX_SECTIONS = [
  { code: 'summary', name: 'Summary & Highlights',          ref: 'App.1A.6' },
  { code: 'risk_factors', name: 'Risk Factors',             ref: 'App.1A.40' },
  { code: 'business', name: 'Business',                     ref: 'App.1A.28' },
  { code: 'industry', name: 'Industry Overview',            ref: 'App.1A.31' },
  { code: 'connected', name: 'Connected Transactions',      ref: 'Ch. 14A' },
  { code: 'mdna', name: 'Financial Information (MD&A)',     ref: 'App.1A.32-33' },
  { code: 'directors', name: 'Directors & Senior Mgmt',     ref: 'App.1A.41' },
  { code: 'use_of_proceeds', name: 'Future Plans & Use of Proceeds', ref: 'App.1A.48' },
  { code: 'esg', name: 'ESG Disclosure',                    ref: 'App.27' },
  { code: 'accountants_report', name: 'Accountants’ Report', ref: 'Ch. 4' },
];

export function IpoProspectusDrafter() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" /> Prospectus Drafter
        </h1>
        <p className="text-muted-foreground mt-1">
          Section-by-section drafting. Every section requires Lawyer + Auditor + CFO + Sponsor
          signoff before it can be marked <em>final</em> — enforced by the database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionGroup title="SEC Form S-1 / F-1" sections={SEC_SECTIONS} />
        <SectionGroup title="HKEX Listing Document" sections={HKEX_SECTIONS} />
      </div>
    </div>
  );
}

function SectionGroup({ title, sections }: { title: string; sections: { code: string; name: string; ref: string }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sections.map(s => (
          <div key={s.code} className="flex items-center justify-between p-3 rounded border">
            <div>
              <div className="font-medium text-sm">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.ref}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Not started</Badge>
              <Button size="sm" disabled>Draft (Phase 2)</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
