// file: dashboard/src/pages/ipo/ProspectusDrafter.tsx
// description: Prospectus Drafter — section-by-section drafting workspace.
//              Phase 1 surfaces the section list aligned to S-1 / F-1 (Reg S-K)
//              and HKEX listing document chapters; AI drafting activates in
//              Phase 2. Localized via i18n.

import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, FileText } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

interface SectionEntry { code: string; name_key: TranslationKey; ref: string }

const SEC_SECTIONS: SectionEntry[] = [
  { code: 'cover',             name_key: 'prosp.sec.cover',             ref: 'Item 501' },
  { code: 'summary',           name_key: 'prosp.sec.summary',           ref: 'Item 503' },
  { code: 'risk_factors',      name_key: 'prosp.sec.risk_factors',      ref: 'Item 105 / Item 503(c)' },
  { code: 'use_of_proceeds',   name_key: 'prosp.sec.use_of_proceeds',   ref: 'Item 504' },
  { code: 'mdna',              name_key: 'prosp.sec.mdna',              ref: 'Item 303' },
  { code: 'business',          name_key: 'prosp.sec.business',          ref: 'Item 101' },
  { code: 'management',        name_key: 'prosp.sec.management',        ref: 'Item 401-402' },
  { code: 'related_party',     name_key: 'prosp.sec.related_party',     ref: 'Item 404' },
  { code: 'principal_holders', name_key: 'prosp.sec.principal_holders', ref: 'Item 403' },
  { code: 'financials',        name_key: 'prosp.sec.financials',        ref: 'Reg S-X' },
];

const HKEX_SECTIONS: SectionEntry[] = [
  { code: 'summary',             name_key: 'prosp.hkex.summary',             ref: 'App.1A.6' },
  { code: 'risk_factors',        name_key: 'prosp.hkex.risk_factors',        ref: 'App.1A.40' },
  { code: 'business',            name_key: 'prosp.hkex.business',            ref: 'App.1A.28' },
  { code: 'industry',            name_key: 'prosp.hkex.industry',            ref: 'App.1A.31' },
  { code: 'connected',           name_key: 'prosp.hkex.connected',           ref: 'Ch. 14A' },
  { code: 'mdna',                name_key: 'prosp.hkex.mdna',                ref: 'App.1A.32-33' },
  { code: 'directors',           name_key: 'prosp.hkex.directors',           ref: 'App.1A.41' },
  { code: 'use_of_proceeds',     name_key: 'prosp.hkex.use_of_proceeds',     ref: 'App.1A.48' },
  { code: 'esg',                 name_key: 'prosp.hkex.esg',                 ref: 'App.27' },
  { code: 'accountants_report',  name_key: 'prosp.hkex.accountants_report',  ref: 'Ch. 4' },
];

export function IpoProspectusDrafter() {
  const { id } = useParams<{ id: string }>();
  const t = useT();

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionGroup title={t('prosp.group.sec')}  sections={SEC_SECTIONS} />
        <SectionGroup title={t('prosp.group.hkex')} sections={HKEX_SECTIONS} />
      </div>
    </div>
  );
}

function SectionGroup({ title, sections }: { title: string; sections: SectionEntry[] }) {
  const t = useT();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sections.map(s => (
          <div key={s.code} className="flex items-center justify-between p-3 rounded border">
            <div>
              <div className="font-medium text-sm">{t(s.name_key)}</div>
              <div className="text-xs text-muted-foreground">{s.ref}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t('prosp.status.not_started')}</Badge>
              <Button size="sm" disabled>{t('prosp.btn.draft')}</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
