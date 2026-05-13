// file: dashboard/src/pages/ipo/ProjectsPage.tsx
// description: IPOPilot Projects list — shows all IPO projects for the tenant
//              with their current stage, market, and industry. Fully localized
//              via the lightweight i18n layer (useT + useStageLabel etc.).

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, Briefcase, MapPin, Calendar } from 'lucide-react';
import { ipo_api } from '@/lib/ipo-api';
import {
  useT,
  useStageLabel,
  useMarketLabel,
  useIndustryLabel,
} from '@/lib/i18n';

export function IpoProjectsPage() {
  const t = useT();
  const stage_label = useStageLabel();
  const market_label = useMarketLabel();
  const industry_label = useIndustryLabel();

  const { data, isLoading, error } = useQuery({
    queryKey: ['ipo-projects'],
    queryFn: () => ipo_api.list_projects(),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('projects.page.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('projects.page.subtitle')}
          </p>
        </div>
        <Link to="/ipo/projects/new">
          <Button>
            <Plus className="h-4 w-4" />
            {t('projects.btn.new')}
          </Button>
        </Link>
      </div>

      {isLoading && <p className="text-muted-foreground">{t('projects.loading')}</p>}
      {error && (
        <p className="text-destructive">
          {t('projects.failed')} {(error as Error).message}
        </p>
      )}

      {data && data.projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('projects.empty.title')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('projects.empty.subtitle')}
            </p>
            <Link to="/ipo/projects/new">
              <Button>{t('projects.btn.create_first')}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data && data.projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.projects.map(p => (
            <Link key={p.id} to={`/ipo/projects/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{p.company_legal_name}</CardTitle>
                    {p.proposed_ticker && (
                      <Badge variant="outline">{p.proposed_ticker}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{market_label(p.target_market)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{industry_label(p.industry)}</span>
                  </div>
                  {p.target_listing_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {t('projects.target_label')}{' '}
                        {new Date(p.target_listing_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t mt-2">
                    <Badge>{stage_label(p.stage)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
