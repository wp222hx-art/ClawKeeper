// file: src/ipo/orchestration/agent_runner.ts
// description: AgentRunner — turns any of the 82 IPOPilot agents into an
//              executable LLM call. Builds a system prompt from the agent's
//              registry definition + AGENT.md + SKILL.md bundle, dispatches
//              the user's prompt to the configured LLM provider, and returns
//              a structured AgentRunResult with provider/model/usage metadata.
//
//              When no LLM provider is configured the runner produces a
//              deterministic "dry-run" response so the UI can still show what
//              the agent would do — every agent is therefore "runnable" even
//              before a provider is registered.
// reference: src/ipo/orchestration/agent_registry.ts,
//            src/ipo/orchestration/skill_loader.ts,
//            src/ipo/llm/registry.ts, src/ipo/llm/provider.ts

import { get_ipo_agent, type IpoAgentDefinition } from './agent_registry';
import { load_agent_skill_bundle } from './skill_loader';
import {
  llm_provider_registry,
  type LlmProviderRegistry,
} from '../llm/registry';
import {
  NotConfiguredError,
  ProviderError,
  type AiProviderCode,
  type ChatMessage,
  type LlmProvider,
} from '../llm/provider';
import type { TargetMarket } from '../types';
import {
  get_jurisdiction_standard,
  get_section_spec,
  render_format_block,
  type SectionFormatSpec,
  type JurisdictionFormatStandard,
} from '../prospectus/format_standards';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AgentRunRequest {
  agent_id: string;
  prompt: string;                       // The user's task / question for this agent
  locale?: 'en' | 'zh';                 // Drives prompt language; defaults to 'en'
  context?: string;                     // Optional extra context (project facts, file excerpts)
  provider_code?: AiProviderCode;       // Override default provider
  model?: string;                       // Override default model
  temperature?: number;
  max_tokens?: number;
  /**
   * Prospectus Format Standards (PFS) injection.
   * When both target_market and prospectus_section are provided, the runner
   * looks up the matching SectionFormatSpec from the PFS registry and injects
   * a "Format Standard (binding)" block into the agent's system_prompt so the
   * resulting draft conforms to the listing-jurisdiction's format.
   */
  target_market?: TargetMarket;
  prospectus_section?: string;
}

export interface PfsLintItem {
  id: string;
  label: string;
  covered: boolean;
  evidence?: string;
}

export interface PfsReport {
  target_market: TargetMarket;
  section_code: string;
  statutory_anchor: string;
  document_type: string;
  required_subheadings: string[];
  subheadings_present: string[];
  subheadings_missing: string[];
  required_elements_total: number;
  required_elements_covered: number;
  mandatory_disclosures_total: number;
  mandatory_disclosures_covered: number;
  word_count: number;
  word_count_min?: number;
  word_count_max?: number;
  word_count_ok: boolean;
  json_envelope_present: boolean;
  parsed_envelope_gaps: string[];
  parsed_envelope_checklist: PfsLintItem[];
  lint_violations: string[];
  compliance_score: number;             // 0-100, integer
}

export interface AgentRunResult {
  agent_id: string;
  agent_display_name: string;
  agent_display_name_zh: string;
  tier: string;
  category: string;
  provider: AiProviderCode | 'NONE';
  model: string;
  mode: 'live' | 'dry_run';             // 'dry_run' = no provider; deterministic stub
  output: string;
  finish_reason: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citation_required: boolean;
  required_signoffs: string[];
  warnings: string[];                   // e.g. missing AGENT.md, no provider, etc.
  ms_elapsed: number;
  started_at: string;
  /** PFS compliance report — only populated when target_market + prospectus_section were supplied. */
  pfs_report?: PfsReport;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

const MAX_AGENT_MD_CHARS = 8000;        // Hard cap so we never blow the context window
const MAX_SKILL_CHARS    = 6000;        // Per skill file
const MAX_CONTEXT_CHARS  = 6000;

function trim_block(s: string | null | undefined, cap: number): string {
  if (!s) return '';
  if (s.length <= cap) return s;
  return s.slice(0, cap) + `\n\n[…truncated, original ${s.length} chars]`;
}

function build_system_prompt(
  agent: IpoAgentDefinition,
  locale: 'en' | 'zh',
  warnings: string[],
  pfs?: { std: JurisdictionFormatStandard; spec: SectionFormatSpec },
): string {
  const bundle = load_agent_skill_bundle(agent.id);
  const sections: string[] = [];

  // Identity header — bilingual
  if (locale === 'zh') {
    sections.push(
      `你是 IPOPilot 平台中的「${agent.display_name_zh}」（id=${agent.id}）。\n` +
      `层级：${agent.tier} · 类别：${agent.category}。\n` +
      `职责：${agent.description_zh}`,
    );
  } else {
    sections.push(
      `You are "${agent.display_name}" (id=${agent.id}), an agent inside the IPOPilot platform.\n` +
      `Tier: ${agent.tier} · Category: ${agent.category}.\n` +
      `Mandate: ${agent.description}`,
    );
  }

  // Capabilities
  if (agent.capabilities.length > 0) {
    sections.push(
      (locale === 'zh' ? '能力：' : 'Capabilities: ') +
      agent.capabilities.join(', '),
    );
  }

  // Citation / signoff contract
  if (agent.citation_required) {
    sections.push(locale === 'zh'
      ? '⚠️ 你必须为每条结论提供可追溯到法规原文的引用。无引用的结论会被签批环节驳回。'
      : '⚠️ You MUST cite the underlying regulation chunk for every claim. Uncited claims will be rejected at sign-off.',
    );
  }
  if (agent.required_signoff_for_outputs && agent.required_signoff_for_outputs.length > 0) {
    sections.push(
      (locale === 'zh' ? '产出定稿前需要的签批：' : 'Required sign-offs before output is final: ') +
      agent.required_signoff_for_outputs.join(' · '),
    );
  }

  // Knowledge-acquisition boundary (only on agents that declare it)
  if (agent.knowledge_acquisition) {
    const ka = agent.knowledge_acquisition;
    sections.push(
      (locale === 'zh' ? '知识库边界：\n' : 'Knowledge boundary:\n') +
      `- ${locale === 'zh' ? '辖区' : 'jurisdictions'}: ${ka.jurisdictions.join(', ')}\n` +
      `- ${locale === 'zh' ? '范围内' : 'in scope'}: ${ka.scope_in.join('; ')}\n` +
      `- ${locale === 'zh' ? '范围外（拒绝）' : 'out of scope (refuse)'}: ${ka.scope_out.join('; ')}`,
    );
  }

  // AGENT.md
  if (bundle?.agent_md) {
    sections.push(
      (locale === 'zh' ? '## AGENT.md\n' : '## AGENT.md\n') +
      trim_block(bundle.agent_md, MAX_AGENT_MD_CHARS),
    );
  } else {
    warnings.push(`AGENT.md not present at ${agent.agent_md_path}`);
  }

  // SKILL.md files
  if (bundle && bundle.skills.length > 0) {
    const skill_blocks: string[] = [];
    for (const sk of bundle.skills) {
      if (sk.content) {
        skill_blocks.push(`### ${sk.path}\n${trim_block(sk.content, MAX_SKILL_CHARS)}`);
      } else {
        warnings.push(`SKILL.md not present at ${sk.path}`);
      }
    }
    if (skill_blocks.length > 0) {
      sections.push((locale === 'zh' ? '## 执行知识 (SKILL.md)\n' : '## Procedural knowledge (SKILL.md)\n') + skill_blocks.join('\n\n'));
    }
  }

  // Prospectus Format Standards (PFS) — binding when target_market + section
  // are supplied. This block goes LAST so its rules take precedence over the
  // generic output protocol.
  if (pfs) {
    sections.push(render_format_block(pfs.std, pfs.spec, locale));
  } else {
    // Output protocol — only used when no PFS spec is provided.
    sections.push(locale === 'zh'
      ? '## 输出协议\n请用中文作答。先给出 "结论"（要点列表），再给出 "依据"（引用 / 推理 / 计算细节），最后给出 "下一步"（建议的工作流动作）。如果信息不足以下结论，明确说明缺什么以及谁应当提供。'
      : '## Output protocol\nReply in English. Begin with "Findings" (bulleted), then "Reasoning" (citations / derivations / calculations), then "Next Actions" (recommended workstream moves). If information is insufficient, state explicitly what is missing and who should supply it.',
    );
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Dry-run synth (when no provider configured) — keeps every agent runnable
// ---------------------------------------------------------------------------

function synth_dry_run_output(
  agent: IpoAgentDefinition,
  prompt: string,
  context: string | undefined,
  locale: 'en' | 'zh',
): string {
  const cap_list = agent.capabilities.slice(0, 6).map(c => `- ${c}`).join('\n');
  const sign = (agent.required_signoff_for_outputs ?? []).join(' · ') || (locale === 'zh' ? '无' : 'none');
  const cite = agent.citation_required
    ? (locale === 'zh' ? '✅ 是（每条结论都需引用）' : '✅ yes (every claim must cite)')
    : (locale === 'zh' ? '— 非必需' : '— not required');
  const ctx_block = context && context.trim().length > 0
    ? (locale === 'zh' ? `\n上下文：\n${trim_block(context, 1500)}\n` : `\nContext:\n${trim_block(context, 1500)}\n`)
    : '';

  if (locale === 'zh') {
    return [
      `【${agent.display_name_zh}】演示输出（未配置 AI Provider，无真实 LLM 调用）`,
      ``,
      `用户请求：`,
      trim_block(prompt, 800),
      ctx_block,
      `结论：`,
      `- 该 Agent 已就绪，但平台尚未配置可用的 AI Provider。`,
      `- 若已配置 Provider，本 Agent 将基于其 AGENT.md / SKILL.md 与上述请求生成结构化结论、依据与下一步行动。`,
      ``,
      `本 Agent 摘要：`,
      `- 层级 / 类别：${agent.tier} · ${agent.category}`,
      `- 是否需引用：${cite}`,
      `- 产出定稿所需签批：${sign}`,
      `- 主要能力：`,
      cap_list || '- （未声明）',
      ``,
      `下一步：在「设置 → AI Providers」注册任一 Provider 并设为默认，然后重新执行本 Agent。`,
    ].join('\n');
  }
  return [
    `[${agent.display_name}] dry-run output (no AI provider configured — no real LLM call was made).`,
    ``,
    `User request:`,
    trim_block(prompt, 800),
    ctx_block,
    `Findings:`,
    `- The agent is wired and ready, but no AI provider is registered on this server.`,
    `- Once a provider is configured, this agent will generate structured Findings / Reasoning / Next-Actions grounded in its AGENT.md and SKILL.md bundle.`,
    ``,
    `Agent summary:`,
    `- Tier / category: ${agent.tier} · ${agent.category}`,
    `- Citation required: ${cite}`,
    `- Required sign-offs before final: ${sign}`,
    `- Top capabilities:`,
    cap_list || '- (none declared)',
    ``,
    `Next action: register any provider under Settings → AI Providers and mark it default, then re-run this agent.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export class AgentRunner {
  constructor(private registry: LlmProviderRegistry = llm_provider_registry) {}

  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const started = Date.now();
    const started_at = new Date().toISOString();
    const locale: 'en' | 'zh' = req.locale === 'zh' ? 'zh' : 'en';

    const agent = get_ipo_agent(req.agent_id);
    if (!agent) {
      throw new AgentNotFoundError(req.agent_id);
    }
    if (!req.prompt || req.prompt.trim().length === 0) {
      throw new InvalidPromptError(locale === 'zh'
        ? '请提供 prompt（要交给该 Agent 处理的任务或问题）。'
        : 'Provide a non-empty prompt describing the task for this agent.');
    }

    const warnings: string[] = [];

    // Resolve PFS spec if both target_market + prospectus_section provided.
    let pfs_pair: { std: JurisdictionFormatStandard; spec: SectionFormatSpec } | undefined;
    if (req.target_market && req.prospectus_section) {
      const std = get_jurisdiction_standard(req.target_market);
      const spec = get_section_spec(req.target_market, req.prospectus_section);
      if (std && spec) {
        pfs_pair = { std, spec };
      } else {
        warnings.push(
          `PFS: no format spec found for target_market=${req.target_market} ` +
          `section=${req.prospectus_section}; falling back to generic protocol.`,
        );
      }
    }

    const system_prompt = build_system_prompt(agent, locale, warnings, pfs_pair);

    const user_msg_parts: string[] = [];
    if (req.context && req.context.trim().length > 0) {
      user_msg_parts.push(
        (locale === 'zh' ? '## 上下文\n' : '## Context\n') +
        trim_block(req.context, MAX_CONTEXT_CHARS),
      );
    }
    user_msg_parts.push(
      (locale === 'zh' ? '## 任务\n' : '## Task\n') + req.prompt.trim(),
    );

    // No provider configured → deterministic dry-run so the UI flow still works
    if (!this.registry.is_configured()) {
      warnings.push('No AI provider configured — returning dry-run output.');
      const out = synth_dry_run_output(agent, req.prompt, req.context, locale);
      const dry_pfs_report = pfs_pair
        ? lint_pfs_output(out, pfs_pair.std, pfs_pair.spec)
        : undefined;
      return {
        agent_id:                agent.id,
        agent_display_name:      agent.display_name,
        agent_display_name_zh:   agent.display_name_zh,
        tier:                    agent.tier,
        category:                agent.category,
        provider:                'NONE',
        model:                   'dry-run',
        mode:                    'dry_run',
        output:                  out,
        finish_reason:           'stop',
        usage:                   { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        citation_required:       agent.citation_required,
        required_signoffs:       agent.required_signoff_for_outputs ?? [],
        warnings,
        ms_elapsed:              Date.now() - started,
        started_at,
        pfs_report:              dry_pfs_report,
      };
    }

    let provider: LlmProvider;
    try {
      provider = req.provider_code
        ? this.registry.get(req.provider_code)
        : this.registry.get_default();
    } catch (e) {
      if (e instanceof NotConfiguredError) throw e;
      throw e;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: system_prompt },
      { role: 'user',   content: user_msg_parts.join('\n\n') },
    ];

    const model = req.model || provider.default_chat_model;

    let resp;
    try {
      resp = await provider.chat({
        model,
        messages,
        temperature: req.temperature ?? 0.2,
        max_tokens:  req.max_tokens,
        metadata: {
          agent_id: agent.id,
          tier:     agent.tier,
          category: agent.category,
          locale,
        },
      });
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(provider.code, null, (e as Error).message);
    }

    const pfs_report = pfs_pair ? lint_pfs_output(resp.content, pfs_pair.std, pfs_pair.spec) : undefined;

    return {
      agent_id:              agent.id,
      agent_display_name:    agent.display_name,
      agent_display_name_zh: agent.display_name_zh,
      tier:                  agent.tier,
      category:              agent.category,
      provider:              resp.provider,
      model:                 resp.model,
      mode:                  'live',
      output:                resp.content,
      finish_reason:         resp.finish_reason,
      usage:                 resp.usage,
      citation_required:     agent.citation_required,
      required_signoffs:     agent.required_signoff_for_outputs ?? [],
      warnings,
      ms_elapsed:            Date.now() - started,
      started_at,
      pfs_report,
    };
  }
}

// ---------------------------------------------------------------------------
// PFS Compliance Linter — Layer 4
// Validates the agent's Markdown + JSON output against the SectionFormatSpec
// and returns a structured PfsReport. Never throws; degrades gracefully when
// the JSON envelope is missing or malformed.
// ---------------------------------------------------------------------------

function strip_diacritics_lower(s: string): string {
  return s.toLowerCase().normalize('NFKC');
}

function count_words(s: string): number {
  if (!s) return 0;
  // Mixed CJK + Latin: count CJK ideographs as 1 each + whitespace-delimited Latin words.
  const cjk_matches = s.match(/[\u3400-\u9fff\uf900-\ufaff]/g);
  const cjk_count = cjk_matches ? cjk_matches.length : 0;
  const latin = s.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
  const latin_words = latin.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
  return cjk_count + latin_words;
}

function find_first_json_block(output: string): string | null {
  // Prefer fenced ```json ... ``` blocks
  const fenced = output.match(/```json\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  // Fallback: greedy {...} that looks like our envelope
  const idx = output.indexOf('"compliance_checklist"');
  if (idx >= 0) {
    let start = idx;
    while (start > 0 && output[start] !== '{') start--;
    let depth = 0;
    for (let i = start; i < output.length; i++) {
      if (output[i] === '{') depth++;
      else if (output[i] === '}') {
        depth--;
        if (depth === 0) return output.slice(start, i + 1);
      }
    }
  }
  return null;
}

interface ParsedEnvelope {
  meta?: { word_count?: number; locale?: string };
  sections?: Array<{ heading?: string; body?: string; citations?: string[] }>;
  compliance_checklist?: PfsLintItem[];
  gaps?: string[];
}

function try_parse_envelope(output: string): ParsedEnvelope | null {
  const block = find_first_json_block(output);
  if (!block) return null;
  try {
    const parsed = JSON.parse(block);
    if (parsed && typeof parsed === 'object') return parsed as ParsedEnvelope;
  } catch {
    // ignore — leniently return null
  }
  return null;
}

export function lint_pfs_output(
  output: string,
  std: JurisdictionFormatStandard,
  spec: SectionFormatSpec,
): PfsReport {
  const lower = strip_diacritics_lower(output);
  const violations: string[] = [];

  // Subheading coverage — case-insensitive substring.
  const present: string[] = [];
  const missing: string[] = [];
  for (const h of spec.output_schema.required_subheadings) {
    if (lower.includes(strip_diacritics_lower(h))) present.push(h);
    else missing.push(h);
  }
  if (missing.length > 0) {
    violations.push(`Missing ${missing.length} required subheading(s): ${missing.slice(0, 5).join(' · ')}${missing.length > 5 ? ' …' : ''}`);
  }

  // Required-elements coverage — substring of the human-readable description after the colon
  let elements_covered = 0;
  for (const el of spec.required_elements) {
    const colon = el.indexOf(':');
    const phrase = colon >= 0 ? el.slice(colon + 1).trim() : el;
    const tokens = phrase.toLowerCase().split(/[^a-z\u3400-\u9fff]+/).filter(Boolean).slice(0, 4);
    if (tokens.length === 0) { elements_covered++; continue; }
    const all_present = tokens.every(t => lower.includes(t));
    if (all_present) elements_covered++;
  }
  if (elements_covered < spec.required_elements.length) {
    violations.push(`Required elements covered: ${elements_covered}/${spec.required_elements.length}`);
  }

  // Mandatory disclosures — substring of first 6 words
  let disclosures_covered = 0;
  for (const d of spec.mandatory_disclosures) {
    const head = d.toLowerCase().split(/\s+/).slice(0, 6).join(' ');
    if (lower.includes(head)) disclosures_covered++;
  }
  if (disclosures_covered < spec.mandatory_disclosures.length) {
    violations.push(`Mandatory disclosures covered: ${disclosures_covered}/${spec.mandatory_disclosures.length}`);
  }

  // JSON envelope
  const envelope = try_parse_envelope(output);
  const envelope_present = envelope !== null;
  if (!envelope_present) violations.push('JSON envelope missing or unparseable.');

  // Word count
  const wc_from_envelope = envelope?.meta?.word_count;
  const wc = typeof wc_from_envelope === 'number' && wc_from_envelope > 0
    ? wc_from_envelope
    : count_words(output);
  let wc_ok = true;
  if (spec.min_word_count && wc < spec.min_word_count) {
    wc_ok = false;
    violations.push(`Word count ${wc} below minimum ${spec.min_word_count}.`);
  }
  if (spec.max_word_count && wc > spec.max_word_count) {
    wc_ok = false;
    violations.push(`Word count ${wc} above maximum ${spec.max_word_count}.`);
  }

  // Weighted score
  const sub_pct = spec.output_schema.required_subheadings.length === 0
    ? 1
    : present.length / spec.output_schema.required_subheadings.length;
  const elem_pct = spec.required_elements.length === 0
    ? 1
    : elements_covered / spec.required_elements.length;
  const disc_pct = spec.mandatory_disclosures.length === 0
    ? 1
    : disclosures_covered / spec.mandatory_disclosures.length;
  const env_pct = envelope_present ? 1 : 0;
  const wc_pct = wc_ok ? 1 : 0.5;

  const score_raw = (
    sub_pct  * 0.30 +
    elem_pct * 0.30 +
    disc_pct * 0.20 +
    env_pct  * 0.10 +
    wc_pct   * 0.10
  );
  const score = Math.round(Math.max(0, Math.min(1, score_raw)) * 100);

  return {
    target_market:                   std.target_market,
    section_code:                    spec.section_code,
    statutory_anchor:                spec.statutory_anchor,
    document_type:                   std.document_type,
    required_subheadings:            spec.output_schema.required_subheadings,
    subheadings_present:             present,
    subheadings_missing:             missing,
    required_elements_total:         spec.required_elements.length,
    required_elements_covered:       elements_covered,
    mandatory_disclosures_total:     spec.mandatory_disclosures.length,
    mandatory_disclosures_covered:   disclosures_covered,
    word_count:                      wc,
    word_count_min:                  spec.min_word_count,
    word_count_max:                  spec.max_word_count,
    word_count_ok:                   wc_ok,
    json_envelope_present:           envelope_present,
    parsed_envelope_gaps:            Array.isArray(envelope?.gaps) ? envelope!.gaps as string[] : [],
    parsed_envelope_checklist:       Array.isArray(envelope?.compliance_checklist)
      ? envelope!.compliance_checklist as PfsLintItem[]
      : [],
    lint_violations:                 violations,
    compliance_score:                score,
  };
}

// Singleton
export const agent_runner = new AgentRunner();

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AgentNotFoundError extends Error {
  constructor(public agent_id: string) {
    super(`Unknown agent id: ${agent_id}`);
    this.name = 'AgentNotFoundError';
  }
}

export class InvalidPromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPromptError';
  }
}
