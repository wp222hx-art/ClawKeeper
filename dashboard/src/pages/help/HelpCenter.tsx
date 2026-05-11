// file: dashboard/src/pages/help/HelpCenter.tsx
// description: Bilingual user manual for IPOPilot. Renders a sectioned guide
//              with anchor-linked Table of Contents, all strings flowing
//              through the same i18n layer used by every other page so EN ⇆ ZH
//              switches instantly with the sidebar language toggle.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { HelpCircle } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

interface HelpSection {
  id: string;
  title_key: TranslationKey;
  body_key: TranslationKey;
}

const SECTIONS: HelpSection[] = [
  { id: 'overview',         title_key: 'help.sec.overview.title',         body_key: 'help.sec.overview.body' },
  { id: 'getting-started',  title_key: 'help.sec.getting_started.title',  body_key: 'help.sec.getting_started.body' },
  { id: 'configure',        title_key: 'help.sec.configure_provider.title', body_key: 'help.sec.configure_provider.body' },
  { id: 'create-project',   title_key: 'help.sec.create_project.title',   body_key: 'help.sec.create_project.body' },
  { id: 'dashboard',        title_key: 'help.sec.dashboard.title',        body_key: 'help.sec.dashboard.body' },
  { id: 'lifecycle',        title_key: 'help.sec.stage_lifecycle.title',  body_key: 'help.sec.stage_lifecycle.body' },
  { id: 'signoff',          title_key: 'help.sec.signoff.title',          body_key: 'help.sec.signoff.body' },
  { id: 'financial',        title_key: 'help.sec.financial.title',        body_key: 'help.sec.financial.body' },
  { id: 'prospectus',       title_key: 'help.sec.prospectus.title',       body_key: 'help.sec.prospectus.body' },
  { id: 'regulator-qa',     title_key: 'help.sec.regulator_qa.title',     body_key: 'help.sec.regulator_qa.body' },
  { id: 'valuation',        title_key: 'help.sec.valuation.title',        body_key: 'help.sec.valuation.body' },
  { id: 'simulator',        title_key: 'help.sec.simulator.title',        body_key: 'help.sec.simulator.body' },
  { id: 'knowledge',        title_key: 'help.sec.knowledge.title',        body_key: 'help.sec.knowledge.body' },
  { id: 'agents',           title_key: 'help.sec.agents.title',           body_key: 'help.sec.agents.body' },
  { id: 'review',           title_key: 'help.sec.review.title',           body_key: 'help.sec.review.body' },
  { id: 'faq',              title_key: 'help.sec.faq.title',              body_key: 'help.sec.faq.body' },
];

export function HelpCenterPage() {
  const t = useT();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-primary" /> {t('help.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('help.subtitle')}
        </p>
      </div>

      {/* Table of contents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('help.toc.title')}</CardTitle>
          <CardDescription>
            {t('brand.name')} · {t('brand.tagline')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm list-none">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-primary hover:underline"
                >
                  {t(s.title_key)}
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Body sections */}
      {SECTIONS.map(s => (
        <Card key={s.id} id={s.id} className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-xl">{t(s.title_key)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 whitespace-pre-line">
              {t(s.body_key)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
