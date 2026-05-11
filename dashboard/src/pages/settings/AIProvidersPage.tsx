// file: dashboard/src/pages/settings/AIProvidersPage.tsx
// description: AI Providers settings page — register / set-default / health-check
//              + fetch & filter the actual model list exposed by the provider
//              account. Fully localized (en/zh) via @/lib/i18n.

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Loader2, Plug, Sparkles, ShieldCheck, Search, Download } from 'lucide-react';
import { ipo_api, type ModelInfo } from '@/lib/ipo-api';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

type Code = 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';
type CapabilityFilter = 'all' | 'chat' | 'embedding' | 'image' | 'other';

const PROVIDERS: Array<{ code: Code; label: string; default_chat: string; supports_embed: boolean; default_base?: string }> = [
  { code: 'TOKENHOT',  label: 'TokenHot',  default_chat: 'gpt-4o-mini',                 supports_embed: true,  default_base: 'https://api.tokenhot.ai/v1' },
  { code: 'OPENAI',    label: 'OpenAI',    default_chat: 'gpt-4o-mini',                 supports_embed: true },
  { code: 'ANTHROPIC', label: 'Anthropic', default_chat: 'claude-3-5-sonnet-20241022',  supports_embed: false },
  { code: 'DEEPSEEK',  label: 'DeepSeek',  default_chat: 'deepseek-chat',               supports_embed: false },
];

export function AIProvidersPage() {
  const t = useT();
  const qc = useQueryClient();
  const [selected, set_selected] = useState<Code>('TOKENHOT');
  const [api_key, set_api_key] = useState('');
  const [base_url, set_base_url] = useState('');
  const [chat_model, set_chat_model] = useState('');
  const [embed_model, set_embed_model] = useState('');
  const [make_default, set_make_default] = useState(true);
  const [persist, set_persist] = useState(true);

  // Model picker state
  const [models, set_models] = useState<ModelInfo[] | null>(null);
  const [model_search, set_model_search] = useState('');
  const [capability_filter, set_capability_filter] = useState<CapabilityFilter>('chat');

  const { data, isLoading } = useQuery({
    queryKey: ['ipo-providers'],
    queryFn: () => ipo_api.list_providers(),
  });

  const probe_models = useMutation({
    mutationFn: () => ipo_api.probe_provider_models({
      code: selected,
      api_key,
      base_url: base_url || undefined,
    }),
    onSuccess: (resp) => {
      set_models(resp.models);
      // Reset search/filter so the user sees a fresh list
      set_model_search('');
    },
  });

  const register = useMutation({
    mutationFn: () => ipo_api.register_provider({
      code: selected,
      api_key,
      base_url: base_url || undefined,
      default_chat_model: chat_model || undefined,
      default_embedding_model: embed_model || undefined,
      make_default,
      persist,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ipo-providers'] });
      set_api_key('');
      set_models(null);
    },
  });

  const set_default = useMutation({
    mutationFn: (code: string) => ipo_api.set_default_provider(code),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ipo-providers'] }),
  });

  const health = useMutation({
    mutationFn: () => ipo_api.health_check_providers(),
  });

  const meta = PROVIDERS.find(p => p.code === selected)!;

  // ---------------------------------------------------------------------------
  // Model filtering
  // ---------------------------------------------------------------------------
  const filtered_models = useMemo(() => {
    if (!models) return [];
    const q = model_search.trim().toLowerCase();
    return models.filter((m) => {
      if (capability_filter !== 'all') {
        if (capability_filter === 'other') {
          if (m.capability === 'chat' || m.capability === 'embedding' || m.capability === 'image') return false;
        } else if (m.capability !== capability_filter) {
          return false;
        }
      }
      if (!q) return true;
      const hay = `${m.id} ${m.display_name ?? ''} ${m.family ?? ''} ${m.owned_by ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [models, model_search, capability_filter]);

  const counts_by_capability = useMemo(() => {
    const out = { all: 0, chat: 0, embedding: 0, image: 0, other: 0 };
    if (!models) return out;
    for (const m of models) {
      out.all++;
      if (m.capability === 'chat') out.chat++;
      else if (m.capability === 'embedding') out.embedding++;
      else if (m.capability === 'image') out.image++;
      else out.other++;
    }
    return out;
  }, [models]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" /> {t('providers.page.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('providers.page.subtitle')}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Configured providers                                              */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{t('providers.section.configured')}</CardTitle>
              <CardDescription>
                {data?.configured ? t('providers.configured.yes') : t('providers.configured.none')}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => health.mutate()} disabled={health.isPending}>
              {health.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t('providers.health_check')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
          {data && data.live.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('providers.empty_state')}</p>
          )}
          {data && data.live.length > 0 && (
            <div className="space-y-2">
              {data.live.map(p => (
                <div key={p.code} className="p-3 rounded border flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {p.display_name}
                      {p.is_default && <Badge>{t('common.default')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Chat: <code>{p.default_chat_model}</code>
                      {p.default_embedding_model && <> · Embed: <code>{p.default_embedding_model}</code></>}
                      {' · '}
                      <span className="font-mono">{p.base_url_redacted}</span>
                    </div>
                  </div>
                  {!p.is_default && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => set_default.mutate(p.code)}
                      disabled={set_default.isPending}
                    >
                      {t('providers.set_default')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {health.data ? (
            <pre className="text-xs mt-3 p-3 rounded border bg-muted/30 overflow-x-auto">
              {JSON.stringify(health.data, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Register form                                                     */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plug className="h-5 w-5" /> {t('providers.section.register')}
          </CardTitle>
          <CardDescription>{t('providers.section.register.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {PROVIDERS.map(p => (
              <Button
                key={p.code}
                variant={selected === p.code ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  set_selected(p.code);
                  set_chat_model(''); set_embed_model(''); set_base_url('');
                  set_models(null);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>
                {t('providers.field.api_key')} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="password"
                placeholder={t('providers.field.api_key.placeholder', { provider: meta.label })}
                value={api_key}
                onChange={(e) => set_api_key(e.target.value)}
              />
            </div>
            <div>
              <Label>
                {t('providers.field.base_url')}{' '}
                <span className="text-xs text-muted-foreground">({t('providers.field.base_url.help')})</span>
              </Label>
              <Input
                placeholder={meta.default_base ?? '(provider default)'}
                value={base_url}
                onChange={(e) => set_base_url(e.target.value)}
              />
            </div>
            <div>
              <Label>
                {t('providers.field.chat_model')}{' '}
                <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
              </Label>
              <Input placeholder={meta.default_chat} value={chat_model} onChange={(e) => set_chat_model(e.target.value)} />
            </div>
            {meta.supports_embed && (
              <div>
                <Label>
                  {t('providers.field.embed_model')}{' '}
                  <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
                </Label>
                <Input placeholder={t('providers.field.embed_model.placeholder')} value={embed_model} onChange={(e) => set_embed_model(e.target.value)} />
              </div>
            )}
            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={make_default} onChange={(e) => set_make_default(e.target.checked)} />
                {t('providers.opt.make_default')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={persist} onChange={(e) => set_persist(e.target.checked)} />
                {t('providers.opt.persist')}
              </label>
            </div>
          </div>

          {register.error && (
            <div className="text-sm text-destructive">{(register.error as Error).message}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => probe_models.mutate()}
              disabled={!api_key || probe_models.isPending}
            >
              {probe_models.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              {probe_models.isPending ? t('providers.btn.fetching') : t('providers.btn.fetch_models')}
            </Button>
            <Button onClick={() => register.mutate()} disabled={!api_key || register.isPending}>
              {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('providers.btn.register')}
            </Button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Model picker                                                  */}
          {/* ------------------------------------------------------------- */}
          {probe_models.error && (
            <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
              {(probe_models.error as Error).message}
            </div>
          )}

          {!models && !probe_models.error && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              {t('providers.models.fetch_first')}
            </p>
          )}

          {models && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  {t('providers.models.title')}
                  <Badge variant="outline">
                    {t('providers.models.count', { count: models.length })}
                  </Badge>
                </h3>
                <div className="flex gap-1">
                  {(['all', 'chat', 'embedding', 'image', 'other'] as CapabilityFilter[]).map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant={capability_filter === f ? 'default' : 'outline'}
                      onClick={() => set_capability_filter(f)}
                      className="h-7 text-xs"
                    >
                      {t(`providers.models.filter.${f}` as TranslationKeyShim)}
                      <span className="ml-1 text-[10px] opacity-70">{counts_by_capability[f]}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8"
                  placeholder={t('providers.models.search')}
                  value={model_search}
                  onChange={(e) => set_model_search(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">{t('providers.models.note')}</p>

              {models.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('providers.models.empty')}</p>
              ) : filtered_models.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('providers.models.no_match')}</p>
              ) : (
                <div className="max-h-96 overflow-y-auto border rounded divide-y">
                  {filtered_models.map((m) => (
                    <div key={m.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-sm font-mono">{m.id}</code>
                          <Badge
                            variant="outline"
                            className={
                              m.capability === 'embedding' ? 'border-purple-300 text-purple-700' :
                              m.capability === 'chat' ? 'border-blue-300 text-blue-700' :
                              m.capability === 'image' ? 'border-pink-300 text-pink-700' :
                              undefined
                            }
                          >
                            {m.capability}
                          </Badge>
                          {m.family && m.family !== 'other' && (
                            <Badge variant="outline" className="text-xs">{m.family}</Badge>
                          )}
                          {m.context_window && (
                            <span className="text-[10px] text-muted-foreground">
                              {t('providers.models.context', { n: m.context_window.toLocaleString() })}
                            </span>
                          )}
                        </div>
                        {m.owned_by && (
                          <div className="text-[11px] text-muted-foreground">{m.owned_by}</div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => set_chat_model(m.id)}
                          disabled={m.capability === 'embedding'}
                          title={t('providers.models.use_chat')}
                        >
                          {t('providers.models.use_chat')}
                        </Button>
                        {meta.supports_embed && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => set_embed_model(m.id)}
                            disabled={m.capability !== 'embedding' && m.capability !== 'unknown'}
                            title={t('providers.models.use_embed')}
                          >
                            {t('providers.models.use_embed')}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Local helper to keep the dynamic key lookup type-safe without importing the
// full TranslationKey union (the i18n module already widens at runtime).
type TranslationKeyShim =
  | 'providers.models.filter.all'
  | 'providers.models.filter.chat'
  | 'providers.models.filter.embedding'
  | 'providers.models.filter.image'
  | 'providers.models.filter.other';
