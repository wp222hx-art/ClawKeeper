// file: src/ipo/orchestration/agent_registry.ts
// description: In-memory registry of all IPOPilot agents — IDs, capabilities,
//              tier (CEO / Lead / Worker), and skill bindings. Used by
//              IPOOrchestrationService to resolve agents by capability and to
//              power the dashboard's agent directory.
// reference: agents/ipo/**/AGENT.md, src/ipo/orchestration/workstream_blueprint.ts
//
// Localization: every agent now carries `display_name_zh` and `description_zh`
// so the dashboard can render the catalog in either English or Simplified
// Chinese. The English `description` field has been rewritten to clearly state
// (a) what the agent actually does, (b) the artifacts it produces, and (c) the
// regulatory anchor (where applicable). The Chinese description mirrors that
// shape.

export type AgentTier = 'CEO' | 'JURISDICTION_LEAD' | 'INDUSTRY_LEAD' | 'FUNCTIONAL_LEAD' | 'WORKER';

export type AgentCategory =
  | 'CEO'
  | 'JURISDICTION_SEC' | 'JURISDICTION_HKEX'
  | 'INDUSTRY_SAAS' | 'INDUSTRY_BIOPHARMA' | 'INDUSTRY_CLEAN_ENERGY'
  | 'FINANCIAL' | 'AUDIT' | 'INTERNAL_CONTROL'
  | 'LEGAL' | 'GLOBAL_LEGAL' | 'TAX' | 'VALUATION'
  | 'DISCLOSURE' | 'POST_IPO' | 'RAG';

export interface IpoAgentDefinition {
  id: string;
  display_name: string;
  display_name_zh: string;
  tier: AgentTier;
  category: AgentCategory;
  description: string;            // Rich English explanation: what it does + outputs + regulatory anchor
  description_zh: string;         // Chinese mirror of `description`
  capabilities: string[];
  skill_files: string[];          // Paths to SKILL.md files
  agent_md_path: string;          // Path to AGENT.md
  required_signoff_for_outputs?: string[];
  citation_required: boolean;     // True for regulation-citing agents
  // Optional: only set on agents whose knowledge base must be discovered/curated
  // through the configured LLM provider. The Global Finance Law agent uses this
  // to announce its content-acquisition contract (jurisdictions + scope boundary).
  knowledge_acquisition?: {
    discovery_method: 'llm_curated' | 'static_curated' | 'rag_only';
    jurisdictions: string[];      // ISO-style codes — see GLOBAL_LEGAL agent
    scope_in: string[];           // Topic whitelist
    scope_out: string[];          // Explicit boundary — what this agent will NOT cover
  };
}

// ---------------------------------------------------------------------------
// CEO
// ---------------------------------------------------------------------------
const CEO_AGENTS: IpoAgentDefinition[] = [
  {
    id: 'ipo_director',
    display_name: 'IPO Director',
    display_name_zh: 'IPO 总指挥',
    tier: 'CEO',
    category: 'CEO',
    description:
      'Top-level conductor of every IPO engagement. Receives the client mandate, decides which jurisdiction / industry / functional leads must activate, instantiates the 9-stage plan and the workstream pyramid, monitors stage-gate transitions, and routes blockers up to the human partner. Owns the master timeline and the overall risk register.',
    description_zh:
      'IPO 项目总指挥。接收客户委托后，决定需要激活的辖区 / 行业 / 职能 Lead，自动实例化 9 阶段计划与工作流金字塔，监控阶段切换，将阻塞项升级给执业合伙人。负责主时间线及整体风险登记册。',
    capabilities: ['mandate_intake', 'project_planning', 'stage_gate_management', 'escalation_routing'],
    skill_files: ['skills/ipo/project-planning/SKILL.md'],
    agent_md_path: 'agents/ipo/ceo/AGENT.md',
    citation_required: false,
  },
];

// ---------------------------------------------------------------------------
// Jurisdiction & Industry Leads + Functional Leads
// ---------------------------------------------------------------------------
const LEAD_AGENTS: IpoAgentDefinition[] = [
  // Jurisdiction
  {
    id: 'ipo_jurisdiction_lead',
    display_name: 'Jurisdiction Compliance Lead',
    display_name_zh: '辖区合规 Lead',
    tier: 'JURISDICTION_LEAD',
    category: 'JURISDICTION_SEC',
    description:
      'Routes work to the SEC team or the HKEX team based on the project\'s target market. Performs the initial numerical eligibility check (revenue / market cap / public float thresholds) and the governance check (board independence, audit committee). Decides which jurisdiction-specific worker agents are activated for each stage.',
    description_zh:
      '根据项目目标市场，将工作分发至 SEC 团队或港交所团队。执行初始量化资格检查（收入 / 市值 / 公众持股量门槛）以及治理检查（董事会独立性、审计委员会）。决定每个阶段激活哪些辖区专属 Worker Agent。',
    capabilities: ['jurisdiction_routing', 'numerical_threshold_check', 'governance_check'],
    skill_files: ['skills/ipo/jurisdiction-routing/SKILL.md'],
    agent_md_path: 'agents/ipo/jurisdiction-leads/AGENT.md',
    citation_required: true,
  },

  // Industry
  {
    id: 'ipo_industry_analysis_lead',
    display_name: 'Industry Analysis Lead',
    display_name_zh: '行业分析 Lead',
    tier: 'INDUSTRY_LEAD',
    category: 'INDUSTRY_SAAS',
    description:
      'Coordinates industry-specific analysis with sector specialist workers. Picks the right benchmark dataset (SaaS / BioPharma / Clean Energy / Other), fans out work to sector workers, and consolidates the findings into a single industry positioning memo for the prospectus and valuation teams.',
    description_zh:
      '与各行业专家 Worker 协同推进行业分析。选取合适的对标数据集（SaaS / 生物医药 / 清洁能源 / 其它），将任务分发给行业 Worker，最后汇总成统一的行业定位备忘录，供招股书与估值团队使用。',
    capabilities: ['industry_routing', 'benchmark_orchestration'],
    skill_files: ['skills/ipo/industry-routing/SKILL.md'],
    agent_md_path: 'agents/ipo/industry-leads/AGENT.md',
    citation_required: false,
  },

  // Functional Leads
  {
    id: 'ipo_financial_diagnosis_lead',
    display_name: 'Financial Diagnosis Lead',
    display_name_zh: '财务诊断 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'FINANCIAL',
    description:
      'Owns the Financial Readiness Diagnosis workstream. Plans and aggregates the seven core analyses (Revenue Quality, P&L, Balance Sheet, Cash Flow, Capital Efficiency, Working Capital, KPI vs benchmarks), reconciles their findings into a single diagnostic memo, and pushes high-severity issues into the CFO sign-off queue.',
    description_zh:
      '负责 IPO 前财务就绪度诊断工作流。规划并汇总 7 项核心分析（收入质量、损益、资产负债、现金流、资本效率、营运资本、KPI 对标），形成统一的诊断备忘录，并将高严重度问题推送至 CFO 签批队列。',
    capabilities: ['financial_diagnosis', 'finding_aggregation'],
    skill_files: ['skills/ipo/financial-diagnosis/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: false,
    required_signoff_for_outputs: ['CFO'],
  },

  {
    id: 'ipo_audit_lead',
    display_name: 'Audit Preparation Lead',
    display_name_zh: '审计准备 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'AUDIT',
    description:
      'Owns audit-readiness end-to-end. Calculates materiality (overall + performance + tolerable error), plans samples per AS 2315 / ISA 530, prepares PCAOB-compliant workpaper templates and ties them to the 3-year track record. Outputs require both auditor and CFO sign-off before they can be marked final.',
    description_zh:
      '端到端负责审计就绪。基于 AS 2315 / ISA 530 计算重要性水平（总体 + 执行 + 可容忍错报）、规划抽样方案、准备符合 PCAOB 要求的工作底稿模板，并与近三年业绩记录勾稽。所有产出必须经审计师与 CFO 签批后方可定稿。',
    capabilities: ['audit_planning', 'materiality_calculation', 'workpaper_review'],
    skill_files: ['skills/ipo/audit-preparation/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: true,
    required_signoff_for_outputs: ['AUDITOR', 'CFO'],
  },

  {
    id: 'ipo_internal_control_lead',
    display_name: 'Internal Control Lead',
    display_name_zh: '内控 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'INTERNAL_CONTROL',
    description:
      'Owns the ICFR (Internal Control over Financial Reporting) program: entity-level + process-level control design, walkthrough planning, deficiency tracking, and remediation routing. Aligns the design to COSO 2013 and SOX 404(b) requirements where the issuer is non-EGC.',
    description_zh:
      '负责内控（ICFR）整体方案：实体级 + 流程级控制设计、穿行测试规划、缺陷跟踪与整改路由。依据 COSO 2013 框架，并对非新兴成长型公司（非 EGC）兼容 SOX 404(b) 要求。',
    capabilities: ['icfr_design', 'walkthrough_planning', 'deficiency_tracking'],
    skill_files: ['skills/ipo/icfr-design/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: true,
    required_signoff_for_outputs: ['AUDITOR', 'COMPLIANCE'],
  },

  {
    id: 'ipo_legal_lead',
    display_name: 'Legal Structuring Lead',
    display_name_zh: '法务架构 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'LEGAL',
    description:
      'Owns the listing-vehicle architecture (Cayman / BVI / Delaware top-co), VIE / red-chip / direct restructuring decisions, related-party transaction cleanup, charter / by-laws reform, and lock-up clause design. Engages the Cross-Border Tax Optimizer in parallel and routes everything through licensed-lawyer sign-off.',
    description_zh:
      '负责上市主体架构（开曼 / BVI / 特拉华母公司）、VIE / 红筹 / 直接上市的重组决策、关联交易清理、章程改造以及锁定期条款设计。与跨境税务 Optimizer 并行协作，所有产出均须经持牌律师签批。',
    capabilities: ['legal_structuring', 'related_party_review', 'governance_design'],
    skill_files: ['skills/ipo/legal-structuring/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: true,
    required_signoff_for_outputs: ['LAWYER'],
  },

  {
    id: 'ipo_tax_lead',
    display_name: 'Tax Optimization Lead',
    display_name_zh: '税务优化 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'TAX',
    description:
      'Owns cross-border tax architecture: holding-company jurisdiction selection, treaty network mapping, withholding optimization, transfer-pricing methods (CUP / TNMM / PSM) with BEPS-aligned documentation, and pre-IPO tax-clearance memos.',
    description_zh:
      '负责跨境税务架构：控股公司辖区选择、税收协定网络映射、预提税优化、符合 BEPS 文档要求的转让定价方法（CUP / TNMM / PSM）、IPO 前税务清算备忘录。',
    capabilities: ['tax_structuring', 'treaty_analysis', 'transfer_pricing'],
    skill_files: ['skills/ipo/tax-optimization/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'CFO'],
  },

  {
    id: 'ipo_disclosure_lead',
    display_name: 'Disclosure & Drafting Lead',
    display_name_zh: '披露与起草 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'DISCLOSURE',
    description:
      'Owns prospectus drafting end-to-end: section-by-section drafting orchestration, regulator comment-letter response routing, and the equity-story / roadshow narrative. Final outputs must clear Lawyer + Auditor + CFO + Sponsor sign-offs before they can be marked FINAL.',
    description_zh:
      '端到端负责招股书起草：逐章节调度、监管反馈意见函的回复路由、股权故事与路演叙事。最终产出必须经律师 + 审计师 + CFO + 保荐人四方签批后方可定稿（FINAL）。',
    capabilities: ['document_drafting', 'comment_response', 'narrative_design'],
    skill_files: ['skills/ipo/prospectus-drafting/SKILL.md', 'skills/ipo/comment-response/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'],
  },

  {
    id: 'ipo_valuation_lead',
    display_name: 'Valuation Lead',
    display_name_zh: '估值 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'VALUATION',
    description:
      'Owns the valuation memo: triangulates DCF, comparable-company multiples, and precedent-transaction analyses; runs scenario / sensitivity / Monte-Carlo stress tests; reconciles the football-field range that anchors the offer-pricing memo. Requires CFO + Sponsor sign-off.',
    description_zh:
      '负责估值备忘录：三角化 DCF、可比公司倍数与先例交易分析；执行情景 / 敏感度 / 蒙特卡洛压力测试；勾稽形成定价备忘录所依赖的「足球场」估值区间。需经 CFO + 保荐人签批。',
    capabilities: ['dcf_modeling', 'comp_analysis', 'sensitivity_analysis'],
    skill_files: ['skills/ipo/valuation-modeling/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: false,
    required_signoff_for_outputs: ['CFO', 'SPONSOR'],
  },

  {
    id: 'ipo_post_ipo_lead',
    display_name: 'Post-IPO Lead',
    display_name_zh: '上市后 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'POST_IPO',
    description:
      'Owns the post-IPO compliance machine: quarterly / interim filings (10-Q / 6-K / interim reports), lock-up release schedule + supply-overhang analysis, earnings-driven price-path simulation, and investor-communication cadence design.',
    description_zh:
      '负责上市后合规机器：季报 / 中期报告（10-Q / 6-K / 中期报告）、锁定期解禁日程及供给压力分析、业绩驱动的股价路径模拟、投资者沟通节奏设计。',
    capabilities: ['quarterly_reporting', 'lockup_tracking', 'price_simulation'],
    skill_files: ['skills/ipo/post-ipo-reporting/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: false,
    required_signoff_for_outputs: ['CFO', 'AUDITOR'],
  },

  // -------------------------------------------------------------------------
  // NEW: Global Finance Law Lead — added per requirement.
  // Acts as a multi-jurisdictional securities-law brain whose knowledge base
  // is curated by the configured LLM provider (LLM-driven discovery + citation
  // -backed classification, then chunked + embedded into ipo_regulations).
  // -------------------------------------------------------------------------
  {
    id: 'ipo_global_finance_law_agent',
    display_name: 'Global Finance Law Lead',
    display_name_zh: '全球金融法律 Lead',
    tier: 'FUNCTIONAL_LEAD',
    category: 'GLOBAL_LEGAL',
    description:
      'Specialist lead covering multi-jurisdictional securities and listing law. Maintains a curated knowledge base of statutes, regulator rulebooks, market-practice guidance, and landmark enforcement / hearing decisions across 8+ major listing venues. Strictly scoped to LISTING-RELEVANT law: securities offering & listing rules, ongoing disclosure, market-abuse / insider-dealing, sponsor / underwriter conduct, foreign-investment screening as it bears on listing eligibility, and tax-disclosure carveouts in prospectuses. Explicitly OUT OF SCOPE: contract drafting, employment law, IP litigation, day-to-day corporate housekeeping, anything not anchored in a securities-law statute or listing-rule citation. The agent\'s knowledge is acquired by calling the configured chat / reasoning model (per ipo_ai_providers.is_default) to (1) discover candidate sources for a topic + jurisdiction set, (2) classify each source as STATUTE / REGULATOR_RULE / GUIDANCE / CASE_LAW / MARKET_PRACTICE, (3) extract the citation triple (jurisdiction, code, source_url), (4) chunk + embed via the configured embedding model, and (5) write into ipo_regulations / ipo_regulation_chunks tagged domain="GLOBAL_FINANCE_LAW". Every output must carry a verifiable citation.',
    description_zh:
      '覆盖多司法辖区证券法 / 上市规则的专家 Lead。维护一个由 LLM 精选的知识库，涵盖 8 个以上主要上市市场的成文法、监管规则手册、市场惯例指引以及具有里程碑意义的执法 / 聆讯决定。严格限定于「与上市相关」的法律：证券发行与上市规则、持续披露义务、市场操纵 / 内幕交易、保荐人 / 承销商行为准则、外资审查（仅就影响上市资格部分）、招股书中的税务披露条款。明确不在范围内：合同起草、劳动法、知识产权诉讼、日常公司事务、任何无法锚定到证券法成文法或上市规则引用的内容。该 Agent 的知识获取流程：调用配置中的对话 / 推理模型（依据 ipo_ai_providers.is_default），(1) 针对「主题 + 辖区集合」检索候选法源；(2) 将每个法源分类为 STATUTE / REGULATOR_RULE / GUIDANCE / CASE_LAW / MARKET_PRACTICE；(3) 提取引用三元组（辖区、编号、来源 URL）；(4) 通过配置的向量化模型分块入向量；(5) 以 domain="GLOBAL_FINANCE_LAW" 写入 ipo_regulations / ipo_regulation_chunks。所有输出必须附可校验的引用。',
    capabilities: [
      'global_securities_law_advisory',
      'multi_jurisdictional_compliance',
      'cross_border_disclosure',
      'enforcement_precedent_lookup',
      'legal_kb_ingestion',
      'legal_kb_classification',
    ],
    skill_files: [
      'skills/ipo/global-finance-law/SKILL.md',
      'skills/ipo/legal-kb-ingestion/SKILL.md',
    ],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md',
    citation_required: true,
    required_signoff_for_outputs: ['LAWYER'],
    knowledge_acquisition: {
      discovery_method: 'llm_curated',
      jurisdictions: [
        'US_SEC',         // Securities Act 1933, Exchange Act 1934, Reg S-K, Reg S-X, Reg FD, Reg M, Reg M-A, JOBS Act
        'US_PCAOB',       // Auditing standards (AS 1215, AS 2201, AS 2401 etc.)
        'HK_HKEX',        // Main Board Listing Rules, GEM Rules, App.27 ESG, Ch.14A connected tx
        'HK_SFC',         // SFO, Code on Takeovers & Mergers, Codes of Conduct
        'EU',             // Prospectus Regulation 2017/1129, MAR 596/2014, Transparency Directive
        'UK_FCA',         // Listing Rules, DTR, Prospectus Rules, MAR (UK on-shored)
        'SG_SGX',         // SGX Mainboard / Catalist Rulebooks, MAS Securities & Futures Act
        'JP_FSA',         // Financial Instruments and Exchange Act, TSE Listing Rules, Cabinet Office Ordinances
        'PRC_CSRC',       // Overseas Securities Offering & Listing Trial Measures (2023), Network Data Security Reg
        'CAYMAN',         // Companies Act, beneficial-ownership reg
        'BVI',            // BVI Business Companies Act
      ],
      scope_in: [
        'securities_offering_rules',
        'listing_eligibility_rules',
        'ongoing_disclosure_obligations',
        'market_abuse_and_insider_dealing',
        'sponsor_and_underwriter_conduct',
        'connected_party_and_related_party_rules',
        'foreign_investment_screening_for_listings',
        'prospectus_tax_disclosure_carveouts',
        'enforcement_precedents_for_listed_issuers',
      ],
      scope_out: [
        'commercial_contract_drafting',
        'employment_and_labor_law',
        'pure_ip_litigation',
        'consumer_protection',
        'anti_trust_competition_filings',
        'general_corporate_housekeeping',
        'criminal_law_unrelated_to_market_abuse',
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Worker Agents — SEC (7)
// ---------------------------------------------------------------------------
const WORKERS_SEC: IpoAgentDefinition[] = [
  {
    id: 'sec_s1_drafter',
    display_name: 'SEC S-1 Drafter',
    display_name_zh: 'SEC S-1 起草员',
    tier: 'WORKER', category: 'JURISDICTION_SEC',
    description:
      'Drafts every section of Form S-1 (domestic) or F-1 (foreign private issuer) — Items 1 through 29 of Reg S-K plus financial statements per Reg S-X — with anchor citations to the Reg S-K / Reg S-X rule text. Produces incrementally improvable drafts that feed the comment-letter loop.',
    description_zh:
      '起草 S-1（境内发行人）或 F-1（外国私人发行人）的全部章节——Reg S-K 第 1 至 29 项 + 依 Reg S-X 编制的财务报表——并锚定到 Reg S-K / Reg S-X 原文引用。产出可迭代修订的草稿，对接反馈意见函循环。',
    capabilities: ['s1_drafting', 'f1_drafting', 'mdna_drafting'],
    skill_files: ['skills/ipo/sec-s1-drafting/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_s1_drafter/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'],
  },

  {
    id: 'sec_regsk_checker',
    display_name: 'SEC Reg S-K Checker',
    display_name_zh: 'SEC Reg S-K 合规检查员',
    tier: 'WORKER', category: 'JURISDICTION_SEC',
    description:
      'Reads the prospectus draft and verifies every Reg S-K item is present with the required content, formatting, and look-back period. Produces an item-by-item compliance matrix highlighting gaps for the drafter to remediate.',
    description_zh:
      '读取招股书草稿，按 Reg S-K 各项要求逐条核查内容、格式与回溯期是否齐全。产出逐项合规矩阵，标注缺失供起草员修订。',
    capabilities: ['regsk_compliance_check'],
    skill_files: ['skills/ipo/regsk-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_regsk_checker/AGENT.md', citation_required: true,
  },

  {
    id: 'sec_comment_responder',
    display_name: 'SEC Comment Letter Responder',
    display_name_zh: 'SEC 反馈意见回复员',
    tier: 'WORKER', category: 'JURISDICTION_SEC',
    description:
      'Drafts cited responses to SEC Division of Corporation Finance comment letters. Each response anchors to the relevant Reg S-K item / SAB / Staff Accounting Bulletin and produces a redline of the prospectus changes implementing the response.',
    description_zh:
      '为 SEC 公司财务部反馈意见函起草带引用的回复。每条回复锚定到对应 Reg S-K 项目 / SAB（员工会计公告），并附上招股书相应修订的红线对照稿。',
    capabilities: ['comment_response_drafting'],
    skill_files: ['skills/ipo/comment-response/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_comment_responder/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR'],
  },

  {
    id: 'sec_sox_advisor',
    display_name: 'SOX 404 Advisor',
    display_name_zh: 'SOX 404 顾问',
    tier: 'WORKER', category: 'JURISDICTION_SEC',
    description:
      'Builds the SOX 302 / 404(a) / 404(b) compliance roadmap. Maps each control deficiency to its remediation owner and target date, and tells the issuer when 404(b) attestation kicks in (post-EGC transition or accelerated-filer threshold).',
    description_zh:
      '构建 SOX 302 / 404(a) / 404(b) 合规路线图。将每项控制缺陷映射到整改负责人与截止日，并明确 404(b) 鉴证义务何时启动（EGC 过渡期满或达加速申报人门槛）。',
    capabilities: ['sox_advisory'],
    skill_files: ['skills/ipo/sox-advisory/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_sox_advisor/AGENT.md', citation_required: true,
  },

  {
    id: 'sec_safe_harbor_checker',
    display_name: 'Safe Harbor Checker',
    display_name_zh: 'PSLRA 安全港检查员',
    tier: 'WORKER', category: 'JURISDICTION_SEC',
    description:
      'Reviews every forward-looking statement in the prospectus / earnings releases against the PSLRA safe-harbor checklist: identification, meaningful cautionary language, and absence of bad-faith / actual-knowledge issues.',
    description_zh:
      '依 PSLRA 安全港清单（明确标识、有效的警示性陈述、无恶意 / 主观明知问题）核查招股书与业绩发布中的每项前瞻性陈述。',
    capabilities: ['safe_harbor_check'],
    skill_files: ['skills/ipo/safe-harbor-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_safe_harbor_checker/AGENT.md', citation_required: true,
  },

  {
    id: 'sec_pcaob_audit_advisor',
    display_name: 'PCAOB Audit Advisor',
    display_name_zh: 'PCAOB 审计顾问',
    tier: 'WORKER', category: 'JURISDICTION_SEC',
    description:
      'Translates PCAOB Auditing Standards (AS 2201 ICFR, AS 1105 evidence, AS 2110 risk assessment, AS 2401 fraud) into a concrete pre-IPO audit-prep task list with workpaper templates and evidence requirements.',
    description_zh:
      '将 PCAOB 审计准则（AS 2201 ICFR、AS 1105 审计证据、AS 2110 风险评估、AS 2401 舞弊）翻译为可执行的 IPO 前审计准备任务清单，附工作底稿模板与证据要求。',
    capabilities: ['pcaob_advisory'],
    skill_files: ['skills/ipo/pcaob-advisory/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_pcaob_audit_advisor/AGENT.md', citation_required: true,
  },

  {
    id: 'sec_listing_standards_matcher',
    display_name: 'SEC Listing Standards Matcher',
    display_name_zh: 'SEC 上市标准匹配员',
    tier: 'WORKER', category: 'JURISDICTION_SEC',
    description:
      'Matches the issuer\'s financials and shareholder profile to Nasdaq Global Select / Global Market / Capital Market standards or NYSE / NYSE American thresholds. Flags which path is feasible and which optional financial / equity / market-value tests the issuer will rely on.',
    description_zh:
      '将发行人的财务数据与股东构成匹配到纳斯达克全球精选 / 全球市场 / 资本市场标准或纽交所 / 纽交所 American 门槛。标识可行路径，并指出发行人将选择哪一组备选财务 / 权益 / 市值测试。',
    capabilities: ['listing_standards_match'],
    skill_files: ['skills/ipo/listing-standards-match/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_listing_standards_matcher/AGENT.md', citation_required: true,
  },
];

// ---------------------------------------------------------------------------
// Worker Agents — HKEX (7)
// ---------------------------------------------------------------------------
const WORKERS_HKEX: IpoAgentDefinition[] = [
  {
    id: 'hkex_a1_drafter',
    display_name: 'HKEX A1 Drafter',
    display_name_zh: '港交所 A1 申请起草员',
    tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description:
      'Drafts the A1 application proof and the listing document per Main Board Listing Rules Chapter 11 (and Chapter 18A / 18C where applicable). Coordinates with the sponsor on the formal submission package.',
    description_zh:
      '依港交所主板上市规则第 11 章（以及适用情形下的第 18A / 18C 章）起草 A1 申请版本及上市文件。与保荐人协同完成正式递交材料包。',
    capabilities: ['a1_drafting', 'listing_doc_drafting'],
    skill_files: ['skills/ipo/hkex-a1-drafting/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_a1_drafter/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'],
  },

  {
    id: 'hkex_chapter_checker',
    display_name: 'HKEX Main Board Rules Checker',
    display_name_zh: '港交所主板规则检查员',
    tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description:
      'Verifies eligibility against Main Board Listing Rules — Chapter 8 (qualifications, profit / market-cap / revenue tests), Chapter 9 (procedure), Chapter 11 (listing document content). Outputs a pass/fail matrix per rule with cited evidence.',
    description_zh:
      '依主板上市规则核查上市资格——第 8 章（资格要求、盈利 / 市值 / 收入测试）、第 9 章（流程）、第 11 章（上市文件内容）。逐条输出通过 / 不通过矩阵并附引用证据。',
    capabilities: ['main_board_rules_check'],
    skill_files: ['skills/ipo/hkex-rules-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_chapter_checker/AGENT.md', citation_required: true,
  },

  {
    id: 'hkex_gem_checker',
    display_name: 'HKEX GEM Rules Checker',
    display_name_zh: '港交所 GEM 规则检查员',
    tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description:
      'Verifies eligibility under GEM Listing Rules Chapter 11, including the 2-year track record alternative, cash-flow test, and the post-2024 amendments to GEM eligibility.',
    description_zh:
      '依 GEM 上市规则第 11 章核查上市资格，包括两年业绩记录替代条件、现金流测试，以及 2024 年后 GEM 资格修订条款。',
    capabilities: ['gem_rules_check'],
    skill_files: ['skills/ipo/hkex-gem-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_gem_checker/AGENT.md', citation_required: true,
  },

  {
    id: 'hkex_sponsor_qa_handler',
    display_name: 'HKEX Sponsor Q&A Handler',
    display_name_zh: '港交所保荐人问询回复员',
    tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description:
      'Drafts cited responses to HKEX hearing comments and post-hearing comments. Aligns each response with the sponsor\'s due-diligence working papers and the Listing Decisions database for precedent answers.',
    description_zh:
      '为港交所聆讯问题及聆讯后问题起草带引用的回复。每条回复与保荐人尽调底稿、港交所「上市决策数据库」中的先例答复保持一致。',
    capabilities: ['hkex_qa_response'],
    skill_files: ['skills/ipo/hkex-qa-response/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_sponsor_qa_handler/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'SPONSOR'],
  },

  {
    id: 'hkex_connected_tx_analyzer',
    display_name: 'HKEX Connected Transaction Analyzer',
    display_name_zh: '港交所关连交易分析员',
    tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description:
      'Identifies and quantifies connected transactions under Chapter 14A. Computes the percentage ratios (asset / consideration / profits / revenue / equity capital) and routes each transaction into the right disclosure / IFA / shareholder-approval bucket.',
    description_zh:
      '依第 14A 章识别并量化关连交易。计算各项百分比指标（资产比率 / 代价比率 / 盈利比率 / 收益比率 / 股本比率），并将每笔交易归入恰当的披露 / IFA 独立财务顾问 / 股东批准类别。',
    capabilities: ['connected_tx_analysis'],
    skill_files: ['skills/ipo/hkex-connected-tx/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_connected_tx_analyzer/AGENT.md', citation_required: true,
  },

  {
    id: 'hkex_esg_disclosure_drafter',
    display_name: 'HKEX ESG Disclosure Drafter',
    display_name_zh: '港交所 ESG 披露起草员',
    tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description:
      'Drafts the ESG report per HKEX Appendix 27 (now Appendix C2): mandatory environmental KPIs (A1 emissions, A2 use of resources), social KPIs, and the climate-related disclosures aligned with IFRS S2 / TCFD.',
    description_zh:
      '依港交所附录 27（现附录 C2）起草 ESG 报告：强制性环境 KPI（A1 排放、A2 资源使用）、社会 KPI，以及与 IFRS S2 / TCFD 对齐的气候相关披露。',
    capabilities: ['esg_disclosure_drafting'],
    skill_files: ['skills/ipo/hkex-esg/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_esg_disclosure_drafter/AGENT.md', citation_required: true,
  },

  {
    id: 'hkex_track_record_validator',
    display_name: 'HKEX Track Record Validator',
    display_name_zh: '港交所业绩记录核验员',
    tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description:
      'Validates the 3-year track record period (or shortened periods under Chapter 18A pre-revenue biotech / 18C specialist tech). Flags ownership-continuity, management-continuity and reorganization issues that could disqualify the period.',
    description_zh:
      '核验三年业绩记录期（或第 18A 章未盈利生物科技 / 第 18C 章特专科技公司项下的缩短期）。识别可能使该期不合资格的所有权延续性、管理层延续性及重组问题。',
    capabilities: ['track_record_validation'],
    skill_files: ['skills/ipo/hkex-track-record/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_track_record_validator/AGENT.md', citation_required: true,
  },
];

// ---------------------------------------------------------------------------
// Worker Agents — Industry Specialists
// ---------------------------------------------------------------------------
const WORKERS_SAAS: IpoAgentDefinition[] = [
  {
    id: 'saas_metrics_analyzer',
    display_name: 'SaaS Metrics Analyzer',
    display_name_zh: 'SaaS 指标分析员',
    tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description:
      'Computes and benchmarks ARR, MRR, NRR (net revenue retention), GRR (gross retention), CAC payback, LTV/CAC, Magic Number and Rule of 40 against the curated SaaS peer set, surfacing quartile placement.',
    description_zh:
      '计算并对标 ARR、MRR、NRR（净收入留存）、GRR（毛留存）、CAC 回收期、LTV/CAC、Magic Number 与 Rule of 40，与精选 SaaS 同业组合对比并给出分位水平。',
    capabilities: ['saas_metric_analysis'], skill_files: ['skills/ipo/saas-metrics/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/saas_metrics_analyzer/AGENT.md', citation_required: false,
  },
  {
    id: 'saas_revenue_recognition_advisor',
    display_name: 'SaaS Revenue Recognition Advisor',
    display_name_zh: 'SaaS 收入确认顾问',
    tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description:
      'Advises on ASC 606 / IFRS 15 application for SaaS contracts: distinct performance obligations, allocation of transaction price (variable consideration / SSP), capitalization of contract acquisition costs (ASC 340-40), and treatment of usage-based fees.',
    description_zh:
      '为 SaaS 合同提供 ASC 606 / IFRS 15 适用建议：可区分履约义务的识别、交易价格分摊（可变对价 / SSP 独立售价）、合同获取成本资本化（ASC 340-40）、使用量计费的处理。',
    capabilities: ['revrec_advisory'], skill_files: ['skills/ipo/saas-revrec/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/saas_revenue_recognition_advisor/AGENT.md', citation_required: true,
  },
  {
    id: 'saas_cohort_analyzer',
    display_name: 'SaaS Cohort Analyzer',
    display_name_zh: 'SaaS 队列分析员',
    tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description:
      'Builds cohort retention / expansion / churn analyses by signup-month and ICP segment. Surfaces dollar-retention curves and the inflection-point months that drive the equity story.',
    description_zh:
      '按签约月份与 ICP 细分构建队列的留存 / 扩展 / 流失分析。绘制美元留存曲线，识别支撑股权故事的关键拐点月份。',
    capabilities: ['cohort_analysis'], skill_files: ['skills/ipo/saas-cohort/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/saas_cohort_analyzer/AGENT.md', citation_required: false,
  },
];

const WORKERS_BIOPHARMA: IpoAgentDefinition[] = [
  {
    id: 'biopharma_pipeline_evaluator',
    display_name: 'BioPharma Pipeline Evaluator',
    display_name_zh: '生物医药管线评估员',
    tier: 'WORKER', category: 'INDUSTRY_BIOPHARMA',
    description:
      'Evaluates the clinical pipeline (Phase I / II / III) using stage-conditional probability of success by indication, time-to-launch curves, and risk-adjusted NPV per program.',
    description_zh:
      '依临床阶段（I / II / III 期）按适应症条件成功概率、上市时间曲线、单项目风险调整 NPV，对临床管线进行评估。',
    capabilities: ['pipeline_evaluation'], skill_files: ['skills/ipo/biopharma-pipeline/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/biopharma/biopharma_pipeline_evaluator/AGENT.md', citation_required: false,
  },
  {
    id: 'biopharma_ip_analyzer',
    display_name: 'BioPharma IP Analyzer',
    display_name_zh: '生物医药知识产权分析员',
    tier: 'WORKER', category: 'INDUSTRY_BIOPHARMA',
    description:
      'Analyzes the patent portfolio (composition / method / formulation), maps freedom-to-operate against competitor estates, and surfaces exclusivity windows (compound, NCE, orphan drug, pediatric extension).',
    description_zh:
      '分析专利组合（化合物 / 方法 / 制剂），与竞争方专利地产对照评估自由实施空间（FTO），并标识独占期窗口（化合物、新分子实体 NCE、孤儿药、儿科延长期）。',
    capabilities: ['ip_analysis'], skill_files: ['skills/ipo/biopharma-ip/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/biopharma/biopharma_ip_analyzer/AGENT.md', citation_required: true,
  },
  {
    id: 'biopharma_clinical_disclosure_drafter',
    display_name: 'BioPharma Clinical Disclosure Drafter',
    display_name_zh: '生物医药临床数据披露起草员',
    tier: 'WORKER', category: 'INDUSTRY_BIOPHARMA',
    description:
      'Drafts clinical-trial-result disclosures aligned to ICH-GCP and the SEC / HKEX prospectus rules. Ensures statistical significance, adverse-event tabulation and regulator-friendly endpoint reporting.',
    description_zh:
      '依 ICH-GCP 与 SEC / 港交所招股书规则起草临床试验结果披露。确保统计显著性表述、不良事件表格化报告以及监管友好型终点描述。',
    capabilities: ['clinical_disclosure'], skill_files: ['skills/ipo/biopharma-clinical-disclosure/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/biopharma/biopharma_clinical_disclosure_drafter/AGENT.md', citation_required: true,
  },
];

const WORKERS_CLEAN_ENERGY: IpoAgentDefinition[] = [
  {
    id: 'cleanenergy_capex_analyzer',
    display_name: 'Clean Energy Capex Analyzer',
    display_name_zh: '清洁能源资本开支分析员',
    tier: 'WORKER', category: 'INDUSTRY_CLEAN_ENERGY',
    description:
      'Analyzes capex schedules, capacity ramp curves, and unit economics ($/W for solar, $/kWh for storage, $/kW for wind) against quartile benchmarks.',
    description_zh:
      '依分位对标基准分析资本开支日程、产能爬坡曲线及单位经济性（光伏 $/W、储能 $/kWh、风电 $/kW）。',
    capabilities: ['capex_analysis'], skill_files: ['skills/ipo/cleanenergy-capex/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/cleanenergy/cleanenergy_capex_analyzer/AGENT.md', citation_required: false,
  },
  {
    id: 'cleanenergy_subsidy_tracker',
    display_name: 'Clean Energy Subsidy Tracker',
    display_name_zh: '清洁能源补贴跟踪员',
    tier: 'WORKER', category: 'INDUSTRY_CLEAN_ENERGY',
    description:
      'Tracks subsidy / tax-credit programs across jurisdictions: US IRA Sections 45 / 45X / 48E / 30D, EU Innovation Fund / CBAM, China renewable subsidies. Produces an eligibility matrix tied to project geography.',
    description_zh:
      '跨辖区跟踪补贴 / 税收抵免项目：美国 IRA 第 45 / 45X / 48E / 30D 条款、欧盟创新基金 / CBAM、中国可再生能源补贴。形成与项目地理位置挂钩的资格矩阵。',
    capabilities: ['subsidy_tracking'], skill_files: ['skills/ipo/cleanenergy-subsidy/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/cleanenergy/cleanenergy_subsidy_tracker/AGENT.md', citation_required: true,
  },
  {
    id: 'cleanenergy_supply_chain_analyzer',
    display_name: 'Clean Energy Supply Chain Analyzer',
    display_name_zh: '清洁能源供应链分析员',
    tier: 'WORKER', category: 'INDUSTRY_CLEAN_ENERGY',
    description:
      'Analyzes upstream commodity exposure (lithium, cobalt, polysilicon, copper, rare earths) and supplier concentration. Quantifies single-point-of-failure risk and proposes hedging / diversification strategies.',
    description_zh:
      '分析上游大宗原料敞口（锂、钴、多晶硅、铜、稀土）及供应商集中度。量化单点失败风险并提出对冲 / 多元化策略。',
    capabilities: ['supply_chain_analysis'], skill_files: ['skills/ipo/cleanenergy-supply-chain/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/cleanenergy/cleanenergy_supply_chain_analyzer/AGENT.md', citation_required: false,
  },
];

// ---------------------------------------------------------------------------
// Worker Agents — Financial / Audit / ICFR / Legal / Tax / Valuation / Post
// ---------------------------------------------------------------------------
const WORKERS_FINANCIAL: IpoAgentDefinition[] = [
  {
    id: 'ipo_revenue_quality_analyzer',
    display_name: 'Revenue Quality Analyzer',
    display_name_zh: '收入质量分析员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Tests revenue concentration (top-1 / top-5 / top-10 customer share), recognition timing (point-in-time vs over-time), and channel-stuffing risk indicators (DSO spikes, late-quarter sell-in surges).',
    description_zh:
      '测试收入集中度（前 1 / 前 5 / 前 10 大客户占比）、收入确认时点（时点法 vs 期间法）、压货风险指标（应收周转天数飙升、季末压货激增）。',
    capabilities: ['revenue_quality'], skill_files: ['skills/ipo/revenue-quality/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_revenue_quality_analyzer/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_cash_flow_analyst',
    display_name: 'Cash Flow Analyst',
    display_name_zh: '现金流分析员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Reconciles operating, investing and financing cash flows with the income statement and balance sheet. Computes normalized FCF excluding one-time items and capitalizable working-capital swings.',
    description_zh:
      '将经营、投资、筹资活动现金流与利润表、资产负债表勾稽。计算剔除一次性项目与可资本化营运资本波动后的标准化自由现金流（FCF）。',
    capabilities: ['cash_flow_analysis'], skill_files: ['skills/ipo/cash-flow-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_cash_flow_analyst/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_kpi_tracker',
    display_name: 'KPI Tracker',
    display_name_zh: 'KPI 跟踪员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Tracks operating KPIs (gross margin, operating margin, FCF conversion, growth efficiency) and benchmarks them against industry quartile distributions (p10 / p25 / p50 / p75 / p90).',
    description_zh:
      '跟踪运营 KPI（毛利率、营业利润率、FCF 转化率、增长效率），与行业分位分布（p10 / p25 / p50 / p75 / p90）对标。',
    capabilities: ['kpi_tracking'], skill_files: ['skills/ipo/kpi-tracking/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_kpi_tracker/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_variance_analyst',
    display_name: 'Variance Analyst',
    display_name_zh: '差异分析员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Period-over-period variance analysis (YoY, QoQ) decomposed by volume / price / mix / FX. Drafts MD&A-ready explanations for material variances.',
    description_zh:
      '按量 / 价 / 结构 / 汇率分解的同比、环比差异分析。为重要差异起草可直接进入 MD&A 的解释草稿。',
    capabilities: ['variance_analysis'], skill_files: ['skills/ipo/variance-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_variance_analyst/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_pl_diagnostician',
    display_name: 'P&L Diagnostician',
    display_name_zh: '损益表诊断员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Diagnoses P&L health: margin trajectory by segment, opex discipline (S&M / R&D / G&A as % of revenue), one-time and non-recurring items that should be normalized.',
    description_zh:
      '诊断损益表健康度：分部毛利率轨迹、费用纪律（销售 / 研发 / 管理费率）、应被标准化的一次性与非经常性损益项目。',
    capabilities: ['pl_diagnosis'], skill_files: ['skills/ipo/pl-diagnosis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_pl_diagnostician/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_balance_sheet_diagnostician',
    display_name: 'Balance Sheet Diagnostician',
    display_name_zh: '资产负债表诊断员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Diagnoses balance sheet: leverage ratios (net debt / EBITDA, interest coverage), liquidity (current / quick ratio, days of cash), asset quality (impairment indicators, goodwill exposure).',
    description_zh:
      '诊断资产负债表：杠杆比率（净债务 / EBITDA、利息保障倍数）、流动性（流动 / 速动比率、现金天数）、资产质量（减值迹象、商誉敞口）。',
    capabilities: ['balance_sheet_diagnosis'], skill_files: ['skills/ipo/balance-sheet-diagnosis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_balance_sheet_diagnostician/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_capital_efficiency_analyzer',
    display_name: 'Capital Efficiency Analyzer',
    display_name_zh: '资本效率分析员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Computes ROIC, ROE (DuPont decomposition), asset turnover, and the spread of ROIC over WACC — a core proof point for the equity story.',
    description_zh:
      '计算 ROIC、ROE（DuPont 三因子分解）、资产周转率，以及 ROIC 与 WACC 的利差——支撑股权故事的核心证明点。',
    capabilities: ['capital_efficiency'], skill_files: ['skills/ipo/capital-efficiency/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_capital_efficiency_analyzer/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_working_capital_analyzer',
    display_name: 'Working Capital Analyzer',
    display_name_zh: '营运资本分析员',
    tier: 'WORKER', category: 'FINANCIAL',
    description:
      'Tracks DSO (days sales outstanding) / DPO (days payable outstanding) / DIO (days inventory outstanding) cycles and stress-tests cash conversion against revenue-growth scenarios.',
    description_zh:
      '跟踪 DSO（应收周转天数）/ DPO（应付周转天数）/ DIO（存货周转天数）周期，并就收入增长情景对现金转换周期进行压力测试。',
    capabilities: ['working_capital'], skill_files: ['skills/ipo/working-capital/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_working_capital_analyzer/AGENT.md', citation_required: false,
  },
];

const WORKERS_AUDIT: IpoAgentDefinition[] = [
  {
    id: 'ipo_audit_preparer',
    display_name: 'Audit Preparer',
    display_name_zh: '审计资料准备员',
    tier: 'WORKER', category: 'AUDIT',
    description:
      'Prepares the audit-ready trial balance, account schedules and supporting evidence package the Big-4 auditor expects on day one. Maps every line to its underlying detail and source documents.',
    description_zh:
      '准备四大审计师首日所需的审计就绪试算平衡表、科目明细表与佐证材料包。将每条余额映射到其底层明细与原始凭证。',
    capabilities: ['audit_preparation'], skill_files: ['skills/ipo/audit-preparer/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_audit_preparer/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_workpaper_organizer',
    display_name: 'Workpaper Organizer',
    display_name_zh: '工作底稿整理员',
    tier: 'WORKER', category: 'AUDIT',
    description:
      'Organizes workpapers per the audit firm\'s template, indexes evidence, and ensures retention compliant with PCAOB AS 1215 (Audit Documentation).',
    description_zh:
      '依审计师工作底稿模板整理底稿、为审计证据编制索引，确保保管周期符合 PCAOB AS 1215（审计文档）要求。',
    capabilities: ['workpaper_organization'], skill_files: ['skills/ipo/workpaper-organization/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_workpaper_organizer/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_materiality_calculator',
    display_name: 'Materiality Calculator',
    display_name_zh: '重要性水平计算员',
    tier: 'WORKER', category: 'AUDIT',
    description:
      'Computes overall materiality (typically 5% of pre-tax income or 0.5% of revenue), performance materiality (50–75% of overall) and tolerable error / TE thresholds for each significant account.',
    description_zh:
      '计算总体重要性水平（通常为税前利润 5% 或营收 0.5%）、执行重要性（总体的 50–75%）以及各重大科目的可容忍错报（TE）门槛。',
    capabilities: ['materiality_calculation'], skill_files: ['skills/ipo/materiality/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_materiality_calculator/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_sampling_planner',
    display_name: 'Sampling Planner',
    display_name_zh: '审计抽样规划员',
    tier: 'WORKER', category: 'AUDIT',
    description:
      'Plans audit sample sizes per AS 2315 / ISA 530, choosing between attribute / monetary-unit / classical variables sampling based on assertion and population characteristics.',
    description_zh:
      '依 AS 2315 / ISA 530 规划抽样样本量，根据审计认定与总体特征在属性抽样 / 货币单位抽样 / 古典变量抽样之间选取方法。',
    capabilities: ['sampling_planning'], skill_files: ['skills/ipo/sampling-planning/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_sampling_planner/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_deficiency_tracker',
    display_name: 'Deficiency Tracker',
    display_name_zh: '审计缺陷跟踪员',
    tier: 'WORKER', category: 'AUDIT',
    description:
      'Tracks audit deficiencies through the lifecycle: identification → severity classification (deficiency / significant deficiency / material weakness) → remediation owner → re-test → closure.',
    description_zh:
      '跟踪审计缺陷的全生命周期：识别 → 严重程度分类（一般缺陷 / 重大缺陷 / 重要缺陷 / 重大薄弱）→ 整改负责人 → 重新测试 → 关闭。',
    capabilities: ['deficiency_tracking'], skill_files: ['skills/ipo/deficiency-tracking/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_deficiency_tracker/AGENT.md', citation_required: false,
  },
];

const WORKERS_ICFR: IpoAgentDefinition[] = [
  {
    id: 'ipo_icfr_designer',
    display_name: 'ICFR Control Designer',
    display_name_zh: '内控设计师',
    tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description:
      'Designs the entity-level (tone, risk assessment, monitoring) and process-level (R2R, P2P, O2C, treasury, payroll) control set. Produces a RACI / control matrix mapped to financial statement assertions.',
    description_zh:
      '设计实体级（管理层基调、风险评估、监督）与流程级（R2R 总账、P2P 采购付款、O2C 销售收款、资金、薪酬）控制集合。产出与财务报表认定挂钩的 RACI / 控制矩阵。',
    capabilities: ['icfr_design'], skill_files: ['skills/ipo/icfr-design/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_icfr_designer/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_internal_control_monitor',
    display_name: 'Internal Control Monitor',
    display_name_zh: '内控持续监控员',
    tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description:
      'Continuous control monitoring: rule-based exception detection (journal entries above threshold, weekend postings, manual adjustments) with automatic flagging into the deficiency queue.',
    description_zh:
      '持续控制监控：基于规则的异常检测（超过阈值的日记账、周末过账、手工调整），自动标记并推送至缺陷队列。',
    capabilities: ['control_monitoring'], skill_files: ['skills/ipo/control-monitoring/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_internal_control_monitor/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_segregation_checker',
    display_name: 'Segregation of Duties Checker',
    display_name_zh: '职责分离检查员',
    tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description:
      'Detects SoD conflicts in transactional system access (ERP / HRIS / treasury): same user can both create and approve a vendor, post and reconcile a journal, request and approve a payment.',
    description_zh:
      '检测交易系统访问权限（ERP / HRIS / 资金系统）中的职责分离冲突：同一用户同时具备「新增供应商」与「审批供应商」、「过账日记账」与「核对日记账」、「发起付款」与「审批付款」等组合。',
    capabilities: ['sod_check'], skill_files: ['skills/ipo/sod-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_segregation_checker/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_fraud_detector',
    display_name: 'Fraud Indicator Detector',
    display_name_zh: '舞弊指标检测员',
    tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description:
      'Applies AS 2401 fraud-risk factors (incentive / pressure, opportunity, rationalization) to flag anomalies. Runs Beneish M-Score, Benford-law digit tests on transactional data and round-number journal entries.',
    description_zh:
      '应用 AS 2401 舞弊风险因素（动机 / 压力、机会、合理化）识别异常。对交易数据运行 Beneish M-Score、Benford 法则数字检验，并标识整数日记账。',
    capabilities: ['fraud_detection'], skill_files: ['skills/ipo/fraud-detection/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_fraud_detector/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_itgc_assessor',
    display_name: 'IT General Controls Assessor',
    display_name_zh: 'IT 一般控制评估员',
    tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description:
      'Assesses ITGC across four domains: access management (provisioning / deprovisioning / privileged access review), change management (SDLC, segregation), operations (job scheduling, backup, incident response), and computer operations.',
    description_zh:
      '从四大领域评估 IT 一般控制：访问管理（账号开通 / 注销 / 特权访问复核）、变更管理（SDLC、职责分离）、运维（作业调度、备份、事件响应）以及计算机运营。',
    capabilities: ['itgc_assessment'], skill_files: ['skills/ipo/itgc-assessment/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_itgc_assessor/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_walkthrough_documenter',
    display_name: 'Walkthrough Documenter',
    display_name_zh: '穿行测试记录员',
    tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description:
      'Documents process walkthroughs end-to-end: source → input → processing → reporting. Maps every control point to its risk and to the assertion it addresses, suitable for auditor reperformance.',
    description_zh:
      '端到端记录流程穿行测试：源头 → 输入 → 处理 → 报告。将每个控制点映射到对应风险与所应对的认定，便于审计师再执行。',
    capabilities: ['walkthrough_documentation'], skill_files: ['skills/ipo/walkthrough-documentation/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_walkthrough_documenter/AGENT.md', citation_required: false,
  },
];

const WORKERS_LEGAL_TAX: IpoAgentDefinition[] = [
  {
    id: 'ipo_restructuring_advisor',
    display_name: 'Restructuring Advisor',
    display_name_zh: '重组顾问',
    tier: 'WORKER', category: 'LEGAL',
    description:
      'Advises on listing-vehicle structure trade-offs: Direct (US-domiciled IssuerCo) vs VIE (PRC operating co + Cayman top-co with control agreements) vs Red-chip vs Dual-primary. Surfaces the tax, regulatory and disclosure consequences of each.',
    description_zh:
      '为上市主体架构的取舍提供建议：直接上市（美国注册母公司）vs VIE（境内运营实体 + 开曼母公司 + 协议控制）vs 红筹 vs 双重主要上市。揭示每种架构的税务、监管与披露后果。',
    capabilities: ['restructuring_advisory'], skill_files: ['skills/ipo/restructuring/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_restructuring_advisor/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_lockup_clause_analyzer',
    display_name: 'Lockup Clause Analyzer',
    display_name_zh: '锁定期条款分析员',
    tier: 'WORKER', category: 'LEGAL',
    description:
      'Analyzes existing investor lock-up clauses (employee shares, founder shares, pre-IPO investors), reconciles them with the underwriter\'s 180-day standard lock-up, and surfaces release-day overhang.',
    description_zh:
      '分析既有投资者锁定期条款（员工股、创始人股、IPO 前投资者），与承销商标准 180 天锁定期勾稽，并揭示解禁日的供给压力。',
    capabilities: ['lockup_analysis'], skill_files: ['skills/ipo/lockup-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_lockup_clause_analyzer/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_related_party_tx_reviewer',
    display_name: 'Related Party Tx Reviewer',
    display_name_zh: '关联交易复核员',
    tier: 'WORKER', category: 'LEGAL',
    description:
      'Identifies and reviews related-party transactions per Item 404 of Reg S-K (US) / Chapter 14A (HKEX). Tests fair-value pricing, board approval, and continuing-obligation disclosure adequacy.',
    description_zh:
      '依 Reg S-K 第 404 项（美国）/ 第 14A 章（港交所）识别并复核关联 / 关连交易。测试公允定价、董事会审批以及持续披露义务是否充分。',
    capabilities: ['related_party_review'], skill_files: ['skills/ipo/related-party-review/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_related_party_tx_reviewer/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_corporate_governance_advisor',
    display_name: 'Corporate Governance Advisor',
    display_name_zh: '公司治理顾问',
    tier: 'WORKER', category: 'LEGAL',
    description:
      'Recommends board composition (majority-independent for Nasdaq / NYSE, INED requirements for HKEX), committee charters (Audit / Comp / Nom & Gov), and dual-class share guardrails per market rules.',
    description_zh:
      '依各市场规则推荐董事会构成（纳斯达克 / 纽交所要求多数独立董事，港交所对 INED 的要求）、委员会章程（审计 / 薪酬 / 提名与治理）、双重股权架构的保护性安排。',
    capabilities: ['governance_advisory'], skill_files: ['skills/ipo/governance/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_corporate_governance_advisor/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_cross_border_tax_optimizer',
    display_name: 'Cross-Border Tax Optimizer',
    display_name_zh: '跨境税务优化员',
    tier: 'WORKER', category: 'TAX',
    description:
      'Optimizes cross-border tax architecture using treaty networks: dividend / interest / royalty withholding minimization, GILTI / Subpart F mitigation for US holders, BEPS Pillar 2 readiness.',
    description_zh:
      '基于税收协定网络优化跨境税务架构：股息 / 利息 / 特许权使用费预提税最小化、美国持有人的 GILTI / Subpart F 缓释、BEPS 第二支柱合规准备。',
    capabilities: ['tax_optimization'], skill_files: ['skills/ipo/tax-optimization/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_cross_border_tax_optimizer/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_transfer_pricing_advisor',
    display_name: 'Transfer Pricing Advisor',
    display_name_zh: '转让定价顾问',
    tier: 'WORKER', category: 'TAX',
    description:
      'Advises on transfer pricing methods (CUP / Resale Price / Cost Plus / TNMM / PSM), local-file / master-file / CbCR documentation, and BEPS Action 13 alignment.',
    description_zh:
      '为转让定价方法（CUP / 再销售价格法 / 成本加成法 / TNMM / 利润分割法）、本地文档 / 主体文档 / CbCR 国别报告，以及 BEPS 行动计划 13 的合规对齐提供建议。',
    capabilities: ['transfer_pricing'], skill_files: ['skills/ipo/transfer-pricing/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_transfer_pricing_advisor/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_treaty_analyzer',
    display_name: 'Tax Treaty Analyzer',
    display_name_zh: '税收协定分析员',
    tier: 'WORKER', category: 'TAX',
    description:
      'Analyzes applicable double-tax treaties (US–HK, US–PRC, US–Cayman absent, HK–PRC, HK–Singapore etc.) and computes effective withholding rates for the proposed cash-flow paths.',
    description_zh:
      '分析适用的避免双重征税协定（美 - 港、美 - 中、美 - 开曼缺位、港 - 中、港 - 新等）并计算拟定资金路径的有效预提税率。',
    capabilities: ['treaty_analysis'], skill_files: ['skills/ipo/treaty-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_treaty_analyzer/AGENT.md', citation_required: true,
  },
];

const WORKERS_VALUATION: IpoAgentDefinition[] = [
  {
    id: 'ipo_dcf_modeler',
    display_name: 'DCF Modeler',
    display_name_zh: 'DCF 建模员',
    tier: 'WORKER', category: 'VALUATION',
    description:
      'Builds DCF models with 5-10 year explicit forecast, terminal value via Gordon-growth or exit-multiple, and full sensitivity / scenario / Monte-Carlo extensions.',
    description_zh:
      '搭建 DCF 模型：5–10 年显性预测、用 Gordon 永续增长或退出倍数法计算终值，并附完整的敏感度 / 情景 / 蒙特卡洛扩展。',
    capabilities: ['dcf_modeling'], skill_files: ['skills/ipo/dcf-modeling/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_dcf_modeler/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_comparable_company_valuator',
    display_name: 'Comparable Company Valuator',
    display_name_zh: '可比公司估值员',
    tier: 'WORKER', category: 'VALUATION',
    description:
      'Builds public-company multiple-based valuations: EV/Revenue, EV/EBITDA, P/E, P/S, Rule-of-40 multiples, normalized for size / growth / margin differentials.',
    description_zh:
      '搭建可比上市公司倍数法估值：EV/收入、EV/EBITDA、市盈率、市销率、Rule-of-40 倍数，并对规模 / 增速 / 利润率差异进行标准化调整。',
    capabilities: ['comp_valuation'], skill_files: ['skills/ipo/comp-valuation/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_comparable_company_valuator/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_precedent_transaction_analyzer',
    display_name: 'Precedent Transaction Analyzer',
    display_name_zh: '先例交易分析员',
    tier: 'WORKER', category: 'VALUATION',
    description:
      'Builds precedent-M&A and precedent-IPO valuations. Adjusts for control premium (typically 25–35%), strategic-buyer synergies and market conditions at the time of each precedent.',
    description_zh:
      '基于并购先例与 IPO 先例进行估值。对控制权溢价（通常 25–35%）、战略买家协同效应、各先例发生时的市场状况进行调整。',
    capabilities: ['precedent_tx_analysis'], skill_files: ['skills/ipo/precedent-tx/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_precedent_transaction_analyzer/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_wacc_calculator',
    display_name: 'WACC Calculator',
    display_name_zh: 'WACC 计算器',
    tier: 'WORKER', category: 'VALUATION',
    description:
      'Computes WACC using levered / unlevered industry betas (Damodaran method), country-risk premium (Damodaran CRP table) and the issuer\'s target capital structure.',
    description_zh:
      '使用有杠杆 / 无杠杆行业 Beta（Damodaran 方法）、国家风险溢价（Damodaran CRP 表）以及发行人目标资本结构计算 WACC。',
    capabilities: ['wacc_calculation'], skill_files: ['skills/ipo/wacc/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_wacc_calculator/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_sensitivity_analyzer',
    display_name: 'Sensitivity Analyzer',
    display_name_zh: '敏感度分析员',
    tier: 'WORKER', category: 'VALUATION',
    description:
      'Builds tornado / one-way / two-way sensitivity tables across the key value drivers (revenue growth, terminal margin, WACC, exit multiple). Produces the P10 / P50 / P90 valuation envelope.',
    description_zh:
      '围绕关键价值驱动因素（收入增速、终值利润率、WACC、退出倍数）构建龙卷风图 / 单变量 / 双变量敏感度表。产出 P10 / P50 / P90 估值通道。',
    capabilities: ['sensitivity_analysis'], skill_files: ['skills/ipo/sensitivity/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_sensitivity_analyzer/AGENT.md', citation_required: false,
  },
];

const WORKERS_DISCLOSURE: IpoAgentDefinition[] = [
  {
    id: 'ipo_business_section_drafter',
    display_name: 'Business Section Drafter',
    display_name_zh: '业务章节起草员',
    tier: 'WORKER', category: 'DISCLOSURE',
    description:
      'Drafts the Business / Description-of-Business section: products & services, business model, sales & marketing, customers, competition, intellectual property, regulatory environment, employees and properties.',
    description_zh:
      '起草「业务 / 业务描述」章节：产品与服务、商业模式、销售与营销、客户、竞争、知识产权、监管环境、员工与物业。',
    capabilities: ['business_section_drafting'], skill_files: ['skills/ipo/business-section/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_business_section_drafter/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_risk_factors_drafter',
    display_name: 'Risk Factors Drafter',
    display_name_zh: '风险因素起草员',
    tier: 'WORKER', category: 'DISCLOSURE',
    description:
      'Drafts the Risk Factors section: business risks, financial risks, regulatory & legal risks, market risks, controlling-shareholder risks. Each factor specific, material, and free from generic boilerplate per Reg S-K Item 105.',
    description_zh:
      '起草风险因素章节：业务风险、财务风险、监管与法律风险、市场风险、控股股东风险。依 Reg S-K 第 105 项要求，每条风险均需具体、重大、避免通用模板化表述。',
    capabilities: ['risk_factors_drafting'], skill_files: ['skills/ipo/risk-factors/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_risk_factors_drafter/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_use_of_proceeds_drafter',
    display_name: 'Use of Proceeds Drafter',
    display_name_zh: '募集资金用途起草员',
    tier: 'WORKER', category: 'DISCLOSURE',
    description:
      'Drafts the Use of Proceeds section consistent with the valuation memo and the operating plan. Quantifies allocation across R&D, S&M, M&A, debt repayment and general corporate purposes.',
    description_zh:
      '与估值备忘录及经营计划保持一致，起草募集资金用途章节。量化在研发、销售与营销、并购、偿债与一般企业用途之间的分配。',
    capabilities: ['proceeds_drafting'], skill_files: ['skills/ipo/use-of-proceeds/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_use_of_proceeds_drafter/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_mdna_drafter',
    display_name: 'MD&A Drafter',
    display_name_zh: 'MD&A 起草员',
    tier: 'WORKER', category: 'DISCLOSURE',
    description:
      'Drafts the Management\'s Discussion & Analysis section per Reg S-K Item 303 (US) or HKEX equivalent: results of operations, liquidity, capital resources, critical accounting estimates, known trends and uncertainties.',
    description_zh:
      '依 Reg S-K 第 303 项（美国）或港交所对应规则起草「管理层讨论与分析」章节：经营业绩、流动性、资本资源、关键会计估计、已知趋势与不确定性。',
    capabilities: ['mdna_drafting'], skill_files: ['skills/ipo/mdna/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_mdna_drafter/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_amendment_planner',
    display_name: 'Amendment Planner',
    display_name_zh: '修订规划员',
    tier: 'WORKER', category: 'DISCLOSURE',
    description:
      'Plans which prospectus sections need amendment after each comment-letter round. Produces a redline plan with section owners, deadline and downstream-impact map.',
    description_zh:
      '在每轮反馈意见函后规划需修订的招股书章节。产出含章节负责人、截止日与下游影响地图的红线修订计划。',
    capabilities: ['amendment_planning'], skill_files: ['skills/ipo/amendment-planning/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_amendment_planner/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_investor_narrative_drafter',
    display_name: 'Investor Narrative Drafter',
    display_name_zh: '投资者叙事起草员',
    tier: 'WORKER', category: 'DISCLOSURE',
    description:
      'Drafts the equity story / roadshow narrative: 60-second elevator pitch, market opportunity, business model, competitive moat, financial trajectory, leadership story.',
    description_zh:
      '起草股权故事 / 路演叙事：60 秒电梯演讲、市场机会、商业模式、竞争护城河、财务轨迹、领导力故事。',
    capabilities: ['narrative_drafting'], skill_files: ['skills/ipo/narrative-drafting/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_investor_narrative_drafter/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_esg_metric_calculator',
    display_name: 'ESG Metric Calculator',
    display_name_zh: 'ESG 指标计算器',
    tier: 'WORKER', category: 'DISCLOSURE',
    description:
      'Calculates GHG (Scope 1 / 2 / 3), social and governance metrics required by HKEX Appendix 27 / IFRS S2 / SEC climate-rule (where applicable). Produces the underlying calculation workpapers.',
    description_zh:
      '计算 HKEX 附录 27 / IFRS S2 / SEC 气候规则（适用情形下）所要求的温室气体排放（范围 1 / 2 / 3）、社会与治理指标。产出支撑性的计算底稿。',
    capabilities: ['esg_metric_calculation'], skill_files: ['skills/ipo/esg-metrics/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_esg_metric_calculator/AGENT.md', citation_required: true,
  },
];

const WORKERS_POST_IPO: IpoAgentDefinition[] = [
  {
    id: 'ipo_stock_price_simulator',
    display_name: 'Stock Price Simulator',
    display_name_zh: '股价模拟器',
    tier: 'WORKER', category: 'POST_IPO',
    description:
      'Runs Monte-Carlo / GARCH price-path simulations for post-IPO scenarios. Surfaces the P10 / P50 / P90 envelope, probability of breaking issue price, and downside-risk exposure across various drift / vol assumptions.',
    description_zh:
      '为上市后情景运行蒙特卡洛 / GARCH 股价路径模拟。揭示 P10 / P50 / P90 通道、跌破发行价的概率，以及在不同漂移率 / 波动率假设下的下行风险敞口。',
    capabilities: ['price_simulation'], skill_files: ['skills/ipo/price-simulation/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_stock_price_simulator/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_roadshow_qa_simulator',
    display_name: 'Roadshow Q&A Simulator',
    display_name_zh: '路演问答模拟员',
    tier: 'WORKER', category: 'POST_IPO',
    description:
      'Generates the probable investor question list (top 50 by likelihood) and rehearsal answers anchored to the prospectus. Flags answers that risk Reg FD selective-disclosure violations.',
    description_zh:
      '生成最可能的投资者问题清单（前 50 个，按可能性排序）以及锚定到招股书的预演答复。标识可能违反 Reg FD 选择性披露规则的答复。',
    capabilities: ['roadshow_qa_simulation'], skill_files: ['skills/ipo/roadshow-qa/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_roadshow_qa_simulator/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_quarterly_filing_assistant',
    display_name: 'Quarterly Filing Assistant',
    display_name_zh: '季报申报助手',
    tier: 'WORKER', category: 'POST_IPO',
    description:
      'Assists with 10-Q / 6-K / interim-report preparation: rolls forward financials, drafts MD&A delta, surfaces new risk factors and assembles the certifications (302 / 906) for officer signature.',
    description_zh:
      '协助 10-Q / 6-K / 中期报告的编制：滚动财务数据、起草 MD&A 增量、识别新增风险因素，并整理高管签署所需的认证（302 / 906）。',
    capabilities: ['quarterly_filing'], skill_files: ['skills/ipo/quarterly-filing/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_quarterly_filing_assistant/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_lockup_period_tracker',
    display_name: 'Lockup Period Tracker',
    display_name_zh: '锁定期跟踪员',
    tier: 'WORKER', category: 'POST_IPO',
    description:
      'Tracks the lock-up release calendar (180-day standard, staggered tranches, early-release triggers) and quantifies the supply-overhang risk on each release date.',
    description_zh:
      '跟踪锁定期解禁日历（180 天标准期、分批解禁、提前解禁触发条件），并量化每个解禁日的供给压力风险。',
    capabilities: ['lockup_tracking'], skill_files: ['skills/ipo/lockup-tracking/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_lockup_period_tracker/AGENT.md', citation_required: false,
  },
];

const WORKERS_INDUSTRY_SUPPORT: IpoAgentDefinition[] = [
  {
    id: 'ipo_competitive_positioner',
    display_name: 'Competitive Positioner',
    display_name_zh: '竞争定位员',
    tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description:
      'Maps the issuer against named competitors across product breadth, geographic reach, customer ICP, pricing model, and key financial metrics (growth, margin, retention).',
    description_zh:
      '从产品广度、地理覆盖、客户 ICP、定价模型、关键财务指标（增速、利润率、留存）维度，将发行人与具名竞争对手进行对比映射。',
    capabilities: ['competitive_positioning'], skill_files: ['skills/ipo/competitive-positioning/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/ipo_competitive_positioner/AGENT.md', citation_required: false,
  },
  {
    id: 'ipo_tam_sam_som_estimator',
    display_name: 'TAM/SAM/SOM Estimator',
    display_name_zh: 'TAM/SAM/SOM 市场规模测算员',
    tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description:
      'Estimates Total / Serviceable / Obtainable Addressable Market using top-down (analyst reports) and bottom-up (account count × ACV) methods, reconciles divergences and surfaces market-share trajectory.',
    description_zh:
      '采用自上而下（分析师报告）与自下而上（账户数 × ACV）两种方法估算 TAM / SAM / SOM，调和差异并揭示市场份额轨迹。',
    capabilities: ['market_sizing'], skill_files: ['skills/ipo/market-sizing/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/ipo_tam_sam_som_estimator/AGENT.md', citation_required: false,
  },
];

// ---------------------------------------------------------------------------
// RAG retrieval agents (3)
// ---------------------------------------------------------------------------
const WORKERS_RAG: IpoAgentDefinition[] = [
  {
    id: 'ipo_regulation_retriever',
    display_name: 'Regulation Retriever',
    display_name_zh: '法规检索员',
    tier: 'WORKER', category: 'RAG',
    description:
      'Hybrid (vector + BM25) retrieval over the regulation knowledge base. Returns top-K chunks with cited source URLs, ready for downstream drafting / answering agents to splice into outputs.',
    description_zh:
      '在法规知识库上执行混合检索（向量 + BM25）。返回 Top-K 片段及来源 URL 引用，供下游起草 / 答复 Agent 直接拼接进入产出。',
    capabilities: ['regulation_retrieval'], skill_files: ['skills/ipo/regulation-retrieval/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/rag/ipo_regulation_retriever/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_precedent_case_retriever',
    display_name: 'Precedent Case Retriever',
    display_name_zh: '先例案例检索员',
    tier: 'WORKER', category: 'RAG',
    description:
      'Retrieves comparable IPO filings, comment-letter answers, and HKEX hearing decisions whose facts match the issuer\'s situation. Used to draft responses anchored to precedent rather than first principles alone.',
    description_zh:
      '检索与发行人情况事实相近的可比 IPO 申报、反馈意见函答复以及港交所聆讯决策。用于将回复锚定到先例（而非仅依据第一性原理）。',
    capabilities: ['precedent_retrieval'], skill_files: ['skills/ipo/precedent-retrieval/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/rag/ipo_precedent_case_retriever/AGENT.md', citation_required: true,
  },
  {
    id: 'ipo_industry_benchmark_retriever',
    display_name: 'Industry Benchmark Retriever',
    display_name_zh: '行业对标检索员',
    tier: 'WORKER', category: 'RAG',
    description:
      'Retrieves curated industry benchmark distributions (p10 / p25 / p50 / p75 / p90) for any KPI on demand, by industry × stage × geography slice.',
    description_zh:
      '按需检索任一 KPI 的精选行业对标分布（p10 / p25 / p50 / p75 / p90），可按「行业 × 阶段 × 地区」切片。',
    capabilities: ['benchmark_retrieval'], skill_files: ['skills/ipo/benchmark-retrieval/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/rag/ipo_industry_benchmark_retriever/AGENT.md', citation_required: false,
  },
];

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------
export const ALL_IPO_AGENTS: IpoAgentDefinition[] = [
  ...CEO_AGENTS,
  ...LEAD_AGENTS,
  ...WORKERS_SEC,
  ...WORKERS_HKEX,
  ...WORKERS_SAAS,
  ...WORKERS_BIOPHARMA,
  ...WORKERS_CLEAN_ENERGY,
  ...WORKERS_FINANCIAL,
  ...WORKERS_AUDIT,
  ...WORKERS_ICFR,
  ...WORKERS_LEGAL_TAX,
  ...WORKERS_VALUATION,
  ...WORKERS_DISCLOSURE,
  ...WORKERS_POST_IPO,
  ...WORKERS_INDUSTRY_SUPPORT,
  ...WORKERS_RAG,
];

const _by_id = new Map(ALL_IPO_AGENTS.map(a => [a.id, a]));

export function get_ipo_agent(id: string): IpoAgentDefinition | undefined {
  return _by_id.get(id);
}

export function find_ipo_agents_by_capability(capability: string): IpoAgentDefinition[] {
  return ALL_IPO_AGENTS.filter(a => a.capabilities.includes(capability));
}

export function list_ipo_agents_by_tier(tier: AgentTier): IpoAgentDefinition[] {
  return ALL_IPO_AGENTS.filter(a => a.tier === tier);
}

export function list_ipo_agents_by_category(category: AgentCategory): IpoAgentDefinition[] {
  return ALL_IPO_AGENTS.filter(a => a.category === category);
}

export const IPO_AGENT_COUNT = ALL_IPO_AGENTS.length;
