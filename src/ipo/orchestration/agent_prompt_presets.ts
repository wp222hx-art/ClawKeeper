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
// BATCH 2 — SEC-specific agents (17)
// Six remaining sec_* agents + SEC-leaning agents from disclosure / legal /
// tax / post-IPO categories whose regulatory anchors are dominantly US.
// Each preset is fanned out across all 5 SEC venues × 2 locales.
// ---------------------------------------------------------------------------

interface SecOnlyPresetSpec {
  agent_id: string;
  task_en: string;
  task_zh: string;
  focus_en: string;
  focus_zh: string;
  /** Extra clauses beyond SEC_GLOBAL_CLAUSES_*. */
  extra_clauses_en: string[];
  extra_clauses_zh: string[];
  /** Suggested max_tokens for this work product. */
  suggested_max_tokens?: number;
  /** Optional PFS binding (only set for prospectus-touching agents). */
  prospectus_section?: string;
}

const SEC_ONLY_SPECS: SecOnlyPresetSpec[] = [
  // ---- 6 remaining sec_* agents (sec_s1_drafter / sec_comment_responder already in Batch 1) ----
  {
    agent_id: 'sec_regsk_checker',
    task_en: 'Audit the prospectus draft against every Reg S-K item: identify which items are present, which are short on required content / formatting / look-back-period, and which are missing entirely. Produce an item-by-item compliance matrix.',
    task_zh: '对照 Reg S-K 全部条目核查招股书草稿：识别哪些条目已具备、哪些内容 / 格式 / 回溯期不足、哪些完全缺失。产出逐项合规矩阵。',
    focus_en: 'Each row: Item # → Required content → Status (Pass / Partial / Missing) → Cited evidence (page / section) → Remediation owner.',
    focus_zh: '每行：项目编号 → 必备内容 → 状态（合格 / 部分合规 / 缺失）→ 引用证据（页码 / 章节）→ 整改负责人。',
    extra_clauses_en: [
      'Reg S-K Items 101 (Business), 103 (Legal Proceedings), 105 (Risk Factors), 303 (MD&A), 402 (Executive Compensation), 404 (Related-Party), 503-505 (Front-end disclosures).',
      'Apply the Smaller Reporting Company / EGC scaled-disclosure adjustments where the issuer qualifies.',
    ],
    extra_clauses_zh: [
      'Reg S-K 第 101 项（业务）、第 103 项（法律程序）、第 105 项（风险因素）、第 303 项（MD&A）、第 402 项（高管薪酬）、第 404 项（关联交易）、第 503-505 项（卷首披露）。',
      '若发行人符合 Smaller Reporting Company / EGC 标准，适用相应的简化披露规则。',
    ],
    suggested_max_tokens: 6000,
  },
  {
    agent_id: 'sec_sox_advisor',
    task_en: 'Build the SOX 302 / 404(a) / 404(b) compliance roadmap: control-deficiency inventory, remediation owners, target dates, and the trigger calendar for when 404(b) auditor attestation kicks in (post-EGC transition expiry or accelerated-filer threshold).',
    task_zh: '构建 SOX 302 / 404(a) / 404(b) 合规路线图：控制缺陷清单、整改负责人、目标日期，以及 404(b) 审计师鉴证义务启动的触发日历（EGC 过渡期满或达到加速申报人门槛）。',
    focus_en: 'For pre-IPO and EGC-eligible issuers, sequence remediation so 302 / 404(a) cert is solid by S-1 effectiveness and 404(b) is ready by the trigger date.',
    focus_zh: '对 IPO 前 / EGC 资格发行人，安排整改顺序，使 302 / 404(a) 认证在 S-1 生效时即稳固，404(b) 在触发日前就绪。',
    extra_clauses_en: [
      'SOX §302 (CEO/CFO certification), §404(a) (management ICFR assessment), §404(b) (auditor attestation, deferred for EGC under JOBS Act §103).',
      'JOBS Act §101 EGC five-year transition; loss of EGC upon any of (>$1.235B revenue) / (>$700M public float) / (>$1B 3-yr non-convertible debt) / 5th anniversary.',
      'Accelerated / Large Accelerated Filer thresholds: Reg S-K Rule 12b-2 ($75M / $700M public float).',
    ],
    extra_clauses_zh: [
      'SOX 第 302 条（CEO/CFO 认证）、第 404(a) 条（管理层 ICFR 评估）、第 404(b) 条（审计师鉴证，依 JOBS Act 第 103 条对 EGC 暂缓）。',
      'JOBS Act 第 101 条 EGC 五年过渡期；发行人在以下任一情形下丧失 EGC 身份：年收入 >$1.235B、公众持股市值 >$700M、过去 3 年不可转换债发行 >$1B、上市满 5 周年。',
      '加速申报人 / 大型加速申报人门槛：Reg S-K Rule 12b-2（公众持股市值 $75M / $700M）。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'sec_safe_harbor_checker',
    task_en: 'Review every forward-looking statement (FLS) in the prospectus / earnings releases / roadshow scripts against the PSLRA safe-harbor checklist. For each FLS produce: identification quote, "meaningful cautionary language" verdict, bad-faith / actual-knowledge risk note, and recommended fix.',
    task_zh: '依 PSLRA 安全港清单核查招股书 / 业绩发布 / 路演脚本中的每一项前瞻性陈述（FLS）。对每条 FLS 给出：原文引用、"实质性警示语"判定、恶意 / 主观明知风险注记、建议修订。',
    focus_en: 'Note PSLRA does NOT apply to IPO-stage S-1 statements (15 U.S.C. §78u-5(b)(2)(D)) — flag any safe-harbor reliance attempted in the S-1 itself as ineffective.',
    focus_zh: '注意 PSLRA 安全港不适用于 IPO 阶段的 S-1 文件（15 U.S.C. §78u-5(b)(2)(D)）—— 对在 S-1 中援引安全港的尝试，须标识为无效。',
    extra_clauses_en: [
      'PSLRA safe harbor (15 U.S.C. §78u-5) — written FLS path requires identification + meaningful cautionary statements identifying important factors that could cause actual results to differ.',
      'Bespeaks-caution doctrine — judicial backstop where PSLRA does not apply.',
      'Reg G + Reg S-K Item 10(e) — non-GAAP FLS still require GAAP reconciliation where computable.',
    ],
    extra_clauses_zh: [
      'PSLRA 安全港（15 U.S.C. §78u-5）—— 书面 FLS 路径要求"明确标识"+附带"实质性警示语"，警示语须指出可能导致实际结果重大偏离的关键因素。',
      'Bespeaks-caution（"业经警示"）原则 —— 在 PSLRA 不适用情形下的司法后备。',
      'Reg G + Reg S-K 第 10(e) 项 —— 即使是非 GAAP 形式的 FLS，可计算时仍须 GAAP 调节。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'sec_pcaob_audit_advisor',
    task_en: 'Translate the relevant PCAOB Auditing Standards into a concrete, executable pre-IPO audit-prep task list: workpaper templates, evidence requirements, walkthrough scripts, and the timing each task must complete relative to S-1 filing.',
    task_zh: '将相关 PCAOB 审计准则翻译为可执行的 IPO 前审计准备任务清单：工作底稿模板、证据要求、穿行测试脚本，以及每项任务相对 S-1 申报的完成时点。',
    focus_en: 'Cover the AS family: AS 2201 ICFR audit, AS 1105 audit evidence, AS 1215 audit documentation, AS 2110 risk assessment, AS 2401 fraud, AS 2315 sampling, AS 1301 communications with audit committee.',
    focus_zh: '覆盖 AS 体系：AS 2201（ICFR 审计）、AS 1105（审计证据）、AS 1215（审计文档）、AS 2110（风险评估）、AS 2401（舞弊）、AS 2315（抽样）、AS 1301（与审计委员会沟通）。',
    extra_clauses_en: [
      'PCAOB AS 2201 — ICFR is required to be audited only for non-EGC accelerated / large accelerated filers; pre-IPO management must still design and operate it.',
      'PCAOB AS 1215 — workpapers must support every conclusion and be retained 7 years.',
      'PCAOB QC standards — engagement-quality review by independent partner.',
    ],
    extra_clauses_zh: [
      'PCAOB AS 2201 —— ICFR 审计仅对非 EGC 加速 / 大型加速申报人为强制；IPO 前管理层仍须设计并运行。',
      'PCAOB AS 1215 —— 工作底稿须支持每项结论，并保管 7 年。',
      'PCAOB QC 体系 —— 由独立合伙人执行项目质量复核。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'sec_listing_standards_matcher',
    task_en: 'Match the issuer\'s financials and shareholder profile to the listing standards of the chosen venue. Identify the qualifying path (which test the issuer relies on), measure the headroom on each numerical threshold, and flag any test the issuer fails or barely passes.',
    task_zh: '将发行人的财务数据与股东构成匹配到所选上市地的上市标准。识别满足条件的路径（采用哪一测试组合）、量化每项数值门槛的余量、标识未通过或勉强通过的测试。',
    focus_en: 'Output a pass/fail matrix per applicable test (income, equity, market value, total assets, market cap of unrestricted publicly held shares, round-lot holders, public float, bid price, etc.).',
    focus_zh: '按适用测试逐项输出通过 / 不通过矩阵（净利润、股东权益、市值、总资产、流通股市值、整手持有人数、公众持股比例、最低买入价等）。',
    extra_clauses_en: [
      'Nasdaq Listing Rule 5300 series (Global Select), 5400 series (Global Market), 5500 series (Capital Market).',
      'NYSE Listed Company Manual §102.01 (US companies) / §103.00 (foreign private issuers).',
      'NYSE American Company Guide §101 — alternative listing standards.',
      'Continuing-listing standards must be planned for at IPO date — not just initial listing.',
    ],
    extra_clauses_zh: [
      '纳斯达克上市规则 5300 系列（全球精选）、5400 系列（全球市场）、5500 系列（资本市场）。',
      '纽交所上市公司手册第 102.01 节（美国公司）/ 第 103.00 节（外国私人发行人）。',
      '纽交所美国市场公司指引第 101 节 —— 备选上市标准。',
      '持续上市标准须在 IPO 日即纳入规划 —— 不仅仅是初始上市标准。',
    ],
    suggested_max_tokens: 5000,
  },
  // ---- SEC-leaning disclosure / post-IPO / legal / tax agents ----
  {
    agent_id: 'ipo_amendment_planner',
    task_en: 'Plan which prospectus / S-1 sections need amendment after each comment-letter round. Produce a redline plan with section owners, deadline, and downstream-impact map (e.g. an MD&A change cascading into Risk Factors and Capitalization).',
    task_zh: '在每轮反馈意见函后规划需修订的招股书 / S-1 章节。产出含章节负责人、截止日、下游影响地图（如 MD&A 修订级联影响风险因素与资本化章节）的红线修订计划。',
    focus_en: 'Track each comment to its remediation; ensure that revised disclosure complies with Reg S-K item-by-item; keep a version history aligned to S-1/A filings.',
    focus_zh: '跟踪每条反馈意见到对应整改；确保修订披露逐项符合 Reg S-K；维护与 S-1/A 申报对齐的版本历史。',
    extra_clauses_en: [
      'Securities Act Rule 472 — every amendment must be filed; no informal "track changes" delivery.',
      'Reg S-K Item 512 — undertakings concerning post-effective amendments.',
      'Coordinate with auditor on consents (Securities Act §7) for every amendment carrying updated financials.',
    ],
    extra_clauses_zh: [
      '《证券法》Rule 472 —— 每次修订均须正式申报，不接受非正式的"留痕"递交。',
      'Reg S-K 第 512 项 —— 关于生效后修订的承诺。',
      '凡修订涉及更新财务数据，须与审计师就同意函（《证券法》第 7 条）联动。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_investor_narrative_drafter',
    task_en: 'Draft the equity story / roadshow narrative: 60-second elevator pitch, market opportunity, business model, competitive moat, financial trajectory, leadership story. Anchor every claim to the prospectus so roadshow QA cannot drift into Reg FD selective-disclosure territory.',
    task_zh: '起草股权故事 / 路演叙事：60 秒电梯演讲、市场机会、商业模式、竞争护城河、财务轨迹、领导力故事。每项陈述均锚定到招股书，使路演问答不至于偏离至违反 Reg FD 选择性披露的边界。',
    focus_en: 'No new material non-public information beyond the prospectus; every superlative must be supportable.',
    focus_zh: '禁止披露任何超出招股书的重大非公开信息；任何形容词级表述均须有支撑材料。',
    extra_clauses_en: [
      'Reg FD (17 CFR 243) — no selective disclosure of material non-public information.',
      'Section 5 of Securities Act — gun-jumping / written-offer rules during the registration period.',
      'Section 11 / 12(a)(2) liability extends to written roadshows under Rule 433.',
    ],
    extra_clauses_zh: [
      'Reg FD（17 CFR 243）—— 禁止选择性披露重大非公开信息。',
      '《证券法》第 5 条 —— 注册期内的"抢跑" / 书面要约规则。',
      'Rule 433 项下，第 11 条 / 第 12(a)(2) 条责任延伸至书面路演资料。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_quarterly_filing_assistant',
    task_en: 'Assist post-IPO 10-Q / 10-K / 6-K / 20-F preparation: roll forward financials, draft MD&A delta versus prior period, surface new / refreshed risk factors, assemble §302 / §906 certifications for officer signature, and check XBRL tagging completeness.',
    task_zh: '协助上市后 10-Q / 10-K / 6-K / 20-F 编制：滚动财务数据、起草相对上期的 MD&A 增量、识别新增或更新的风险因素、整理高管签署所需的第 302 条 / 第 906 条认证、检查 XBRL 标签完整性。',
    focus_en: 'Each filing must integrate with the issuer\'s disclosure-controls process and pass the Disclosure Committee review before signing.',
    focus_zh: '每份申报均须与发行人披露控制流程衔接，并在签署前通过披露委员会复核。',
    extra_clauses_en: [
      'Exchange Act §13(a) / §15(d) — periodic-reporting obligations.',
      'Form 10-Q (Reg S-K + Reg S-X Article 10), Form 10-K (Reg S-K full), Form 6-K (FPI furnishing), Form 20-F (FPI annual).',
      'SOX §302 (CEO/CFO disclosure-controls cert) / §906 (criminal cert).',
      'Reg S-T — XBRL / Inline XBRL tagging mandatory; financial-data + cover-page data.',
    ],
    extra_clauses_zh: [
      '《1934 年证券交易法》第 13(a) 条 / 第 15(d) 条 —— 定期报告义务。',
      'Form 10-Q（Reg S-K + Reg S-X 第 10 条）、Form 10-K（Reg S-K 全套）、Form 6-K（FPI 提交）、Form 20-F（FPI 年报）。',
      'SOX 第 302 条（CEO/CFO 披露控制认证）/ 第 906 条（刑事认证）。',
      'Reg S-T —— XBRL / Inline XBRL 标签为强制要求；财务数据 + 封面数据均须标签化。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_roadshow_qa_simulator',
    task_en: 'Generate the top-50 most-likely investor questions and rehearsal answers anchored to the prospectus. For each Q produce: question, anchor citation in S-1 / 20-F, rehearsed answer, and a flag if the answer would constitute Reg FD-prohibited new material non-public information.',
    task_zh: '生成最可能的前 50 个投资者问题及锚定到招股书的预演答复。每条问题输出：问题、S-1 / 20-F 中的引用锚点、预演答复、若答复将构成违反 Reg FD 的新增重大非公开信息则标识警告。',
    focus_en: 'Cover business model, unit economics, competition, regulation, KPI methodology, controlling-shareholder structure, lock-up overhang, near-term catalysts.',
    focus_zh: '覆盖商业模式、单位经济、竞争、监管、KPI 方法论、控股股东结构、锁定期供给压力、近期催化事件。',
    extra_clauses_en: [
      'Reg FD — selective disclosure prohibition.',
      'Rule 134 / Rule 433 — what testing-the-waters and written communications are permitted.',
      'No projections beyond what is in the prospectus may be shared in the roadshow.',
    ],
    extra_clauses_zh: [
      'Reg FD —— 禁止选择性披露。',
      'Rule 134 / Rule 433 —— 关于"试探市场"与书面沟通的允许范围。',
      '路演中不得分享超出招股书范围的预测信息。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_lockup_period_tracker',
    task_en: 'Track the post-IPO lock-up release calendar (180-day standard, staggered tranches, early-release triggers, top-up rights). For each release date quantify: shares becoming free-tradable, % of free-float pre-release, % post-release, and the supply-overhang risk on share price.',
    task_zh: '跟踪上市后锁定期解禁日历（180 天标准、分批解禁、提前解禁触发条件、增持权）。对每个解禁日量化：解禁股数、解禁前自由流通股占比、解禁后占比、对股价的供给压力风险。',
    focus_en: 'Cross-reference with insider-selling Rule 144 manner-of-sale and volume limits.',
    focus_zh: '与内部人卖出 Rule 144 的方式 / 数量限制交叉勾稽。',
    extra_clauses_en: [
      'Rule 144 (17 CFR 230.144) — restricted/control securities resale framework, including Rule 144(e) volume limits and 144(f) manner-of-sale.',
      'Section 16 — short-swing profits + Form 4 reporting on insider transactions.',
      'Underwriter standard 180-day lock-up + customary release / waiver provisions.',
    ],
    extra_clauses_zh: [
      'Rule 144（17 CFR 230.144）—— 受限 / 控制证券转售框架，包括 Rule 144(e) 数量限制与 144(f) 方式限制。',
      '《1934 年证券交易法》第 16 条 —— 短线收益归入 + 内部人交易 Form 4 申报。',
      '承销商标准 180 天锁定期 + 通常的解禁 / 豁免条款。',
    ],
    suggested_max_tokens: 4500,
  },
  {
    agent_id: 'ipo_corporate_governance_advisor',
    task_en: 'Recommend post-IPO governance architecture: board composition (majority-independent under Nasdaq Rule 5605 / NYSE LCM §303A.01), committee charters (Audit / Comp / Nom & Gov), independence tests, dual-class share guardrails, and any controlled-company exemptions to declare.',
    task_zh: '推荐上市后治理架构：董事会构成（依纳斯达克 Rule 5605 / 纽交所 LCM §303A.01 要求多数独立董事）、委员会章程（审计 / 薪酬 / 提名与治理）、独立性测试、双重股权架构的保护性安排、以及拟援引的控股公司豁免事项。',
    focus_en: 'For FPIs that elect home-country governance, list each Nasdaq/NYSE rule the issuer plans to deviate from, with the home-country basis.',
    focus_zh: '对选择适用本国治理规则的 FPI，逐条列示发行人拟偏离的纳斯达克 / 纽交所规则，并附本国法依据。',
    extra_clauses_en: [
      'Nasdaq Rule 5605 (board / committee independence), 5615(a)(3) (controlled-company), 5615(a)(7) (FPI exemption).',
      'NYSE LCM §303A series (corporate governance) — equivalent independence and committee rules.',
      'SEC Rule 10A-3 — Audit Committee independence (no exemption available).',
      'Dual-class structures: Council of Institutional Investors guidance + market expectations on sunset provisions.',
    ],
    extra_clauses_zh: [
      '纳斯达克 Rule 5605（董事 / 委员会独立性）、5615(a)(3)（控股公司）、5615(a)(7)（FPI 豁免）。',
      '纽交所 LCM 第 303A 系列（公司治理）—— 对应的独立性与委员会规则。',
      'SEC Rule 10A-3 —— 审计委员会独立性（无豁免）。',
      '双重股权架构：机构投资者理事会指引 + 市场对日落条款的预期。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_restructuring_advisor',
    task_en: 'Advise on US-listed entity structure: Direct US-domiciled IssuerCo vs Cayman / BVI top-co vs VIE (PRC operating co + offshore top-co with control agreements) vs Red-chip. Surface tax (PFIC, GILTI, Subpart F), regulatory (HFCAA, CSRC Trial Measures), and disclosure consequences.',
    task_zh: '为美股上市主体架构提供建议：美国注册母公司直接上市 vs 开曼 / BVI 母公司 vs VIE（境内运营 + 离岸母公司 + 协议控制）vs 红筹。揭示税务（PFIC、GILTI、Subpart F）、监管（HFCAA、CSRC 备案）、披露后果。',
    focus_en: 'For PRC-tied issuers, integrate the CSRC Overseas Listing Trial Measures (March 2023) filing pathway and HFCAA / Accelerating HFCAA Act delisting risk.',
    focus_zh: '对涉及中国境内业务的发行人，纳入 CSRC《境外发行上市备案管理试行办法》（2023 年 3 月）的备案路径，以及 HFCAA / Accelerating HFCAA Act 退市风险。',
    extra_clauses_en: [
      'IRC §7874 (anti-inversion), §1297 (PFIC), §951A (GILTI), §951 (Subpart F).',
      'Holding Foreign Companies Accountable Act (HFCAA) — PCAOB inspection access; status of Accelerating HFCAA Act amendments.',
      'CSRC Overseas Listing Trial Measures (March 2023) — filing requirement for PRC-tied issuers.',
      'Securities Act §5 — registration of any new IssuerCo; F-4 if a reorganization is part of the offering.',
    ],
    extra_clauses_zh: [
      'IRC 第 7874 条（反倒置）、第 1297 条（PFIC）、第 951A 条（GILTI）、第 951 条（Subpart F）。',
      '《外国公司问责法》（HFCAA）—— PCAOB 检查权；及《加速 HFCAA》修正案的进展。',
      'CSRC《境外发行上市备案管理试行办法》（2023 年 3 月）—— 境内业务发行人的备案要求。',
      '《证券法》第 5 条 —— 任何新母公司的注册要求；若重组为发行的一部分则需 F-4 表。',
    ],
    suggested_max_tokens: 5500,
  },
  {
    agent_id: 'ipo_lockup_clause_analyzer',
    task_en: 'Analyze the issuer\'s existing investor lock-up clauses (employee shares, founder shares, pre-IPO investors, convertible-note holders) and reconcile them with the underwriter\'s 180-day standard lock-up. Surface any inconsistency, early-release trigger, top-up obligation, or release-day overhang.',
    task_zh: '分析发行人既有投资者锁定期条款（员工股、创始人股、IPO 前投资者、可转债持有人），与承销商标准 180 天锁定期勾稽。揭示不一致、提前解禁触发条件、增持义务、解禁日供给压力。',
    focus_en: 'Provide a release-day timeline mapping every shareholder bucket against (lock-up expiry, Rule 144 holding period, S-3 / F-3 resale-shelf availability).',
    focus_zh: '提供解禁日时间线，将每一股东类别映射到（锁定期解禁、Rule 144 持有期、S-3 / F-3 转售货架是否可用）。',
    extra_clauses_en: [
      'Rule 144 holding-period (6m for reporting issuer / 12m otherwise) and Rule 144(e) volume cap.',
      'Underwriter 180-day standard lock-up; FINRA Rule 5131 prohibits "spinning" releases.',
      'Section 16(c) short-swing profit recovery for officers/directors/10% holders.',
    ],
    extra_clauses_zh: [
      'Rule 144 持有期（已报告发行人 6 个月 / 其他 12 个月）与 Rule 144(e) 数量上限。',
      '承销商标准 180 天锁定期；FINRA Rule 5131 禁止"对赌式"解禁安排。',
      '《1934 年证券交易法》第 16(c) 条 —— 对高管 / 董事 / 10% 持股股东的短线收益归入。',
    ],
    suggested_max_tokens: 4500,
  },
  {
    agent_id: 'ipo_cross_border_tax_optimizer',
    task_en: 'Design / optimize a cross-border tax architecture for the listed group. Minimize dividend / interest / royalty withholding via treaty network; mitigate GILTI / Subpart F for US holders; assess PFIC risk; plan for BEPS Pillar 2 (15% global minimum tax) compliance.',
    task_zh: '为上市集团设计 / 优化跨境税务架构。通过税收协定网络最小化股息 / 利息 / 特许权使用费预提税；对美国持有人缓释 GILTI / Subpart F；评估 PFIC 风险；规划 BEPS 第二支柱（15% 全球最低税）合规。',
    focus_en: 'Quantify ETR before/after each restructuring step; present cash-tax bridge.',
    focus_zh: '量化每一重组步骤前后的有效税率；输出现金税负桥接。',
    extra_clauses_en: [
      'IRC §1297-1298 PFIC — passive-asset and passive-income tests for foreign issuers; QEF / mark-to-market elections.',
      'IRC §951A GILTI / §250 FDII / §59A BEAT.',
      'OECD BEPS Pillar 2 GloBE Rules — 15% effective minimum tax on jurisdictional ETR.',
      'Anti-treaty-shopping LOB clauses; PPT under MLI Article 7.',
    ],
    extra_clauses_zh: [
      'IRC 第 1297-1298 条 PFIC —— 对外国发行人的被动资产 / 被动收入测试；QEF / 按市场计价选择。',
      'IRC 第 951A 条 GILTI / 第 250 条 FDII / 第 59A 条 BEAT。',
      'OECD BEPS 第二支柱 GloBE 规则 —— 按司法辖区有效税率征收 15% 最低税。',
      '反协定滥用 LOB 条款；MLI 第 7 条主要目的测试（PPT）。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_transfer_pricing_advisor',
    task_en: 'Advise on transfer pricing methods (CUP / RPM / Cost-Plus / TNMM / PSM) for each material intercompany flow, design local-file / master-file / CbCR documentation, and align with BEPS Action 13 + the issuer\'s pre-IPO comparability set.',
    task_zh: '为每条重大公司间交易流推荐转让定价方法（CUP / 再销售价格法 / 成本加成 / TNMM / 利润分割），设计本地文档 / 主体文档 / CbCR，并对齐 BEPS 行动 13 + 发行人 IPO 前可比对象。',
    focus_en: 'Disclosure: ensure intercompany pricing footnote in S-1 reconciles to the TP study.',
    focus_zh: '披露：确保 S-1 中关联交易定价附注与转让定价研究一致。',
    extra_clauses_en: [
      'IRC §482 (US transfer-pricing rules) and Treas. Reg. §1.482-1 through -9.',
      'OECD Transfer Pricing Guidelines (2022); BEPS Action 13 three-tier documentation (Local / Master / CbCR).',
      'IRS Form 5472 — reportable transactions for foreign-owned US disregarded entities and 25%-foreign-owned US corps.',
    ],
    extra_clauses_zh: [
      'IRC 第 482 条（美国转让定价规则）及财政部条例 §1.482-1 至 -9。',
      'OECD 转让定价指南（2022）；BEPS 行动 13 三层文档（本地 / 主体 / CbCR）。',
      '美国国税局 Form 5472 —— 外国所有 US 不计实体与 25% 外国控股 US 公司的可报告交易。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_treaty_analyzer',
    task_en: 'Analyze applicable double-tax treaties (US-HK absent, US-PRC, US-Singapore, US-Cayman absent, etc.) and compute effective withholding rates for the proposed dividend / interest / royalty / capital-gains paths. Surface treaty-shopping LOB / PPT risks.',
    task_zh: '分析适用的避免双重征税协定（美 - 港缺位、美 - 中、美 - 新、美 - 开曼缺位等），并计算拟定股息 / 利息 / 特许权使用费 / 资本利得路径的有效预提税率。揭示协定滥用 LOB / PPT 风险。',
    focus_en: 'Build a treaty-route table mapping each cash flow to (source country WHT → treaty rate → LOB qualification → ultimate residual tax).',
    focus_zh: '构建协定路径表：将每条现金流映射到（来源地预提税率 → 协定税率 → LOB 资格 → 最终残留税负）。',
    extra_clauses_en: [
      'OECD Model Tax Convention; UN Model where applicable.',
      'MLI (Multilateral Instrument) covered tax agreements and Article 7 PPT.',
      'IRC §894 — limitation on benefits for treaty claims; Form W-8BEN-E for entity claims.',
    ],
    extra_clauses_zh: [
      'OECD 税收协定范本；适用情形下采用 UN 范本。',
      'MLI（多边公约）覆盖的税收协定及第 7 条 PPT。',
      'IRC 第 894 条 —— 协定优惠的限制；实体申报使用 Form W-8BEN-E。',
    ],
    suggested_max_tokens: 5000,
  },
  {
    agent_id: 'ipo_sensitivity_analyzer',
    task_en: 'Build tornado / one-way / two-way sensitivity tables for the valuation across key drivers (revenue growth, terminal margin, WACC, exit multiple, churn). Produce P10 / P50 / P90 envelopes and identify the two highest-impact drivers.',
    task_zh: '围绕关键价值驱动因素（收入增速、终值利润率、WACC、退出倍数、流失率）构建龙卷风图 / 单变量 / 双变量敏感度表。输出 P10 / P50 / P90 通道并识别影响最大的两个驱动因素。',
    focus_en: 'Tie the envelope to the prospectus Use-of-Proceeds and roadshow story so the price-range disclosure is internally consistent.',
    focus_zh: '将估值通道与招股书募集资金用途及路演叙事勾稽，使发行价区间披露在内部一致。',
    extra_clauses_en: [
      'No PSLRA safe harbor at S-1 stage — sensitivities shared with investors must avoid being construed as projections.',
      'Reg G + Item 10(e) — any non-GAAP key driver requires GAAP reconciliation.',
    ],
    extra_clauses_zh: [
      'S-1 阶段无 PSLRA 安全港 —— 与投资者分享的敏感度必须避免被解读为预测。',
      'Reg G + 第 10(e) 项 —— 任何非 GAAP 关键驱动因素须 GAAP 调节。',
    ],
    suggested_max_tokens: 4500,
  },
  {
    agent_id: 'ipo_esg_metric_calculator',
    task_en: 'Calculate the GHG (Scope 1 / 2 / 3), social, and governance metrics required by the SEC climate-related disclosure rule (where in force / pending) and any voluntary frameworks the issuer adopts (TCFD / ISSB / SASB). Produce the underlying calculation workpapers.',
    task_zh: '计算 SEC 气候相关披露规则（生效 / 拟议范围内）以及发行人自愿采纳的框架（TCFD / ISSB / SASB）所要求的温室气体排放（范围 1 / 2 / 3）、社会与治理指标。产出支撑性计算底稿。',
    focus_en: 'Reconcile SEC climate-rule scope (Scope 1+2 mandatory, Scope 3 if material) with state-level rules (e.g., California SB-253 / SB-261) and voluntary EU-CSRD-aligned reporting.',
    focus_zh: '将 SEC 气候规则范围（范围 1+2 强制，范围 3 重大时强制）与州级规则（如加州 SB-253 / SB-261）以及自愿性 EU-CSRD 对齐报告勾稽。',
    extra_clauses_en: [
      'SEC climate-related disclosure rule (status-dependent — note current effectiveness in the output).',
      'GHG Protocol Corporate Standard for Scope 1 / 2 / 3 boundary and methodology.',
      'TCFD / ISSB IFRS S2 / SASB — voluntary alignment frameworks.',
    ],
    extra_clauses_zh: [
      'SEC 气候相关披露规则（状态待定 —— 须在产出中注明当前生效情况）。',
      'GHG Protocol 企业准则 —— 范围 1 / 2 / 3 边界与方法论。',
      'TCFD / ISSB IFRS S2 / SASB —— 自愿对齐框架。',
    ],
    suggested_max_tokens: 5000,
  },
];

function make_sec_only_presets(): PresetTemplate[] {
  const out: PresetTemplate[] = [];
  for (const s of SEC_ONLY_SPECS) {
    // SEC fan-out across 5 venues, en + zh
    out.push(...fan_out_sec(m => ({
      agent_id: s.agent_id,
      locale: 'en',
      task_label_en: s.task_en,
      task_label_zh: s.task_zh,
      instruction:
        `For IPO project {{project_id}} (issuer: {{company_name}}, industry: {{industry}}), ` +
        `${s.task_en}\n\nListing venue: ${venue_label(m)} (${m}).\n\nFocus: ${s.focus_en}`,
      jurisdiction_clauses: [
        ...SEC_GLOBAL_CLAUSES_EN,
        ...s.extra_clauses_en,
      ],
      output_format: STD_OUTPUT_FORMAT_EN,
      variables: PROJECT_VARS,
      prospectus_section: s.prospectus_section,
      suggested_max_tokens: s.suggested_max_tokens ?? 4500,
    })));
    out.push(...fan_out_sec(m => ({
      agent_id: s.agent_id,
      locale: 'zh',
      task_label_en: s.task_en,
      task_label_zh: s.task_zh,
      instruction:
        `请为 IPO 项目 {{project_id}}（发行人：{{company_name}}，行业：{{industry}}）` +
        `${s.task_zh}\n\n上市地：${venue_label_zh(m)}（${m}）。\n\n重点：${s.focus_zh}`,
      jurisdiction_clauses: [
        ...SEC_GLOBAL_CLAUSES_ZH,
        ...s.extra_clauses_zh,
      ],
      output_format: STD_OUTPUT_FORMAT_ZH,
      variables: PROJECT_VARS,
      prospectus_section: s.prospectus_section,
      suggested_max_tokens: s.suggested_max_tokens ?? 4500,
    })));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Master registry
// ---------------------------------------------------------------------------

const ALL_PRESETS: PresetTemplate[] = [
  ...make_financial_presets(),
  ...make_sec_prospectus_presets(),
  ...make_hkex_prospectus_presets(),
  ...REGULATOR_QA_PRESETS,
  ...make_valuation_presets(),
  ...STOCK_SIM_PRESETS,
  ...make_sec_only_presets(),
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
