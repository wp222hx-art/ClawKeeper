// file: dashboard/src/pages/ipo/FinancialDiagnosis.tsx
// description: Financial Diagnosis workspace — Phase 1 placeholder showing the
//              checklist of analyses the financial-diagnosis agents will run
//              once an AI provider is configured. Localized via i18n.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

const ANALYSIS_IDS = [
  'revenue_quality',
  'pl_diagnosis',
  'balance_sheet_diagnosis',
  'cash_flow_analysis',
  'capital_efficiency',
  'working_capital',
  'kpi_tracking',
] as const;

export function IpoFinancialDiagnosis() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back_to_dashboard')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-8 w-8 text-primary" /> {t('fin.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('fin.subtitle')}
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <strong>{t('fin.copilot.title')}</strong> {t('fin.copilot.desc')}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ANALYSIS_IDS.map(a => (
          <Card key={a}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{t(`fin.an.${a}.name` as TranslationKey)}</CardTitle>
                <Badge variant="outline">{t('fin.status.idle')}</Badge>
              </div>
              <CardDescription>{t(`fin.an.${a}.desc` as TranslationKey)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" disabled>{t('fin.btn.run')}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
