// file: scripts/generate-ipo-agent-docs.ts
// description: One-shot generator for AGENT.md + SKILL.md skeleton files
//              based on src/ipo/orchestration/agent_registry.ts.
//              Idempotent: skips files that already exist (so hand-edits survive).
// usage: bun run scripts/generate-ipo-agent-docs.ts

import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ALL_IPO_AGENTS, type IpoAgentDefinition } from '../src/ipo/orchestration/agent_registry';

const ROOT = resolve(import.meta.dir, '..');

function ensure_dir(file_path: string): void {
  const dir = dirname(file_path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function render_agent_md(agent: IpoAgentDefinition): string {
  const signoff_line = agent.required_signoff_for_outputs?.length
    ? agent.required_signoff_for_outputs.join(', ')
    : '(none — advisory output)';
  const cite_line = agent.citation_required ? 'YES — every regulatory claim MUST link to ipo_regulation_chunks' : 'no';
  const skill_lines = agent.skill_files.map(s => `- \`${s}\``).join('\n');
  const cap_lines = agent.capabilities.map(c => `- \`${c}\``).join('\n');

  return `# AGENT — ${agent.display_name}

> id: \`${agent.id}\`  ·  tier: \`${agent.tier}\`  ·  category: \`${agent.category}\`

## Purpose

${agent.description}

## Operating Principles

1. **AI Co-Pilot, not auto-pilot** — All material outputs are surfaced as
   *recommendations* with confidence + rationale. A licensed human
   (lawyer / auditor / CFO / sponsor) MUST sign off before any document
   is finalized, filed, or sent to a regulator.
2. **Citation-grounded** — Citation required: **${cite_line}**.
3. **Stage-aware** — This agent only acts inside its assigned workstream
   and only during stages where the workstream is active (see
   \`src/ipo/orchestration/stages.ts\` and
   \`src/ipo/orchestration/workstream_blueprint.ts\`).
4. **Tenant-isolated** — Every read/write goes through the row-level
   security context established by the calling request.

## Capabilities

${cap_lines}

## Skills (loaded from)

${skill_lines}

## Required Sign-offs Before Output is Final

${signoff_line}

## Inputs

- Project context: \`{ project_id, target_market, industry, listing_structure, current_stage }\`
- Tenant context: \`{ tenant_id, user_id, role }\`
- Workstream context: \`{ workstream_id, workstream_type }\`
- Domain inputs: see the SKILL.md for the actual prompt schema.

## Outputs

- Structured JSON envelope: \`{ summary, findings[], citations[], recommended_actions[], confidence }\`
- Optional artifact files (working papers, memos, schedules) written to
  the project document store with status \`draft\` until signed off.

## Failure Modes & Escalation

- Insufficient data → emit a finding with severity \`MEDIUM\`,
  category \`DATA_GAP\`, and route the project back one stage.
- Conflicting regulation interpretations → escalate to the
  Jurisdiction Lead for resolution.
- Human override → record reason in \`ipo_review_signoffs.notes\`;
  do not silently overwrite.

---
*Auto-generated skeleton — extend with concrete prompts, examples, and
acceptance tests as the agent matures.*
`;
}

function render_skill_md(skill_path: string, agent: IpoAgentDefinition): string {
  const skill_name = skill_path
    .replace(/^skills\/ipo\//, '')
    .replace(/\/SKILL\.md$/, '');
  return `# SKILL — ${skill_name}

> Bound to agent: \`${agent.id}\` (${agent.display_name})

## When to use

Invoked by \`${agent.id}\` whenever its capabilities are routed:
${agent.capabilities.map(c => `- \`${c}\``).join('\n')}

## Inputs (schema)

\`\`\`ts
// TODO: tighten this contract per skill
interface ${skill_to_pascal(skill_name)}Input {
  project_id: string;
  tenant_id: string;
  target_market: 'US_NASDAQ' | 'US_NYSE' | 'HK_MAIN' | 'HK_GEM';
  industry: 'SAAS' | 'BIOPHARMA' | 'CLEAN_ENERGY' | 'OTHER';
  payload: unknown; // skill-specific
}
\`\`\`

## Procedure

1. **Retrieve context** — call \`ipo_regulation_retriever\` /
   \`ipo_industry_benchmark_retriever\` as needed.
2. **Reason** — apply the rule(s) below to the payload, producing draft
   findings or draft text.
3. **Cite** — ${agent.citation_required ? 'every regulatory or accounting claim MUST be linked to a `ipo_regulation_chunks.id`. Outputs without citations are rejected by the orchestration service.' : 'cite when invoking external rules; non-mandatory.'}
4. **Hand off** — return the standard envelope; do NOT mark the
   document as final — that is the human signer's exclusive right.

## Outputs (schema)

\`\`\`ts
interface ${skill_to_pascal(skill_name)}Output {
  summary: string;
  findings: Array<{
    category: string;
    severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    recommended_action: string | null;
    citations: string[]; // ipo_regulation_chunks.id
  }>;
  recommended_actions: string[];
  confidence: number; // 0..1
}
\`\`\`

## Authoritative Sources

- Markets: SEC (Reg S-K, Reg S-X, S-1, F-1, SOX, JOBS Act),
  Nasdaq / NYSE Listing Rules, HKEX Main Board Rules, GEM Rules,
  HKEX Guidance Letters, Appendix 27 ESG Reporting Guide.
- Accounting: US GAAP (ASC 606, 718, 842), IFRS (15, 16),
  PCAOB AS 2201, AS 1105, AS 1215, AS 2401, AS 2315.
- Industry-specific authorities are listed in the corresponding
  industry agent's AGENT.md.

## Acceptance Tests

- [ ] Returns valid envelope conforming to the output schema.
- [ ] ${agent.citation_required ? 'Every regulatory claim contains at least one valid citation.' : 'Recommendations are traceable to inputs.'}
- [ ] Confidence is calibrated against historical comment-letter outcomes (Phase 2).

---
*Auto-generated skeleton — replace placeholders with the canonical
prompt, examples, and golden-test cases for this skill.*
`;
}

function skill_to_pascal(name: string): string {
  return name
    .split(/[-/]/)
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
let agent_md_created = 0;
let agent_md_skipped = 0;
let skill_md_created = 0;
let skill_md_skipped = 0;

const seen_skill_paths = new Map<string, IpoAgentDefinition>();

for (const agent of ALL_IPO_AGENTS) {
  // AGENT.md
  const agent_md_full = resolve(ROOT, agent.agent_md_path);
  ensure_dir(agent_md_full);
  if (existsSync(agent_md_full)) {
    agent_md_skipped++;
  } else {
    writeFileSync(agent_md_full, render_agent_md(agent), 'utf8');
    agent_md_created++;
  }

  // SKILL.md(s) — one agent may bind to multiple skills; only the
  // first agent that references the skill wins as "home" for the skeleton.
  for (const skill of agent.skill_files) {
    if (seen_skill_paths.has(skill)) continue;
    seen_skill_paths.set(skill, agent);
    const skill_full = resolve(ROOT, skill);
    ensure_dir(skill_full);
    if (existsSync(skill_full)) {
      skill_md_skipped++;
    } else {
      writeFileSync(skill_full, render_skill_md(skill, agent), 'utf8');
      skill_md_created++;
    }
  }
}

console.log(`AGENT.md: ${agent_md_created} created, ${agent_md_skipped} skipped`);
console.log(`SKILL.md: ${skill_md_created} created, ${skill_md_skipped} skipped`);
console.log(`Total agents: ${ALL_IPO_AGENTS.length}`);
console.log(`Total unique skills: ${seen_skill_paths.size}`);
