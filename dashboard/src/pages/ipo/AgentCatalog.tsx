// file: dashboard/src/pages/ipo/AgentCatalog.tsx
// description: IPO Agent Catalog — browse the ~80 IPO agents by tier and
//              category, drill into each agent's AGENT.md + SKILL.md bundle.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, Bot } from 'lucide-react';
import { ipo_api, type IpoAgentCatalogItem } from '@/lib/ipo-api';

const TIERS = ['ALL', 'CEO', 'JURISDICTION_LEAD', 'INDUSTRY_LEAD', 'FUNCTIONAL_LEAD', 'WORKER'];

export function IpoAgentCatalog() {
  const [tier, set_tier] = useState<string>('ALL');
  const [selected, set_selected] = useState<IpoAgentCatalogItem | null>(null);

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
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8 text-primary" /> IPO Agent Catalog
        </h1>
        <p className="text-muted-foreground mt-1">
          ~80 specialized agents organized into a 3-tier pyramid (CEO → Lead → Worker).
          Each agent has a canonical AGENT.md describing its purpose and SKILL.md files
          defining its procedural knowledge.
        </p>
        {coverage && (
          <div className="text-xs text-muted-foreground mt-2">
            Coverage: {coverage.agents_with_agent_md}/{coverage.total_agents} AGENT.md ·
            {' '}{coverage.skills_with_content}/{coverage.unique_skills} SKILL.md present on disk
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {TIERS.map(t => (
          <Button
            key={t}
            variant={tier === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => { set_tier(t); set_selected(null); }}
          >
            {t}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-2 max-h-[80vh] overflow-y-auto">
          {catalog?.agents.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => set_selected(a)}
              className={`w-full text-left p-3 rounded border transition-colors ${
                selected?.id === a.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm">{a.display_name}</div>
                <Badge variant="outline" className="text-xs">{a.tier}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{a.category}</div>
              {a.citation_required && (
                <Badge variant="outline" className="text-xs mt-1">📚 Citation required</Badge>
              )}
            </button>
          ))}
          {catalog && catalog.count === 0 && (
            <p className="text-sm text-muted-foreground p-3">No agents in this tier.</p>
          )}
        </div>

        <Card className="lg:col-span-2">
          {!selected ? (
            <CardContent className="py-12 text-center text-muted-foreground">
              Select an agent on the left to inspect its AGENT.md + SKILL.md bundle.
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{selected.display_name}</CardTitle>
                <CardDescription>
                  <code className="text-xs">{selected.id}</code> · {selected.tier} · {selected.category}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{selected.description}</p>
                <div>
                  <div className="text-xs font-medium mb-1">Capabilities</div>
                  <div className="flex gap-1 flex-wrap">
                    {selected.capabilities.map(c => (
                      <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
                {selected.required_signoff_for_outputs.length > 0 && (
                  <div>
                    <div className="text-xs font-medium mb-1">Required signoffs before output is final</div>
                    <div className="flex gap-1 flex-wrap">
                      {selected.required_signoff_for_outputs.map(s => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

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
  return (
    <div>
      <div className="text-xs font-mono text-muted-foreground mb-1">{title}</div>
      <pre className="text-xs whitespace-pre-wrap p-3 rounded border bg-muted/30 max-h-60 overflow-y-auto">
        {content ?? '(file not present)'}
      </pre>
    </div>
  );
}
