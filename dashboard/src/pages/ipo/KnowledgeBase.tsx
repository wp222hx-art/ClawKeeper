// file: dashboard/src/pages/ipo/KnowledgeBase.tsx
// description: Regulation Knowledge Base — browse + search over the curated
//              regulation registry seeded into ipo_regulations.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { ipo_api, type RegulationSearchResult } from '@/lib/ipo-api';

const JURISDICTIONS: Array<{ code: 'US' | 'HK' | 'INTL' | 'ALL'; label: string }> = [
  { code: 'ALL', label: 'All' },
  { code: 'US', label: 'United States (SEC)' },
  { code: 'HK', label: 'Hong Kong (HKEX)' },
  { code: 'INTL', label: 'International' },
];

export function IpoKnowledgeBase() {
  const [jurisdiction, set_jurisdiction] = useState<'US' | 'HK' | 'INTL' | 'ALL'>('ALL');
  const [query, set_query] = useState('');

  const { data: regs } = useQuery({
    queryKey: ['ipo-regulations', jurisdiction],
    queryFn: () => ipo_api.list_regulations(jurisdiction === 'ALL' ? undefined : jurisdiction),
  });

  const search = useMutation<RegulationSearchResult, Error, string>({
    mutationFn: (q: string) =>
      ipo_api.search_regulations(q, {
        jurisdiction: jurisdiction === 'ALL' ? undefined : jurisdiction,
        limit: 12,
      }),
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Link to="/ipo/projects">
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" /> Regulation Knowledge Base
        </h1>
        <p className="text-muted-foreground mt-1">
          Curated SEC, HKEX, and international authoritative literature. Backs every
          AI-drafted output with citations to the underlying source chunks.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search</CardTitle>
          <CardDescription>
            Vector search runs when an embedding-capable provider is configured;
            otherwise falls back to keyword search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              className="h-10 px-3 rounded-md border border-input bg-background"
              value={jurisdiction}
              onChange={(e) => set_jurisdiction(e.target.value as never)}
            >
              {JURISDICTIONS.map(j => <option key={j.code} value={j.code}>{j.label}</option>)}
            </select>
            <Input
              placeholder='e.g. "non-GAAP measures", "connected transactions threshold"'
              value={query}
              onChange={(e) => set_query(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.length >= 2) search.mutate(query); }}
            />
            <Button onClick={() => search.mutate(query)} disabled={query.length < 2 || search.isPending}>
              <Search className="h-4 w-4" /> Search
            </Button>
          </div>

          {search.data && (
            <div className="space-y-2 mt-3">
              <div className="text-xs text-muted-foreground">
                Strategy: <Badge variant="outline">{search.data.strategy}</Badge> ·
                {' '}{search.data.count} results
              </div>
              {search.data.results.map(r => (
                <div key={r.id} className="p-3 rounded border">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{r.code} — {r.title}</div>
                    <Badge variant="outline">{r.jurisdiction}</Badge>
                  </div>
                  {r.heading && <div className="text-xs font-medium mt-1">{r.heading}</div>}
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{r.content}</p>
                  {r.source_url && (
                    <a className="text-xs text-primary underline mt-2 inline-block" target="_blank" rel="noreferrer" href={r.source_url}>
                      Source ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registry</CardTitle>
          <CardDescription>
            {regs?.count ?? 0} regulations indexed for {jurisdiction === 'ALL' ? 'all jurisdictions' : jurisdiction}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!regs ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {regs.regulations.map(r => (
                <div key={r.id} className="p-3 rounded border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                    <div className="flex gap-1">
                      <Badge variant="outline">{r.jurisdiction}</Badge>
                      <Badge variant="outline">{r.authority}</Badge>
                    </div>
                  </div>
                  <div className="font-medium text-sm mt-1">{r.title}</div>
                  {r.summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.summary}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
