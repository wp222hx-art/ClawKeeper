// file: dashboard/src/pages/ipo/ProjectsPage.tsx
// description: IPOPilot Projects list — shows all IPO projects for the tenant
//              with their current stage, market, and industry.

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, Briefcase, MapPin, Calendar } from 'lucide-react';
import { ipo_api, MARKET_LABELS, INDUSTRY_LABELS, STAGE_LABELS } from '@/lib/ipo-api';

export function IpoProjectsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ipo-projects'],
    queryFn: () => ipo_api.list_projects(),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IPO Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage IPO advisory engagements across SEC and HKEX markets.
          </p>
        </div>
        <Link to="/ipo/projects/new">
          <Button>
            <Plus className="h-4 w-4" />
            New IPO Project
          </Button>
        </Link>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading projects…</p>}
      {error && <p className="text-destructive">Failed to load projects: {(error as Error).message}</p>}

      {data && data.projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No IPO projects yet</h3>
            <p className="text-muted-foreground mb-4">
              Start your first engagement by creating an IPO project.
            </p>
            <Link to="/ipo/projects/new">
              <Button>Create First Project</Button>
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
                    <span>{MARKET_LABELS[p.target_market] ?? p.target_market}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{INDUSTRY_LABELS[p.industry] ?? p.industry}</span>
                  </div>
                  {p.target_listing_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Target: {new Date(p.target_listing_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t mt-2">
                    <Badge>{STAGE_LABELS[p.stage] ?? p.stage}</Badge>
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
