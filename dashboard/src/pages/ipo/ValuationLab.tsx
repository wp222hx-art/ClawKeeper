// file: dashboard/src/pages/ipo/ValuationLab.tsx
// description: Valuation Lab — DCF / Comparable / Precedent Tx valuation
//              workspace. Phase 1 shows the model registry; Phase 2 will let
//              the valuation_lead agent build models with citations. i18n.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Calculator } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

const MODEL_CODES = ['DCF', 'COMPS', 'PRECEDENT_TX', 'SUM_OF_PARTS', 'OPTION'] as const;

export function IpoValuationLab() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back_to_dashboard')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-8 w-8 text-primary" /> {t('val.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('val.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODEL_CODES.map(code => (
          <Card key={code}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{t(`val.model.${code}.name` as TranslationKey)}</CardTitle>
                <Badge variant="outline">{code}</Badge>
              </div>
              <CardDescription>{t(`val.model.${code}.desc` as TranslationKey)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" disabled>{t('val.btn.build')}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
