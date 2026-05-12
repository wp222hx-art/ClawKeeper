// file: src/ipo/orchestration/agent_prompt_presets.ts
// description: Agent Prompt Preset Library — pre-baked, jurisdiction-aware
//              prompt templates for every IPOPilot agent. Indexed by
//              (agent_id × target_market × locale). Frees the dashboard from
//              having to hand-craft prompts and guarantees that whichever
//              listing venue the project picks (SEC NASDAQ/NYSE or HKEX
//              Main/GEM), the AI request is grounded in the correct
//              regulatory citations, mandatory disclosure phrases, and
//              jurisdiction-specific output expectations.
//
//              How it relates to the rest of the stack:
//                - PFS_REGISTRY (src/ipo/prospectus/format_standards.ts)
//                  controls *output format* of prospectus sections.
//                - This file controls the *input prompt* given to the agent
//                  in the first place.
//              When both apply (prospectus drafter agents), the preset auto-
//              binds prospectus_section so PFS injection happens for free.
//
// reference: src/ipo/orchestration/agent_registry.ts (82 agent IDs),
//            src/ipo/types/index.ts (TargetMarket enum),
//            src/ipo/prospectus/format_standards.ts (PFS standards)

import type { TargetMarket } from '../types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Maps an agent id to a small set of project-data variables it expects. */
export interface PresetVariableSpec {
  /** Variable name as it appears in the template (e.g. "company_name"). */
  name: string;
  /** Human-readable description of what to fill in. */
  label_en: string;
  label_zh: string;
  /** True if the agent really cannot run without this. */
  required: boolean;
  /** Default placeholder if the caller doesn't supply a real value. */
  default_placeholder?: string;
}

/** A single (agent × market × locale) prompt template. */
export interface PresetTemplate {
  /** Agent that consumes this preset. */
  agent_id: string;
  /** Listing jurisdiction this preset is calibrated for. */
  target_market: TargetMarket | 'ANY';
  /** Output language. */
  locale: 'en' | 'zh';
  /** Short label shown in the UI before the user runs the agent. */
  task_label_en: string;
  task_label_zh: string;
  /**
   * Body of the user-facing prompt. May contain `{{var_name}}` placeholders
   * that will be substituted by `render_preset()` from the supplied vars.
   */
  instruction: string;
  /**
   * Jurisdictional clauses — bulleted list of regulation anchors the model
   * MUST cite or comply with. Rendered as a "## Jurisdictional Compliance"
   * block in the final prompt.
   */
  jurisdiction_clauses: string[];
  /** Output-format requirements (Findings/Reasoning/Next-Actions etc.). */
  output_format: string;
  /** Variables this preset needs filled in by the caller. */
  variables: PresetVariableSpec[];
  /**
   * If non-null, the preset will be sent to agent_runner with PFS injection
   * enabled. Use this for any agent that drafts a prospectus section.
   */
  prospectus_section?: string;
  /**
   * Suggested max_tokens. Long-form drafters need ~12000; analyzers need
   * ~3000. agent_runner caller may override.
   */
  suggested_max_tokens?: number;
}

/** Render result: the fully-substituted prompt + the routing hints. */
export interface RenderedPreset {
  prompt: string;
  prospectus_section?: string;
  suggested_max_tokens?: number;
  task_label: string;
  unfilled_variables: string[];
}

// ---------------------------------------------------------------------------
// Standard reusable text fragments
// ---------------------------------------------------------------------------

const SEC_GLOBAL_CLAUSES_EN = [
  'Securities Act of 1933 §11 / §12(a)(2) — material misstatement / omission liability.',
  'Reg S-K (17 CFR 229) — non-financial disclosure requirements.',
  'Reg S-X (17 CFR 210) — financial-statement form and content.',
  'PSLRA safe harbor (15 U.S.C. §78u-5) — forward-looking statements must carry meaningful cautionary language.',
  'Securities Act Rule 421(d) — plain-English mandate.',
  'PCAOB auditing standards — wherever the work product touches the audit file.',
];

const SEC_GLOBAL_CLAUSES_ZH = [
  '美国《1933 年证券法》第 11 条 / 第 12(a)(2) 条 —— 重大误述 / 重大遗漏责任。',
  'Reg S-K（17 CFR 229）—— 非财务披露要求。',
  'Reg S-X（17 CFR 210）—— 财务报表的格式与内容要求。',
  'PSLRA 安全港（15 U.S.C. §78u-5）—— 前瞻性陈述必须附实质性警示语。',
  '《证券法》Rule 421(d) —— 通俗英语披露义务。',
  'PCAOB 审计准则 —— 凡涉及审计工作底稿的工作产品均须遵守。',
];

const HKEX_MAIN_GLOBAL_CLAUSES_EN = [
  'HKEX Main Board Listing Rules (full set), with default anchors in App.1A and Ch.4 / Ch.8 / Ch.11.',
  'Companies (Winding Up and Miscellaneous Provisions) Ordinance Part XII Third Schedule.',
  'SFO (Cap. 571) — market-misconduct and disclosure-of-interests provisions.',
  'GL86-16 (Summary), GL103-19 (Industry Consultant), and other applicable HKEX guidance letters.',
  'CSRC Overseas Listing Trial Measures (March 2023) — for PRC-domiciled issuers.',
  'HKFRS / IFRS — financial-statement framework; reconciliations required if other GAAP used.',
];

const HKEX_MAIN_GLOBAL_CLAUSES_ZH = [
  '《香港联交所主板上市规则》全文，默认锚点：App.1A、Ch.4、Ch.8、Ch.11。',
  '《公司（清盘及杂项条文）条例》第 XII 部第三附表。',
  '《证券及期货条例》（第 571 章）—— 市场失当行为及权益披露条款。',
  'GL86-16（摘要章节）、GL103-19（行业顾问）及其他适用的联交所指引信。',
  '中国证监会《境外发行上市备案管理试行办法》（2023 年 3 月）—— 适用于中国境内主体。',
  'HKFRS / IFRS —— 财务报表框架；如使用其他 GAAP 须做调节披露。',
];

const HKEX_GEM_GLOBAL_CLAUSES_EN = [
  'HKEX GEM Listing Rules (App.1B, Ch.11 track-record, Ch.14 connected transactions).',
  '2-year track record (vs 3 years for Main Board).',
  'GEM is for SMEs — every output must reinforce the higher-risk profile in disclosure tone.',
  ...HKEX_MAIN_GLOBAL_CLAUSES_EN.slice(1, 5),
];

const HKEX_GEM_GLOBAL_CLAUSES_ZH = [
  '《香港联交所 GEM 上市规则》（App.1B、Ch.11 业绩纪录、Ch.14 关连交易）。',
  '业绩纪录期 2 个财政年度（主板为 3 年）。',
  'GEM 面向中小企业 —— 所有产出在披露口径上必须体现更高风险特征。',
  ...HKEX_MAIN_GLOBAL_CLAUSES_ZH.slice(1, 5),
];

const STD_OUTPUT_FORMAT_EN =
  'Reply in English. Begin with "Findings" (bulleted), then "Reasoning" ' +
  '(citations / derivations / numerical work), then "Next Actions" ' +
  '(workstream moves recommended to the human team). Where data is missing, ' +
  'state the gap explicitly and tag the responsible party (Management / ' +
  'Auditor / Legal Counsel / Sponsor).';

const STD_OUTPUT_FORMAT_ZH =
  '请用中文作答。先给出"结论"（要点式），再给出"依据"（引用 / 推导 / ' +
  '数值过程），最后给出"下一步"（建议的工作流动作）。若信息不足，明确指出 ' +
  '缺什么以及应由谁提供（管理层 / 审计师 / 法律顾问 / 保荐人）。';

const PROSPECTUS_OUTPUT_FORMAT_EN =
  'Reply in English. Strictly follow the "Format Standard (binding)" block ' +
  'that the system has prepended (PFS injection). Output Markdown body under ' +
  'all required subheadings, then a fenced ```json compliance envelope ' +
  '({meta, sections, compliance_checklist, gaps}) at the very end. Reserve ' +
  '>=600 tokens for the envelope. Do NOT fabricate company-specific facts; ' +
  'flag missing data in gaps[] with the responsible party.';

const PROSPECTUS_OUTPUT_FORMAT_ZH =
  '请用中文作答。严格遵守系统前置的「格式标准（强制约束）」（PFS 注入）。 ' +
  '先按全部必备子节标题输出 Markdown 章节正文，最后必须附加 ```json 合规 ' +
  '信封（{meta, sections, compliance_checklist, gaps}）。预留至少 600 token 给 ' +
  '信封。禁止编造公司特定事实；缺失数据登记到 gaps[] 并标注责任方。';

// ---------------------------------------------------------------------------
// Standard variable specs reused across many agents
// ---------------------------------------------------------------------------

const COMPANY_VARS: PresetVariableSpec[] = [
  { name: 'company_name', label_en: 'Issuer legal name', label_zh: '发行人法定名称', required: true,  default_placeholder: '[Issuer]' },
  { name: 'industry',     label_en: 'Industry / sector', label_zh: '行业 / 主业',     required: false, default_placeholder: '[industry]' },
  { name: 'fiscal_year',  label_en: 'Most recent fiscal year-end', label_zh: '最近一个会计年度截止日', required: false, default_placeholder: '[FY-end]' },
];

const PROJECT_VARS: PresetVariableSpec[] = [
  { name: 'project_id',    label_en: 'IPOPilot project id',  label_zh: 'IPOPilot 项目 ID',  required: true, default_placeholder: '[project]' },
  ...COMPANY_VARS,
];

// ---------------------------------------------------------------------------
// Helper to clone a SEC preset across all 5 SEC venues
// ---------------------------------------------------------------------------

const SEC_VENUES: TargetMarket[] = [
  'SEC_NASDAQ_GS', 'SEC_NASDAQ_GM', 'SEC_NASDAQ_CM',
  'SEC_NYSE', 'SEC_NYSE_AMERICAN',
];

function venue_label(market: TargetMarket): string {
  return ({
    SEC_NASDAQ_GS:     'Nasdaq Global Select Market',
    SEC_NASDAQ_GM:     'Nasdaq Global Market',
    SEC_NASDAQ_CM:     'Nasdaq Capital Market',
    SEC_NYSE:          'NYSE',
    SEC_NYSE_AMERICAN: 'NYSE American',
    HKEX_MAIN:         'HKEX Main Board',
    HKEX_GEM:          'HKEX GEM',
  } as Record<TargetMarket, string>)[market];
}

function venue_label_zh(market: TargetMarket): string {
  return ({
    SEC_NASDAQ_GS:     '纳斯达克全球精选市场',
    SEC_NASDAQ_GM:     '纳斯达克全球市场',
    SEC_NASDAQ_CM:     '纳斯达克资本市场',
    SEC_NYSE:          '纽约证券交易所',
    SEC_NYSE_AMERICAN: '纽交所美国市场',
    HKEX_MAIN:         '香港联交所主板',
    HKEX_GEM:          '香港联交所 GEM',
  } as Record<TargetMarket, string>)[market];
}

function fan_out_sec(make: (m: TargetMarket) => Omit<PresetTemplate, 'target_market'>): PresetTemplate[] {
  return SEC_VENUES.map(m => ({ ...make(m), target_market: m }));
}

// ---------------------------------------------------------------------------
// BATCH 1A — Financial Diagnosis (7 agents)
// Cross-jurisdiction (financial analysis is largely accounting-framework
// driven, not exchange-specific). We register a SEC variant + an HKEX variant
// for each, with the differing GAAP framework & disclosure expectations.
// ---------------------------------------------------------------------------

const FINANCIAL_AGENTS: Array<{
  id: string;
  task_en: string;
  task_zh: string;
  focus_en: string;
  focus_zh: string;
}> = [
  {
    id: 'ipo_revenue_quality_analyzer',
    task_en: 'Analyze revenue quality (recognition policy, concentration, durability, recurring vs one-off, deferred-revenue trend).',
    task_zh: '分析收入质量（确认政策、客户集中度、持续性、经常性 vs 一次性、递延收入趋势）。',
    focus_en: 'Test ASC 606 / HKFRS 15 compliance, identify earnings-quality red flags, propose remediation.',
    focus_zh: '检验 ASC 606 / HKFRS 15 合规性，识别盈利质量红旗，提出整改建议。',
  },
  {
    id: 'ipo_pl_diagnostician',
    task_en: 'Diagnose the income statement: gross-margin trend, opex composition, non-recurring items, EBITDA bridge.',
    task_zh: '诊断利润表：毛利率走势、运营费用结构、非经常性项目、EBITDA 桥接。',
    focus_en: 'Surface margin compression, expense classification issues, and items that need normalization.',
    focus_zh: '识别利润率压缩、费用分类问题、以及需要正常化的项目。',
  },
  {
    id: 'ipo_balance_sheet_diagnostician',
    task_en: 'Diagnose the balance sheet: working-capital health, intangible-asset quality, debt structure, off-BS items.',
    task_zh: '诊断资产负债表：营运资本、无形资产质量、债务结构、表外项目。',
    focus_en: 'Spot impairment indicators, leverage covenants, related-party balances, and unusual classifications.',
    focus_zh: '识别减值迹象、杠杆契约、关联方余额、以及异常分类。',
  },
  {
    id: 'ipo_cash_flow_analyst',
    task_en: 'Analyze the cash-flow statement and reconcile to net income; quantify FCF and assess sustainability.',
    task_zh: '分析现金流量表并与净利润调节；量化 FCF 并评估可持续性。',
    focus_en: 'Identify accrual–cash divergences, capex intensity, and working-capital drag.',
    focus_zh: '识别应计与现金的背离、资本开支强度、以及营运资本占用。',
  },
  {
    id: 'ipo_capital_efficiency_analyzer',
    task_en: 'Compute and benchmark capital efficiency (ROIC, ROE, ROA, payback period, Magic Number).',
    task_zh: '计算并对标资本效率（ROIC、ROE、ROA、回本期、Magic Number）。',
    focus_en: 'Show whether the issuer is creating or destroying capital relative to its cost.',
    focus_zh: '揭示发行人相对资本成本是否创造价值。',
  },
  {
    id: 'ipo_working_capital_analyzer',
    task_en: 'Analyze working-capital cycle (DSO, DIO, DPO, CCC) and forecast next-12-month working-capital needs.',
    task_zh: '分析营运资本周期（DSO、DIO、DPO、CCC）并预测未来 12 个月营运资本需求。',
    focus_en: 'For HKEX, this drives the App.1A.36 working-capital-sufficiency statement.',
    focus_zh: '在 HKEX 路径上，这是 App.1A.36 营运资金充裕声明的依据。',
  },
  {
    id: 'ipo_kpi_tracker',
    task_en: 'Track operational KPIs (industry-specific) and reconcile to GAAP financials with a non-GAAP bridge.',
    task_zh: '追踪运营 KPI（行业特定）并以非 GAAP 调节桥接到 GAAP 财务报表。',
    focus_en: 'Required: each non-GAAP measure carries its GAAP reconciliation per Reg G / Item 10(e).',
    focus_zh: '要求：每项非 GAAP 指标都附带 Reg G / Item 10(e) 要求的 GAAP 调节。',
  },
];

function make_financial_presets(): PresetTemplate[] {
  const out: PresetTemplate[] = [];
  for (const a of FINANCIAL_AGENTS) {
    // SEC variants — fan out across all 5 venues
    out.push(...fan_out_sec(m => ({
      agent_id: a.id,
      locale: 'en',
      task_label_en: a.task_en,
      task_label_zh: a.task_zh,
      instruction:
        `For IPO project {{project_id}} (issuer: {{company_name}}, industry: {{industry}}), ` +
        `${a.task_en}\n\nListing venue: ${venue_label(m)} (${m}).\n\nFocus: ${a.focus_en}`,
      jurisdiction_clauses: [
        ...SEC_GLOBAL_CLAUSES_EN,
        'US GAAP framework; ASC 606 (revenue), ASC 842 (leases), ASC 740 (taxes), ASC 718 (SBC).',
        'Reg G + Reg S-K Item 10(e) — non-GAAP financial measures must reconcile to GAAP.',
      ],
      output_format: STD_OUTPUT_FORMAT_EN,
      variables: PROJECT_VARS,
      suggested_max_tokens: 3500,
    })));
    out.push(...fan_out_sec(m => ({
      agent_id: a.id,
      locale: 'zh',
      task_label_en: a.task_en,
      task_label_zh: a.task_zh,
      instruction:
        `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，行业：{{industry}}）` +
        `${a.task_zh}\n\n上市地：${venue_label_zh(m)}（${m}）。\n\n重点：${a.focus_zh}`,
      jurisdiction_clauses: [
        ...SEC_GLOBAL_CLAUSES_ZH,
        'US GAAP 框架；ASC 606（收入）、ASC 842（租赁）、ASC 740（所得税）、ASC 718（股份支付）。',
        'Reg G + Reg S-K Item 10(e) —— 非 GAAP 指标须与 GAAP 调节。',
      ],
      output_format: STD_OUTPUT_FORMAT_ZH,
      variables: PROJECT_VARS,
      suggested_max_tokens: 3500,
    })));
    // HKEX Main + GEM
    for (const m of ['HKEX_MAIN', 'HKEX_GEM'] as TargetMarket[]) {
      const clauses_en = m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_EN : HKEX_MAIN_GLOBAL_CLAUSES_EN;
      const clauses_zh = m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_ZH : HKEX_MAIN_GLOBAL_CLAUSES_ZH;
      out.push({
        agent_id: a.id,
        target_market: m,
        locale: 'en',
        task_label_en: a.task_en,
        task_label_zh: a.task_zh,
        instruction:
          `For IPO project {{project_id}} (issuer: {{company_name}}, industry: {{industry}}), ` +
          `${a.task_en}\n\nListing venue: ${venue_label(m)} (${m}).\n\nFocus: ${a.focus_en}`,
        jurisdiction_clauses: [
          ...clauses_en,
          'HKFRS 15 (revenue), HKFRS 16 (leases), HKFRS 9 (financial instruments), HKAS 12 (taxes).',
          'App.1A.32-33 (Financial Information / MD&A equivalent) sets the disclosure spine.',
          a.id === 'ipo_working_capital_analyzer' ? 'App.1A.36 — directors must confirm 12-month working-capital sufficiency.' : '',
        ].filter(Boolean),
        output_format: STD_OUTPUT_FORMAT_EN,
        variables: PROJECT_VARS,
        suggested_max_tokens: 3500,
      });
      out.push({
        agent_id: a.id,
        target_market: m,
        locale: 'zh',
        task_label_en: a.task_en,
        task_label_zh: a.task_zh,
        instruction:
          `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，行业：{{industry}}）` +
          `${a.task_zh}\n\n上市地：${venue_label_zh(m)}（${m}）。\n\n重点：${a.focus_zh}`,
        jurisdiction_clauses: [
          ...clauses_zh,
          'HKFRS 15（收入）、HKFRS 16（租赁）、HKFRS 9（金融工具）、HKAS 12（所得税）。',
          'App.1A.32-33（财务资料 / MD&A 等同章节）—— 披露主轴。',
          a.id === 'ipo_working_capital_analyzer' ? 'App.1A.36 —— 董事须确认未来 12 个月营运资金充裕。' : '',
        ].filter(Boolean),
        output_format: STD_OUTPUT_FORMAT_ZH,
        variables: PROJECT_VARS,
        suggested_max_tokens: 3500,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// BATCH 1B — Prospectus Section Drafters
// SEC side (7 sections, all bound to PFS via prospectus_section)
// HKEX side (7 sections, all bound to PFS via prospectus_section)
// ---------------------------------------------------------------------------

interface ProspectusPresetSpec {
  agent_id: string;
  prospectus_section: string;
  task_en: string;
  task_zh: string;
  ref_label: string;
}

const SEC_PROSPECTUS_SPECS: ProspectusPresetSpec[] = [
  { agent_id: 'sec_s1_drafter',                  prospectus_section: 'cover',             task_en: 'Draft the prospectus cover page',                       task_zh: '起草招股说明书封面',                ref_label: 'Reg S-K Item 501' },
  { agent_id: 'sec_s1_drafter',                  prospectus_section: 'summary',           task_en: 'Draft the Prospectus Summary',                          task_zh: '起草招股说明书摘要',                ref_label: 'Reg S-K Item 503' },
  { agent_id: 'ipo_risk_factors_drafter',        prospectus_section: 'risk_factors',      task_en: 'Draft the Risk Factors section',                        task_zh: '起草风险因素章节',                  ref_label: 'Reg S-K Item 105 / 503(c)' },
  { agent_id: 'ipo_use_of_proceeds_drafter',     prospectus_section: 'use_of_proceeds',   task_en: 'Draft the Use of Proceeds section',                     task_zh: '起草募集资金用途章节',              ref_label: 'Reg S-K Item 504' },
  { agent_id: 'ipo_mdna_drafter',                prospectus_section: 'mdna',              task_en: 'Draft Management Discussion & Analysis (MD&A)',         task_zh: '起草管理层讨论与分析 (MD&A)',       ref_label: 'Reg S-K Item 303' },
  { agent_id: 'ipo_business_section_drafter',    prospectus_section: 'business',          task_en: 'Draft the Business section',                            task_zh: '起草业务章节',                      ref_label: 'Reg S-K Item 101' },
  { agent_id: 'ipo_related_party_tx_reviewer',   prospectus_section: 'related_party',     task_en: 'Draft the Related Party Transactions disclosure',       task_zh: '起草关联方交易披露',                ref_label: 'Reg S-K Item 404' },
];

const HKEX_PROSPECTUS_SPECS: ProspectusPresetSpec[] = [
  { agent_id: 'hkex_a1_drafter',                 prospectus_section: 'summary',           task_en: 'Draft the Summary and Highlights',                      task_zh: '起草概要及亮点章节',                ref_label: 'App.1A.6 / GL86-16' },
  { agent_id: 'ipo_risk_factors_drafter',        prospectus_section: 'risk_factors',      task_en: 'Draft the Risk Factors section',                        task_zh: '起草风险因素章节',                  ref_label: 'App.1A.40 / GL16-19' },
  { agent_id: 'ipo_business_section_drafter',    prospectus_section: 'business',          task_en: 'Draft the Business section',                            task_zh: '起草业务章节',                      ref_label: 'App.1A.28' },
  { agent_id: 'ipo_competitive_positioner',      prospectus_section: 'industry',          task_en: 'Draft the Industry Overview section',                   task_zh: '起草行业概览章节',                  ref_label: 'App.1A.31 / GL103-19' },
  { agent_id: 'hkex_connected_tx_analyzer',      prospectus_section: 'connected',         task_en: 'Draft the Connected Transactions section',              task_zh: '起草关连交易章节',                  ref_label: 'Ch.14A' },
  { agent_id: 'ipo_use_of_proceeds_drafter',     prospectus_section: 'use_of_proceeds',   task_en: 'Draft Future Plans and Use of Proceeds',                task_zh: '起草未来计划及所得款项用途',        ref_label: 'App.1A.48' },
  { agent_id: 'hkex_esg_disclosure_drafter',     prospectus_section: 'esg',               task_en: 'Draft the ESG Disclosure section',                      task_zh: '起草环境社会及管治 (ESG) 章节',     ref_label: 'App.27 / Ch.13.91' },
];

const PROSPECTUS_TOKEN_BUDGET_BLOCK_EN =
  '\n\n⚠️ Token budget allocation (hard requirement):\n' +
  '1. Your total output budget is ~12000 tokens.\n' +
  '2. You MUST reserve at least 600 tokens at the very end for the ```json compliance envelope. The envelope is non-optional.\n' +
  '3. Compress per-element prose if needed, but NEVER drop a required subheading or required element.\n' +
  '4. Output order: Markdown body → blank line → ```json envelope → closing ```.';

const PROSPECTUS_TOKEN_BUDGET_BLOCK_ZH =
  '\n\n⚠️ Token 预算分配（硬性要求）：\n' +
  '1. 总输出预算约 12000 token。\n' +
  '2. 必须为末尾的 ```json 合规信封预留至少 600 token，信封不可省略。\n' +
  '3. 正文紧张时可压缩每条要素的叙述长度，但禁止删减必备子节标题或必备要素。\n' +
  '4. 输出顺序：Markdown 正文 → 空行 → ```json 信封 → ``` 结束。';

function make_sec_prospectus_presets(): PresetTemplate[] {
  const out: PresetTemplate[] = [];
  for (const s of SEC_PROSPECTUS_SPECS) {
    for (const m of SEC_VENUES) {
      out.push({
        agent_id: s.agent_id,
        target_market: m,
        locale: 'en',
        task_label_en: s.task_en,
        task_label_zh: s.task_zh,
        instruction:
          `${s.task_en} of the prospectus for IPO project {{project_id}} ` +
          `(issuer: {{company_name}}).\n\nListing venue: ${venue_label(m)} (${m}).\n` +
          `Regulatory anchor: ${s.ref_label}.\n\n` +
          `You MUST strictly conform to the "Format Standard (binding)" block above (PFS injection): ` +
          `produce every required subheading in order, cover every required element, include the ` +
          `mandatory disclosure language verbatim or paraphrased, hit the word-count band, and ` +
          `cite the listed authorities. Where company data is missing, mark it "[example]" — never fabricate.` +
          PROSPECTUS_TOKEN_BUDGET_BLOCK_EN,
        jurisdiction_clauses: [
          ...SEC_GLOBAL_CLAUSES_EN,
          `Section anchor: ${s.ref_label}.`,
        ],
        output_format: PROSPECTUS_OUTPUT_FORMAT_EN,
        variables: PROJECT_VARS,
        prospectus_section: s.prospectus_section,
        suggested_max_tokens: 12000,
      });
      out.push({
        agent_id: s.agent_id,
        target_market: m,
        locale: 'zh',
        task_label_en: s.task_en,
        task_label_zh: s.task_zh,
        instruction:
          `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}）${s.task_zh}。\n\n` +
          `上市地：${venue_label_zh(m)}（${m}）。\n监管引用：${s.ref_label}。\n\n` +
          `你必须严格遵守上方「格式标准（强制约束）」中列出的所有要求：必备子节标题、必备要素、` +
          `强制披露语句、字数要求与引用要求。如缺数据请用「[示例]」标注，禁止虚构关键披露事实。` +
          PROSPECTUS_TOKEN_BUDGET_BLOCK_ZH,
        jurisdiction_clauses: [
          ...SEC_GLOBAL_CLAUSES_ZH,
          `章节锚点：${s.ref_label}。`,
        ],
        output_format: PROSPECTUS_OUTPUT_FORMAT_ZH,
        variables: PROJECT_VARS,
        prospectus_section: s.prospectus_section,
        suggested_max_tokens: 12000,
      });
    }
  }
  return out;
}

function make_hkex_prospectus_presets(): PresetTemplate[] {
  const out: PresetTemplate[] = [];
  for (const s of HKEX_PROSPECTUS_SPECS) {
    for (const m of ['HKEX_MAIN', 'HKEX_GEM'] as TargetMarket[]) {
      const clauses_en = m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_EN : HKEX_MAIN_GLOBAL_CLAUSES_EN;
      const clauses_zh = m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_ZH : HKEX_MAIN_GLOBAL_CLAUSES_ZH;
      out.push({
        agent_id: s.agent_id,
        target_market: m,
        locale: 'en',
        task_label_en: s.task_en,
        task_label_zh: s.task_zh,
        instruction:
          `${s.task_en} of the listing document for IPO project {{project_id}} ` +
          `(issuer: {{company_name}}).\n\nListing venue: ${venue_label(m)} (${m}).\n` +
          `Regulatory anchor: ${s.ref_label}.\n\n` +
          `You MUST strictly conform to the "Format Standard (binding)" block above (PFS injection): ` +
          `produce every required subheading in order, cover every required element, include the ` +
          `mandatory disclosure language, hit the word-count band, and cite the listed authorities. ` +
          `Cite the independent industry consultant report for every market-data claim. Where company ` +
          `data is missing, mark it "[example]" and never fabricate.` +
          PROSPECTUS_TOKEN_BUDGET_BLOCK_EN,
        jurisdiction_clauses: [
          ...clauses_en,
          `Section anchor: ${s.ref_label}.`,
        ],
        output_format: PROSPECTUS_OUTPUT_FORMAT_EN,
        variables: PROJECT_VARS,
        prospectus_section: s.prospectus_section,
        suggested_max_tokens: 12000,
      });
      out.push({
        agent_id: s.agent_id,
        target_market: m,
        locale: 'zh',
        task_label_en: s.task_en,
        task_label_zh: s.task_zh,
        instruction:
          `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}）${s.task_zh}。\n\n` +
          `上市地：${venue_label_zh(m)}（${m}）。\n监管引用：${s.ref_label}。\n\n` +
          `你必须严格遵守上方「格式标准（强制约束）」中列出的所有要求。所有市场 / 行业数据必须引用 ` +
          `独立行业顾问报告。如缺数据请用「[示例]」标注，禁止虚构关键披露事实。` +
          PROSPECTUS_TOKEN_BUDGET_BLOCK_ZH,
        jurisdiction_clauses: [
          ...clauses_zh,
          `章节锚点：${s.ref_label}。`,
        ],
        output_format: PROSPECTUS_OUTPUT_FORMAT_ZH,
        variables: PROJECT_VARS,
        prospectus_section: s.prospectus_section,
        suggested_max_tokens: 12000,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// BATCH 1C — Regulator Q&A (3 agents)
// ---------------------------------------------------------------------------

const REGULATOR_QA_PRESETS: PresetTemplate[] = [
  // sec_comment_responder — across all 5 SEC venues
  ...fan_out_sec(m => ({
    agent_id: 'sec_comment_responder',
    locale: 'en',
    task_label_en: 'Draft a response to an SEC staff comment letter',
    task_label_zh: '起草对 SEC 工作人员意见函的回复',
    instruction:
      `Draft a response to the following SEC staff comment for IPO project {{project_id}} ` +
      `(issuer: {{company_name}}, venue: ${venue_label(m)}):\n\n{{comment_text}}\n\n` +
      `For each numbered comment: restate the comment, give the issuer's response, identify ` +
      `the corresponding amendment to the registration statement, and cite the controlling ` +
      `Reg S-K / S-X / Staff Bulletin authority. End every response with a sentence confirming ` +
      `the proposed amendment.`,
    jurisdiction_clauses: [
      ...SEC_GLOBAL_CLAUSES_EN,
      'SEC Division of Corporation Finance Financial Reporting Manual (FRM).',
      'Staff Legal Bulletins and CDIs (Compliance & Disclosure Interpretations).',
    ],
    output_format: STD_OUTPUT_FORMAT_EN,
    variables: [
      ...PROJECT_VARS,
      { name: 'comment_text', label_en: 'SEC comment letter text (verbatim)', label_zh: 'SEC 意见函原文', required: true, default_placeholder: '[paste comment letter]' },
    ],
    suggested_max_tokens: 6000,
  })),
  ...fan_out_sec(m => ({
    agent_id: 'sec_comment_responder',
    locale: 'zh',
    task_label_en: 'Draft a response to an SEC staff comment letter',
    task_label_zh: '起草对 SEC 工作人员意见函的回复',
    instruction:
      `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，上市地：${venue_label_zh(m)}）` +
      `就以下 SEC 工作人员意见起草回复：\n\n{{comment_text}}\n\n` +
      `对每条编号意见：先复述意见，再给出发行人回复，指明对登记声明的相应修改条款，并引用相关 ` +
      `Reg S-K / S-X / SLB 条款。每条回复以一句话确认拟议修改作结。`,
    jurisdiction_clauses: [
      ...SEC_GLOBAL_CLAUSES_ZH,
      'SEC 公司财务部财务报告手册（FRM）。',
      'SEC 工作人员法律公告（SLB）及 CDIs。',
    ],
    output_format: STD_OUTPUT_FORMAT_ZH,
    variables: [
      ...PROJECT_VARS,
      { name: 'comment_text', label_en: 'SEC comment letter text (verbatim)', label_zh: 'SEC 意见函原文', required: true, default_placeholder: '[在此粘贴意见函]' },
    ],
    suggested_max_tokens: 6000,
  })),
  // hkex_sponsor_qa_handler — HKEX_MAIN / HKEX_GEM
  ...(['HKEX_MAIN', 'HKEX_GEM'] as TargetMarket[]).flatMap(m => ([
    {
      agent_id: 'hkex_sponsor_qa_handler',
      target_market: m,
      locale: 'en' as const,
      task_label_en: 'Draft a sponsor response to an HKEX hearing question',
      task_label_zh: '起草保荐人对联交所聆讯问题的答复',
      instruction:
        `Draft the sponsor's response to the following HKEX listing-committee / vetting question ` +
        `for IPO project {{project_id}} (issuer: {{company_name}}, venue: ${venue_label(m)}):\n\n` +
        `{{question_text}}\n\nThe response must (a) restate the question, (b) state the position, ` +
        `(c) cite the applicable Listing Rule / Guidance Letter, (d) identify what additional ` +
        `disclosure (if any) will be added to the listing document, and (e) attach a signed-off ` +
        `confirmation suitable for inclusion in the sponsor's response bundle.`,
      jurisdiction_clauses: m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_EN : HKEX_MAIN_GLOBAL_CLAUSES_EN,
      output_format: STD_OUTPUT_FORMAT_EN,
      variables: [
        ...PROJECT_VARS,
        { name: 'question_text', label_en: 'HKEX hearing question text', label_zh: '联交所聆讯问题原文', required: true, default_placeholder: '[paste question]' },
      ],
      suggested_max_tokens: 6000,
    },
    {
      agent_id: 'hkex_sponsor_qa_handler',
      target_market: m,
      locale: 'zh' as const,
      task_label_en: 'Draft a sponsor response to an HKEX hearing question',
      task_label_zh: '起草保荐人对联交所聆讯问题的答复',
      instruction:
        `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，上市地：${venue_label_zh(m)}）` +
        `就以下联交所上市委员会 / 审阅意见起草保荐人答复：\n\n{{question_text}}\n\n` +
        `答复须 (a) 复述问题，(b) 表态，(c) 引用适用上市规则 / 指引信，(d) 说明将加入上市文件的 ` +
        `补充披露（如有），(e) 附上可纳入保荐人答复包的签字确认稿。`,
      jurisdiction_clauses: m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_ZH : HKEX_MAIN_GLOBAL_CLAUSES_ZH,
      output_format: STD_OUTPUT_FORMAT_ZH,
      variables: [
        ...PROJECT_VARS,
        { name: 'question_text', label_en: 'HKEX hearing question text', label_zh: '联交所聆讯问题原文', required: true, default_placeholder: '[在此粘贴问题]' },
      ],
      suggested_max_tokens: 6000,
    },
  ])),
  // ipo_director — internal escalation, ANY market
  {
    agent_id: 'ipo_director',
    target_market: 'ANY',
    locale: 'en',
    task_label_en: 'Internal escalation / mandate decision',
    task_label_zh: '内部上报 / 主指挥决策',
    instruction:
      `As the IPO Director for project {{project_id}} (issuer: {{company_name}}), ` +
      `respond to the following internal escalation:\n\n{{question_text}}\n\n` +
      `Identify (1) which workstream(s) own the issue, (2) the impact on the stage-gate ` +
      `timeline, (3) escalation path to the human partner if applicable, (4) any sign-offs ` +
      `that must be re-opened.`,
    jurisdiction_clauses: [
      'Cross-jurisdictional — defer to the project\'s active Jurisdiction Lead for venue-specific rules.',
      'Maintain master timeline and risk register.',
    ],
    output_format: STD_OUTPUT_FORMAT_EN,
    variables: [
      ...PROJECT_VARS,
      { name: 'question_text', label_en: 'Internal escalation text', label_zh: '内部上报问题', required: true, default_placeholder: '[describe the issue]' },
    ],
    suggested_max_tokens: 4000,
  },
  {
    agent_id: 'ipo_director',
    target_market: 'ANY',
    locale: 'zh',
    task_label_en: 'Internal escalation / mandate decision',
    task_label_zh: '内部上报 / 主指挥决策',
    instruction:
      `作为项目 {{project_id}}（发行人：{{company_name}}）的 IPO 总指挥，请就以下内部上报问题决策：\n\n` +
      `{{question_text}}\n\n请说明：(1) 由哪些工作流负责此问题，(2) 对阶段门时间表的影响，(3) ` +
      `如需上报至执业合伙人的升级路径，(4) 需要重新打开的签批。`,
    jurisdiction_clauses: [
      '跨辖区 —— 涉及具体上市地规则时由该项目的辖区 Lead 决断。',
      '维护主时间线及风险登记册。',
    ],
    output_format: STD_OUTPUT_FORMAT_ZH,
    variables: [
      ...PROJECT_VARS,
      { name: 'question_text', label_en: 'Internal escalation text', label_zh: '内部上报问题', required: true, default_placeholder: '[描述问题]' },
    ],
    suggested_max_tokens: 4000,
  },
];

// ---------------------------------------------------------------------------
// BATCH 1D — Valuation Lab (5 agents) — methodology is jurisdiction-agnostic
// but disclosure rules differ; we register SEC and HKEX variants.
// ---------------------------------------------------------------------------

const VALUATION_AGENTS: Array<{
  id: string;
  task_en: string;
  task_zh: string;
}> = [
  { id: 'ipo_dcf_modeler',                   task_en: 'Build a DCF model and triangulate enterprise value',                       task_zh: '搭建 DCF 模型并三角验证企业价值' },
  { id: 'ipo_comparable_company_valuator',   task_en: 'Run comparable-company (trading multiples) valuation',                     task_zh: '执行可比公司（交易倍数）估值' },
  { id: 'ipo_precedent_transaction_analyzer',task_en: 'Run precedent-transaction (deal multiples) valuation',                     task_zh: '执行先例交易（并购倍数）估值' },
  { id: 'ipo_valuation_lead',                task_en: 'Synthesize all valuation methods into a recommended price range (football-field)', task_zh: '整合所有估值方法形成建议定价区间（足球场图）' },
  { id: 'ipo_wacc_calculator',               task_en: 'Compute the issuer\'s WACC with full assumption tracing',                  task_zh: '计算发行人 WACC，并附完整假设追溯' },
];

function make_valuation_presets(): PresetTemplate[] {
  const out: PresetTemplate[] = [];
  for (const v of VALUATION_AGENTS) {
    out.push(...fan_out_sec(m => ({
      agent_id: v.id,
      locale: 'en',
      task_label_en: v.task_en,
      task_label_zh: v.task_zh,
      instruction:
        `For IPO project {{project_id}} (issuer: {{company_name}}, industry: {{industry}}), ` +
        `${v.task_en}. Listing venue: ${venue_label(m)} (${m}).\n\n` +
        `Use US GAAP-based historical financials. Where comp set spans different exchanges, ` +
        `flag any cross-listing or ADR-conversion adjustments. Document every assumption with ` +
        `source and date. The output must be reviewable by an SEC-licensed valuation team.`,
      jurisdiction_clauses: [
        ...SEC_GLOBAL_CLAUSES_EN,
        'SEC Staff Accounting Bulletin No. 107 / 110 (cheap-stock analysis) for pre-IPO equity grants.',
        'AICPA Practice Aid: Valuation of Privately-Held-Company Equity Securities Issued as Compensation.',
      ],
      output_format: STD_OUTPUT_FORMAT_EN,
      variables: PROJECT_VARS,
      suggested_max_tokens: 5000,
    })));
    out.push(...fan_out_sec(m => ({
      agent_id: v.id,
      locale: 'zh',
      task_label_en: v.task_en,
      task_label_zh: v.task_zh,
      instruction:
        `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，行业：{{industry}}）${v.task_zh}。` +
        `上市地：${venue_label_zh(m)}（${m}）。\n\n基于 US GAAP 历史财务数据。可比集如跨交易所，须 ` +
        `标注跨上市 / ADR 折算调整。每条假设附数据源与日期。产出须符合 SEC 估值团队复核标准。`,
      jurisdiction_clauses: [
        ...SEC_GLOBAL_CLAUSES_ZH,
        'SEC SAB No. 107 / 110（cheap-stock 分析）—— 适用于上市前股权激励授予。',
        'AICPA 操作指引：私人公司股权激励的估值。',
      ],
      output_format: STD_OUTPUT_FORMAT_ZH,
      variables: PROJECT_VARS,
      suggested_max_tokens: 5000,
    })));
    for (const m of ['HKEX_MAIN', 'HKEX_GEM'] as TargetMarket[]) {
      const clauses_en = m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_EN : HKEX_MAIN_GLOBAL_CLAUSES_EN;
      const clauses_zh = m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_ZH : HKEX_MAIN_GLOBAL_CLAUSES_ZH;
      out.push({
        agent_id: v.id,
        target_market: m,
        locale: 'en',
        task_label_en: v.task_en,
        task_label_zh: v.task_zh,
        instruction:
          `For IPO project {{project_id}} (issuer: {{company_name}}, industry: {{industry}}), ` +
          `${v.task_en}. Listing venue: ${venue_label(m)} (${m}).\n\n` +
          `Use HKFRS / IFRS-based historical financials. Triangulate against the indicative ` +
          `pricing range that will appear in the listing document. If a profit forecast is used, ` +
          `it must satisfy Ch.11.16-11.20 (assurance, assumptions, sensitivities).`,
        jurisdiction_clauses: [
          ...clauses_en,
          'Ch.11.16-11.20 — profit forecast assurance, assumptions, and sensitivities.',
          'Ch.10 — placing and price stabilization restrictions.',
        ],
        output_format: STD_OUTPUT_FORMAT_EN,
        variables: PROJECT_VARS,
        suggested_max_tokens: 5000,
      });
      out.push({
        agent_id: v.id,
        target_market: m,
        locale: 'zh',
        task_label_en: v.task_en,
        task_label_zh: v.task_zh,
        instruction:
          `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，行业：{{industry}}）${v.task_zh}。` +
          `上市地：${venue_label_zh(m)}（${m}）。\n\n基于 HKFRS / IFRS 历史财务数据。须与上市文件 ` +
          `指示性定价区间三角验证。如使用盈利预测，须满足 Ch.11.16-11.20（保证、假设、敏感性）。`,
        jurisdiction_clauses: [
          ...clauses_zh,
          'Ch.11.16-11.20 —— 盈利预测的鉴证、假设、敏感性要求。',
          'Ch.10 —— 配售及价格稳定限制。',
        ],
        output_format: STD_OUTPUT_FORMAT_ZH,
        variables: PROJECT_VARS,
        suggested_max_tokens: 5000,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// BATCH 1E — Stock Price Simulator (1 agent)
// ---------------------------------------------------------------------------

const STOCK_SIM_PRESETS: PresetTemplate[] = [
  ...fan_out_sec(m => ({
    agent_id: 'ipo_stock_price_simulator',
    locale: 'en',
    task_label_en: 'Commentary on the post-IPO stock-price simulation',
    task_label_zh: '对 IPO 后股价模拟结果的解读',
    instruction:
      `For IPO project {{project_id}} (issuer: {{company_name}}, venue: ${venue_label(m)}), ` +
      `interpret the GBM Monte-Carlo simulation results below and explain (1) the implied ` +
      `volatility regime, (2) the probability of finishing above the IPO price at +30/+90/+180 ` +
      `days, (3) lock-up expiry risk, (4) macro / sector risks specific to ${venue_label(m)}-listed ` +
      `peers. Calibrate against listed comparables traded on this exchange.\n\n` +
      `Simulation summary:\n{{simulation_summary}}`,
    jurisdiction_clauses: [
      ...SEC_GLOBAL_CLAUSES_EN,
      'Reg M (Rules 100-105) — trading restrictions during distribution.',
      'Rule 144 — restricted-share lock-up and resale rules.',
      'Reg FD — fair-disclosure obligations during the post-listing quiet period.',
    ],
    output_format: STD_OUTPUT_FORMAT_EN,
    variables: [
      ...PROJECT_VARS,
      { name: 'simulation_summary', label_en: 'GBM Monte-Carlo summary (paths, vol, drift, prices at percentiles)', label_zh: 'GBM 蒙特卡洛模拟结果摘要（路径数、波动率、漂移、各分位价格）', required: true, default_placeholder: '[paste simulation output]' },
    ],
    suggested_max_tokens: 4000,
  })),
  ...fan_out_sec(m => ({
    agent_id: 'ipo_stock_price_simulator',
    locale: 'zh',
    task_label_en: 'Commentary on the post-IPO stock-price simulation',
    task_label_zh: '对 IPO 后股价模拟结果的解读',
    instruction:
      `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，上市地：${venue_label_zh(m)}）` +
      `解读以下 GBM 蒙特卡洛模拟结果，说明：(1) 隐含波动率特征，(2) +30/+90/+180 天高于发行 ` +
      `价的概率，(3) 锁定期到期风险，(4) ${venue_label_zh(m)} 同业的宏观 / 板块风险。请以同 ` +
      `板块上市可比公司为基准做校准。\n\n模拟摘要：\n{{simulation_summary}}`,
    jurisdiction_clauses: [
      ...SEC_GLOBAL_CLAUSES_ZH,
      'Reg M（Rules 100-105）—— 发行期间交易限制。',
      'Rule 144 —— 限制性股票锁定与转售规则。',
      'Reg FD —— 上市后静默期公平披露义务。',
    ],
    output_format: STD_OUTPUT_FORMAT_ZH,
    variables: [
      ...PROJECT_VARS,
      { name: 'simulation_summary', label_en: 'GBM Monte-Carlo summary', label_zh: 'GBM 蒙特卡洛模拟摘要', required: true, default_placeholder: '[在此粘贴模拟结果]' },
    ],
    suggested_max_tokens: 4000,
  })),
  ...(['HKEX_MAIN', 'HKEX_GEM'] as TargetMarket[]).flatMap(m => ([
    {
      agent_id: 'ipo_stock_price_simulator',
      target_market: m,
      locale: 'en' as const,
      task_label_en: 'Commentary on the post-IPO stock-price simulation',
      task_label_zh: '对 IPO 后股价模拟结果的解读',
      instruction:
        `For IPO project {{project_id}} (issuer: {{company_name}}, venue: ${venue_label(m)}), ` +
        `interpret the GBM simulation results below and explain (1) the implied volatility regime, ` +
        `(2) probability of finishing above the offer price at the standard observation horizons, ` +
        `(3) cornerstone lock-up risk per Ch.10.07, (4) macro / sector / Hang-Seng-correlation ` +
        `risks specific to HKEX-listed peers, (5) any HKEX-specific stabilization mechanics ` +
        `(over-allotment + stabilizing manager).\n\nSimulation summary:\n{{simulation_summary}}`,
      jurisdiction_clauses: [
        ...(m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_EN : HKEX_MAIN_GLOBAL_CLAUSES_EN),
        'Ch.10 — placing and price-stabilization restrictions.',
        'Securities and Futures (Price Stabilizing) Rules (Cap. 571W).',
      ],
      output_format: STD_OUTPUT_FORMAT_EN,
      variables: [
        ...PROJECT_VARS,
        { name: 'simulation_summary', label_en: 'GBM Monte-Carlo summary', label_zh: 'GBM 蒙特卡洛模拟摘要', required: true, default_placeholder: '[paste simulation output]' },
      ],
      suggested_max_tokens: 4000,
    },
    {
      agent_id: 'ipo_stock_price_simulator',
      target_market: m,
      locale: 'zh' as const,
      task_label_en: 'Commentary on the post-IPO stock-price simulation',
      task_label_zh: '对 IPO 后股价模拟结果的解读',
      instruction:
        `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，上市地：${venue_label_zh(m)}）` +
        `解读以下 GBM 模拟结果：(1) 隐含波动率特征，(2) 标准观测期限高于发行价的概率，(3) ` +
        `按 Ch.10.07 的基石锁定风险，(4) 与恒生指数相关性 / 板块宏观风险，(5) HKEX 特有的价格 ` +
        `稳定机制（绿鞋 + 稳定操作人）。\n\n模拟摘要：\n{{simulation_summary}}`,
      jurisdiction_clauses: [
        ...(m === 'HKEX_GEM' ? HKEX_GEM_GLOBAL_CLAUSES_ZH : HKEX_MAIN_GLOBAL_CLAUSES_ZH),
        'Ch.10 —— 配售及价格稳定限制。',
        '《证券及期货（稳定价格）规则》（第 571W 章）。',
      ],
      output_format: STD_OUTPUT_FORMAT_ZH,
      variables: [
        ...PROJECT_VARS,
        { name: 'simulation_summary', label_en: 'GBM Monte-Carlo summary', label_zh: 'GBM 蒙特卡洛模拟摘要', required: true, default_placeholder: '[在此粘贴模拟结果]' },
      ],
      suggested_max_tokens: 4000,
    },
  ])),
];

// ---------------------------------------------------------------------------
// Master registry — Batch 1 only for now (Batches 2-4 to follow)
// ---------------------------------------------------------------------------

const ALL_PRESETS: PresetTemplate[] = [
  ...make_financial_presets(),
  ...make_sec_prospectus_presets(),
  ...make_hkex_prospectus_presets(),
  ...REGULATOR_QA_PRESETS,
  ...make_valuation_presets(),
  ...STOCK_SIM_PRESETS,
];

// Index: agent_id → target_market → locale → preset
const PRESET_INDEX = new Map<string, Map<TargetMarket | 'ANY', Map<'en' | 'zh', PresetTemplate>>>();

for (const p of ALL_PRESETS) {
  let by_market = PRESET_INDEX.get(p.agent_id);
  if (!by_market) {
    by_market = new Map();
    PRESET_INDEX.set(p.agent_id, by_market);
  }
  let by_locale = by_market.get(p.target_market);
  if (!by_locale) {
    by_locale = new Map();
    by_market.set(p.target_market, by_locale);
  }
  by_locale.set(p.locale, p);
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Look up a preset for (agent_id, target_market, locale).
 * Falls back: (market, locale) → ('ANY', locale) → null.
 */
export function get_preset(
  agent_id: string,
  target_market: TargetMarket,
  locale: 'en' | 'zh',
): PresetTemplate | null {
  const by_market = PRESET_INDEX.get(agent_id);
  if (!by_market) return null;
  const exact = by_market.get(target_market)?.get(locale);
  if (exact) return exact;
  const any_market = by_market.get('ANY')?.get(locale);
  if (any_market) return any_market;
  return null;
}

/** List every preset for an agent (across markets and locales). */
export function list_presets_for_agent(agent_id: string): PresetTemplate[] {
  const by_market = PRESET_INDEX.get(agent_id);
  if (!by_market) return [];
  const out: PresetTemplate[] = [];
  for (const by_locale of by_market.values()) {
    for (const p of by_locale.values()) out.push(p);
  }
  return out;
}

/** True if the agent has any preset registered (exact or 'ANY'). */
export function has_preset(agent_id: string): boolean {
  return PRESET_INDEX.has(agent_id);
}

/** Total count — used by the API health endpoint. */
export function preset_count(): number {
  return ALL_PRESETS.length;
}

/** Distinct agent ids that have at least one preset. */
export function agent_ids_with_presets(): string[] {
  return Array.from(PRESET_INDEX.keys()).sort();
}

// ---------------------------------------------------------------------------
// render_preset() — substitutes {{vars}} and assembles the final prompt
// ---------------------------------------------------------------------------

/**
 * Render the full prompt: instruction → ## Jurisdictional Compliance →
 * ## Output Format. Substitutes {{var_name}} placeholders. Returns
 * `unfilled_variables` so the caller can warn about anything still placeholder.
 */
export function render_preset(
  preset: PresetTemplate,
  vars: Record<string, string | number | undefined> = {},
  locale_override?: 'en' | 'zh',
): RenderedPreset {
  const locale = locale_override ?? preset.locale;
  const unfilled: string[] = [];

  const fill = (s: string): string => s.replace(/\{\{(\w+)\}\}/g, (_m, name) => {
    const v = vars[name];
    if (v === undefined || v === null || String(v).trim() === '') {
      // Use the variable's default placeholder if declared
      const spec = preset.variables.find(x => x.name === name);
      if (spec?.default_placeholder) {
        if (spec.required) unfilled.push(name);
        return spec.default_placeholder;
      }
      unfilled.push(name);
      return `{{${name}}}`;
    }
    return String(v);
  });

  const filled_instruction = fill(preset.instruction);

  const compliance_header = locale === 'zh'
    ? '## 司法管辖与法规遵循（强制）'
    : '## Jurisdictional Compliance (binding)';
  const output_header = locale === 'zh'
    ? '## 输出格式'
    : '## Output Format';

  const compliance_block = preset.jurisdiction_clauses.length === 0
    ? ''
    : `${compliance_header}\n` + preset.jurisdiction_clauses.map(c => `- ${c}`).join('\n');

  const final_prompt = [
    filled_instruction,
    compliance_block,
    `${output_header}\n${preset.output_format}`,
  ].filter(Boolean).join('\n\n');

  const task_label = locale === 'zh' ? preset.task_label_zh : preset.task_label_en;

  return {
    prompt: final_prompt,
    prospectus_section: preset.prospectus_section,
    suggested_max_tokens: preset.suggested_max_tokens,
    task_label,
    unfilled_variables: unfilled,
  };
}
