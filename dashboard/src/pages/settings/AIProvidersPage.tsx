// file: dashboard/src/pages/settings/AIProvidersPage.tsx
// description: AI Providers settings page — register / set-default / health-check
//              for tokenhot.ai, OpenAI, Anthropic, DeepSeek.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Loader2, Plug, Sparkles, ShieldCheck } from 'lucide-react';
import { ipo_api } from '@/lib/ipo-api';

type Code = 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';

const PROVIDERS: Array<{ code: Code; label: string; default_chat: string; supports_embed: boolean; default_base?: string }> = [
  { code: 'TOKENHOT',  label: 'TokenHot',  default_chat: 'gpt-4o-mini',                 supports_embed: true,  default_base: 'https://api.tokenhot.ai/v1' },
  { code: 'OPENAI',    label: 'OpenAI',    default_chat: 'gpt-4o-mini',                 supports_embed: true },
  { code: 'ANTHROPIC', label: 'Anthropic', default_chat: 'claude-3-5-sonnet-20241022',  supports_embed: false },
  { code: 'DEEPSEEK',  label: 'DeepSeek',  default_chat: 'deepseek-chat',               supports_embed: false },
];

export function AIProvidersPage() {
  const qc = useQueryClient();
  const [selected, set_selected] = useState<Code>('TOKENHOT');
  const [api_key, set_api_key] = useState('');
  const [base_url, set_base_url] = useState('');
  const [chat_model, set_chat_model] = useState('');
  const [embed_model, set_embed_model] = useState('');
  const [make_default, set_make_default] = useState(true);
  const [persist, set_persist] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['ipo-providers'],
    queryFn: () => ipo_api.list_providers(),
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" /> AI Providers
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure the LLM backends that IPOPilot agents dispatch to.
          Without an active provider, agents stay in <em>idle</em> mode.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Configured Providers</CardTitle>
              <CardDescription>
                {data?.configured ? 'At least one provider is active.' : 'No providers configured yet.'}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => health.mutate()} disabled={health.isPending}>
              {health.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Health Check
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {data && data.live.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No providers registered. Use the form below to add one.
            </p>
          )}
          {data && data.live.length > 0 && (
            <div className="space-y-2">
              {data.live.map(p => (
                <div key={p.code} className="p-3 rounded border flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      {p.display_name}
                      {p.is_default && <Badge>Default</Badge>}
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
                      Set default
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Plug className="h-5 w-5" /> Register Provider</CardTitle>
          <CardDescription>
            API keys are sent to the IPOPilot backend; when <em>persist</em> is checked,
            they are stored in <code>ipo_ai_providers</code> for re-use after restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {PROVIDERS.map(p => (
              <Button
                key={p.code}
                variant={selected === p.code ? 'default' : 'outline'}
                size="sm"
                onClick={() => { set_selected(p.code); set_chat_model(''); set_embed_model(''); set_base_url(''); }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>API Key *</Label>
              <Input
                type="password"
                placeholder={`${meta.label} API key`}
                value={api_key}
                onChange={(e) => set_api_key(e.target.value)}
              />
            </div>
            <div>
              <Label>Base URL (optional)</Label>
              <Input
                placeholder={meta.default_base ?? '(provider default)'}
                value={base_url}
                onChange={(e) => set_base_url(e.target.value)}
              />
            </div>
            <div>
              <Label>Chat model (optional)</Label>
              <Input placeholder={meta.default_chat} value={chat_model} onChange={(e) => set_chat_model(e.target.value)} />
            </div>
            {meta.supports_embed && (
              <div>
                <Label>Embedding model (optional)</Label>
                <Input placeholder="text-embedding-3-small" value={embed_model} onChange={(e) => set_embed_model(e.target.value)} />
              </div>
            )}
            <div className="md:col-span-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={make_default} onChange={(e) => set_make_default(e.target.checked)} />
                Make default
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={persist} onChange={(e) => set_persist(e.target.checked)} />
                Persist to database
              </label>
            </div>
          </div>
          {register.error && (
            <div className="text-sm text-destructive">
              {(register.error as Error).message}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => register.mutate()} disabled={!api_key || register.isPending}>
              {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Register
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
