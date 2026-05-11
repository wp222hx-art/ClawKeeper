// file: dashboard/src/pages/ipo/AgentCatalog.tsx
// description: IPO Agent Catalog — browse the ~80 IPO agents by tier and
//              category, drill into each agent's AGENT.md + SKILL.md bundle.
//              Localized via i18n.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Bot, Play } from 'lucide-react';
import { ipo_api, type IpoAgentCatalogItem, type AgentRunResult } from '@/lib/ipo-api';
import { useT, useLocale } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

const TIERS = ['ALL', 'CEO', 'JURISDICTION_LEAD', 'INDUSTRY_LEAD', 'FUNCTIONAL_LEAD', 'WORKER'] as const;

export function IpoAgentCatalog() {
  const t = useT();
  const { locale } = useLocale();
  const [tier, set_tier] = useState<string>('ALL');
  const [selected, set_selected] = useState<IpoAgentCatalogItem | null>(null);
  const [run_prompt, set_run_prompt] = useState<string>('');
  const [run_context, set_run_context] = useState<string>('');
  const [run_result, set_run_result] = useState<AgentRunResult | null>(null);
  const [run_error, set_run_error] = useState<string | null>(null);

  const get_name = (a: IpoAgentCatalogItem) =>
    locale === 'zh' && a.display_name_zh ? a.display_name_zh : a.display_name;
  const get_desc = (a: IpoAgentCatalogItem) =>
    locale === 'zh' && a.description_zh ? a.description_zh : a.description;

  const run_mutation = useMutation({
    mutationFn: (vars: { id: string; prompt: string; context?: string }) =>
      ipo_api.run_agent(vars.id, {
        prompt: vars.prompt,
        locale,
        ...(vars.context && vars.context.trim() ? { context: vars.context } : {}),
      }),
    onSuccess: (data) => { set_run_result(data.result); set_run_error(null); },
    onError:   (err: Error) => { set_run_error(err.message); set_run_result(null); },
  });

  // Reset run state when switching agents
  const select_agent = (a: IpoAgentCatalogItem) => {
    set_selected(a);
    set_run_result(null);
    set_run_error(null);
  };

  const { data: catalog } = useQuery({
    queryKey: ['ipo-agents', tier],
    queryFn: () => ipo_api.list_agents(tier === 'ALL' ? undefined : { tier }),
  });

  const { data: coverage } = useQuery({
    queryKey: ['ipo-agents-coverage'],
    queryFn: () => ipo_api.get_skill_coverage(),
  });

  const { data: bundle } = useQuery({
    queryKey: ['ipo-agent-bundle', selected?.id],
    queryFn: () => ipo_api.get_agent_bundle(selected!.id),
    enabled: !!selected,
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Link to="/ipo/projects">
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8 text-primary" /> {t('agents.title')}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('agents.subtitle')}
        </p>
        {coverage && (
          <div className="text-xs text-muted-foreground mt-2">
            {t('agents.coverage', {
              ag: coverage.agents_with_agent_md,
              total: coverage.total_agents,
              sk: coverage.skills_with_content,
              usk: coverage.unique_skills,
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {TIERS.map(tier_code => (
          <Button
            key={tier_code}
            variant={tier === tier_code ? 'default' : 'outline'}
            size="sm"
            onClick={() => { set_tier(tier_code); set_selected(null); }}
          >
            {t(`agents.tier.${tier_code}` as TranslationKey)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-2 max-h-[80vh] overflow-y-auto">
          {catalog?.agents.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => select_agent(a)}
              className={`w-full text-left p-3 rounded border transition-colors ${
                selected?.id === a.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm">{get_name(a)}</div>
                <Badge variant="outline" className="text-xs">{a.tier}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {locale === 'zh' && a.display_name_zh ? a.display_name : null}
                {locale === 'zh' && a.display_name_zh ? ' · ' : ''}
                {a.category}
              </div>
              {a.citation_required && (
                <Badge variant="outline" className="text-xs mt-1">{t('agents.citation_required')}</Badge>
              )}
            </button>
          ))}
          {catalog && catalog.count === 0 && (
            <p className="text-sm text-muted-foreground p-3">{t('agents.empty.tier')}</p>
          )}
        </div>

        <Card className="lg:col-span-2">
          {!selected ? (
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('agents.empty.select')}
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{get_name(selected)}</CardTitle>
                <CardDescription>
                  <code className="text-xs">{selected.id}</code> · {selected.tier} · {selected.category}
                  {locale === 'zh' && selected.display_name_zh && (
                    <span className="ml-2 text-muted-foreground">· {selected.display_name}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm whitespace-pre-line">{get_desc(selected)}</p>
                <div>
                  <div className="text-xs font-medium mb-1">{t('agents.section.capabilities')}</div>
                  <div className="flex gap-1 flex-wrap">
                    {selected.capabilities.map(c => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
                {selected.required_signoff_for_outputs.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1">{t('agents.section.signoffs')}</div>
                    <div className="flex gap-1 flex-wrap">
                      {selected.required_signoff_for_outputs.map(s => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selected.knowledge_acquisition && (
                  <div className="space-y-2 rounded border p-3 bg-muted/20">
                    <div className="text-xs font-medium">{t('agents.section.kb_contract')}</div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">{t('agents.kb.discovery')}:</span>{' '}
                      <Badge variant="outline" className="text-xs">{selected.knowledge_acquisition.discovery_method}</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t('agents.kb.jurisdictions')}</div>
                      <div className="flex gap-1 flex-wrap">
                        {selected.knowledge_acquisition.jurisdictions.map(j => (
                          <Badge key={j} variant="outline" className="text-xs">{j}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t('agents.kb.scope_in')}</div>
                      <div className="flex gap-1 flex-wrap">
                        {selected.knowledge_acquisition.scope_in.map(s => (
                          <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t('agents.kb.scope_out')}</div>
                      <div className="flex gap-1 flex-wrap">
                        {selected.knowledge_acquisition.scope_out.map(s => (
                          <Badge key={s} className="text-xs bg-destructive/10 text-destructive border-destructive/30" variant="outline">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Run panel */}
                <div className="rounded border p-3 space-y-2 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" />
                    <div className="text-sm font-semibold">{t('agents.run.title')}</div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('agents.run.subtitle')}</p>
                  <div>
                    <label className="text-xs font-medium block mb-1">{t('agents.run.prompt_label')}</label>
                    <textarea
                      value={run_prompt}
                      onChange={(e) => set_run_prompt(e.target.value)}
                      placeholder={t('agents.run.prompt_placeholder')}
                      rows={3}
                      className="w-full text-sm rounded border bg-background p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">{t('agents.run.context_label')}</label>
                    <textarea
                      value={run_context}
                      onChange={(e) => set_run_context(e.target.value)}
                      placeholder={t('agents.run.context_placeholder')}
                      rows={2}
                      className="w-full text-sm rounded border bg-background p-2 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={!run_prompt.trim() || run_mutation.isPending}
                      onClick={() => run_mutation.mutate({ id: selected.id, prompt: run_prompt, context: run_context })}
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      {run_mutation.isPending ? t('agents.run.button_running') : t('agents.run.button_run')}
                    </Button>
                  </div>

                  {run_error && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">
                      <div className="font-medium text-destructive mb-1">{t('agents.run.error_label')}</div>
                      <div className="font-mono">{run_error}</div>
                    </div>
                  )}

                  {run_result && (
                    <div className="space-y-2 mt-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant={run_result.mode === 'live' ? 'default' : 'outline'}>
                          {run_result.mode === 'live' ? t('agents.run.mode_live') : t('agents.run.mode_dry_run')}
                        </Badge>
                        <span className="text-muted-foreground">
                          {t('agents.run.provider_label')}: <code>{run_result.provider}</code>
                        </span>
                        <span className="text-muted-foreground">
                          {t('agents.run.model_label')}: <code>{run_result.model}</code>
                        </span>
                        <span className="text-muted-foreground">
                          {t('agents.run.usage_label')}: {run_result.usage.total_tokens}
                        </span>
                        <span className="text-muted-foreground">
                          {t('agents.run.elapsed_label')}: {run_result.ms_elapsed}ms
                        </span>
                      </div>
                      {run_result.mode === 'dry_run' && (
                        <div className="text-xs rounded border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-2 text-amber-900 dark:text-amber-200">
                          {t('agents.run.dry_run_notice')}
                        </div>
                      )}
                      {run_result.warnings.length > 0 && (
                        <div className="text-xs">
                          <div className="font-medium mb-1">{t('agents.run.warnings_label')}</div>
                          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                            {run_result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium mb-1">{t('agents.run.output_label')}</div>
                        <pre className="text-xs whitespace-pre-wrap p-3 rounded border bg-background max-h-72 overflow-y-auto">
                          {run_result.output}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {bundle && (
                  <div className="space-y-3 mt-4">
                    <Section title={`AGENT.md — ${bundle.agent_md_path}`} content={bundle.agent_md} />
                    {bundle.skills.map(s => (
                      <Section key={s.path} title={`SKILL.md — ${s.path}`} content={s.content} />
                    ))}
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Section({ title, content }: { title: string; content: string | null }) {
  const t = useT();
  return (
    <div>
      <div className="text-xs font-mono text-muted-foreground mb-1">{title}</div>
      <pre className="text-xs whitespace-pre-wrap p-3 rounded border bg-muted/30 max-h-60 overflow-y-auto">
        {content ?? t('agents.file.missing')}
      </pre>
    </div>
  );
}
