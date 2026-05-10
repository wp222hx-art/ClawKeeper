// file: dashboard/src/pages/ipo/NewProjectWizard.tsx
// description: Three-step wizard to create a new IPO project — Market →
//              Industry → Company details. After submission, redirects to the
//              new project's dashboard.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import {
  ipo_api,
  MARKET_LABELS,
  INDUSTRY_LABELS,
  type CreateProjectInput,
  type TargetMarket,
  type Industry,
  type ListingStructure,
} from '@/lib/ipo-api';

const MARKETS: TargetMarket[] = [
  'SEC_NASDAQ_GS', 'SEC_NASDAQ_GM', 'SEC_NASDAQ_CM',
  'SEC_NYSE', 'SEC_NYSE_AMERICAN',
  'HKEX_MAIN', 'HKEX_GEM',
];

const INDUSTRIES: Industry[] = ['SAAS', 'BIOPHARMA', 'CLEAN_ENERGY', 'OTHER'];

const STRUCTURES: ListingStructure[] = [
  'DIRECT', 'VIE', 'RED_CHIP', 'SPAC_MERGER',
  'CARVE_OUT', 'DUAL_PRIMARY', 'SECONDARY_LISTING',
];

export function IpoNewProjectWizard() {
  const navigate = useNavigate();
  const [step, set_step] = useState<1 | 2 | 3>(1);
  const [form, set_form] = useState<Partial<CreateProjectInput>>({
    confidentiality_level: 'STANDARD',
  });

  const create = useMutation({
    mutationFn: (input: CreateProjectInput) => ipo_api.create_project(input),
    onSuccess: (resp) => navigate(`/ipo/projects/${resp.project.id}`),
  });

  const can_advance_1 = !!form.target_market;
  const can_advance_2 = !!form.industry;
  const can_submit = !!form.company_legal_name;

  const submit = () => {
    if (!can_submit || !form.target_market || !form.industry) return;
    create.mutate(form as CreateProjectInput);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/ipo/projects')}>
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Button>
        <h1 className="text-3xl font-bold mt-2">New IPO Project</h1>
        <p className="text-muted-foreground mt-1">
          Step {step} of 3 — {step === 1 ? 'Target Market' : step === 2 ? 'Industry & Structure' : 'Company Details'}
        </p>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map(n => (
          <div
            key={n}
            className={`flex-1 h-2 rounded ${n <= step ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Where will the company list?</CardTitle>
            <CardDescription>Pick the primary listing venue. Dual-listing can be configured later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {MARKETS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set_form(f => ({ ...f, target_market: m }))}
                className={`w-full text-left p-4 border rounded-md transition-colors ${
                  form.target_market === m ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">{MARKET_LABELS[m]}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {m.startsWith('SEC') ? 'United States — SEC filings (S-1 / F-1), Reg S-K / S-X, SOX 404'
                    : 'Hong Kong — HKEX listing rules, Sponsor regime, App.27 ESG'}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>What does the company do?</CardTitle>
            <CardDescription>Industry drives which sector specialist agents activate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => set_form(f => ({ ...f, industry: i }))}
                  className={`p-4 border rounded-md transition-colors ${
                    form.industry === i ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{INDUSTRY_LABELS[i]}</div>
                </button>
              ))}
            </div>

            <div>
              <Label htmlFor="industry_subcategory">Subcategory (optional)</Label>
              <Input
                id="industry_subcategory"
                placeholder="e.g. Vertical SaaS / Solar EPC / Clinical-stage Oncology"
                value={form.industry_subcategory ?? ''}
                onChange={(e) => set_form(f => ({ ...f, industry_subcategory: e.target.value || undefined }))}
              />
            </div>

            <div>
              <Label htmlFor="listing_structure">Listing Structure (optional)</Label>
              <select
                id="listing_structure"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={form.listing_structure ?? ''}
                onChange={(e) => set_form(f => ({
                  ...f,
                  listing_structure: (e.target.value || undefined) as ListingStructure | undefined,
                }))}
              >
                <option value="">— Select —</option>
                {STRUCTURES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Company details</CardTitle>
            <CardDescription>You can edit any of these later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="company_legal_name">Company legal name *</Label>
              <Input
                id="company_legal_name"
                placeholder="Acme Holdings Ltd."
                value={form.company_legal_name ?? ''}
                onChange={(e) => set_form(f => ({ ...f, company_legal_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company_short_name">Short name</Label>
                <Input
                  id="company_short_name"
                  placeholder="Acme"
                  value={form.company_short_name ?? ''}
                  onChange={(e) => set_form(f => ({ ...f, company_short_name: e.target.value || undefined }))}
                />
              </div>
              <div>
                <Label htmlFor="proposed_ticker">Proposed ticker</Label>
                <Input
                  id="proposed_ticker"
                  placeholder="ACME"
                  value={form.proposed_ticker ?? ''}
                  onChange={(e) => set_form(f => ({ ...f, proposed_ticker: e.target.value || undefined }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="company_jurisdiction">Incorporation jurisdiction</Label>
                <Input
                  id="company_jurisdiction"
                  placeholder="Cayman / Delaware / Hong Kong"
                  value={form.company_jurisdiction ?? ''}
                  onChange={(e) => set_form(f => ({ ...f, company_jurisdiction: e.target.value || undefined }))}
                />
              </div>
              <div>
                <Label htmlFor="target_listing_date">Target listing date</Label>
                <Input
                  id="target_listing_date"
                  type="date"
                  value={form.target_listing_date ?? ''}
                  onChange={(e) => set_form(f => ({ ...f, target_listing_date: e.target.value || undefined }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="primary_advisor_firm">Primary advisor firm</Label>
              <Input
                id="primary_advisor_firm"
                placeholder="Big-4 audit / sponsor name"
                value={form.primary_advisor_firm ?? ''}
                onChange={(e) => set_form(f => ({ ...f, primary_advisor_firm: e.target.value || undefined }))}
              />
            </div>
            <div>
              <Label htmlFor="company_description">Company description</Label>
              <Textarea
                id="company_description"
                rows={3}
                value={form.company_description ?? ''}
                onChange={(e) => set_form(f => ({ ...f, company_description: e.target.value || undefined }))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {create.error && (
        <div className="text-sm text-destructive">
          Failed to create project: {(create.error as Error).message}
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => set_step(s => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={step === 1}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => set_step(s => ((s + 1) as 1 | 2 | 3))}
            disabled={(step === 1 && !can_advance_1) || (step === 2 && !can_advance_2)}
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={!can_submit || create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        )}
      </div>
    </div>
  );
}
