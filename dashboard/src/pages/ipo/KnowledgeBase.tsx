// file: dashboard/src/pages/ipo/KnowledgeBase.tsx
// description: Regulation Knowledge Base — browse + search over the curated
//              regulation registry seeded into ipo_regulations. i18n.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { ipo_api, type RegulationSearchResult } from '@/lib/ipo-api';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

const JURIS_CODES = ['ALL', 'US', 'HK', 'INTL'] as const;

export function IpoKnowledgeBase() {
  const t = useT();
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

  const scope_label = jurisdiction === 'ALL' ? t('kb.registry.all_jurisdictions') : jurisdiction;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <Link to="/ipo/projects">
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-8 w-8 text-primary" /> {t('kb.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('kb.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('kb.search.title')}</CardTitle>
          <CardDescription>
            {t('kb.search.desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              className="h-10 px-3 rounded-md border border-input bg-background"
              value={jurisdiction}
              onChange={(e) => set_jurisdiction(e.target.value as never)}
            >
              {JURIS_CODES.map(j => (
                <option key={j} value={j}>{t(`kb.juris.${j}` as TranslationKey)}</option>
              ))}
            </select>
            <Input
              placeholder={t('kb.search.placeholder')}
              value={query}
              onChange={(e) => set_query(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && query.length >= 2) search.mutate(query); }}
            />
            <Button onClick={() => search.mutate(query)} disabled={query.length < 2 || search.isPending}>
              <Search className="h-4 w-4" /> {t('kb.btn.search')}
            </Button>
          </div>

          {search.data && (
            <div className="space-y-2 mt-3">
              <div className="text-xs text-muted-foreground">
                {t('kb.strategy')} <Badge variant="outline">{search.data.strategy}</Badge> ·
                {' '}{t('kb.results', { n: search.data.count })}
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
                      {t('kb.source')}
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
          <CardTitle className="text-lg">{t('kb.registry.title')}</CardTitle>
          <CardDescription>
            {t('kb.registry.desc', { count: regs?.count ?? 0, scope: scope_label })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!regs ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
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
