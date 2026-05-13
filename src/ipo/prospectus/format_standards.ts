// file: src/ipo/prospectus/format_standards.ts
// description: Prospectus Format Standards (PFS) registry — encodes the
//              jurisdiction-specific formatting, content, and disclosure
//              requirements that every prospectus / listing-document section
//              must comply with for each TargetMarket. This is the source of
//              truth that the agent_runner injects into a section drafter's
//              system prompt and that the PFS Compliance Linter validates the
//              generated draft against.
//
//              Layer 1 of the PFS architecture:
//                Layer 1: PFS Registry (this file)
//                Layer 2: Format injection in agent_runner.build_system_prompt()
//                Layer 3: Structured markdown + JSON envelope output
//                Layer 4: PFS Compliance Linter (post-generation validator)
//
// reference: SEC Reg S-K (17 CFR 229), Reg S-X (17 CFR 210), Form S-1, Form F-1
//            HKEX Main Board Listing Rules (App.1A, Ch.4, Ch.11, Ch.14A, App.27)
//            HKEX GEM Listing Rules (App.1B, Ch.14)

import type { TargetMarket } from '../types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Output schema the agent must return for the section. */
export interface OutputSchema {
  /** A short markdown skeleton listing the sub-headings the draft MUST contain, in order. */
  required_subheadings: string[];
  /** Force the agent to also emit a JSON envelope wrapping the draft. */
  json_envelope: true;
  /** Free-text note describing tone, voice, and POV (e.g. third-person, plain English). */
  voice_guidance: string;
}

/** Specification for a single section in a single jurisdiction. */
export interface SectionFormatSpec {
  /** Stable code, e.g. 'risk_factors', 'mdna', 'connected'. */
  section_code: string;
  /** Human label English. */
  section_label: string;
  /** Human label Chinese. */
  section_label_zh: string;
  /**
   * Statutory anchor — the rule / form item that mandates this section.
   * e.g. 'Reg S-K Item 105', 'HKEX App.1A.40'.
   */
  statutory_anchor: string;
  /** Position in the canonical document order (1-based). */
  ordering: number;
  /** True if the section is mandatory for this market; false if conditional. */
  required: boolean;
  /** Lower bound on word count; agent should expand to at least this. */
  min_word_count?: number;
  /** Upper bound on word count; agent should compress to at most this. */
  max_word_count?: number;
  /**
   * Sub-elements / content categories that MUST appear in the section, each in
   * the form "code: human description". The linter looks for the description
   * (substring match, case-insensitive) in the rendered draft.
   */
  required_elements: string[];
  /** Specific disclosure phrases that must appear verbatim or near-verbatim. */
  mandatory_disclosures: string[];
  /** Citation requirements — what kinds of sources must back claims here. */
  required_citations: string[];
  /** Output schema constraints. */
  output_schema: OutputSchema;
}

/** Per-jurisdiction document specification. */
export interface JurisdictionFormatStandard {
  target_market: TargetMarket;
  /** "Form S-1 (US Domestic Issuer)" / "A1 Application Proof (HKEX Main Board)" etc. */
  document_type: string;
  /** Locale label shown to humans, e.g. "US SEC — Form S-1 / F-1". */
  locale_label: string;
  /** Locale label in Chinese. */
  locale_label_zh: string;
  /**
   * Cross-section formatting rules that apply to every section in this market
   * (e.g. plain-English requirement for SEC, traditional Chinese for HKEX).
   */
  global_requirements: string[];
  /** All sections, indexed by section_code. */
  sections: Record<string, SectionFormatSpec>;
}

// ---------------------------------------------------------------------------
// SEC standard (Form S-1 / F-1) — shared across all SEC venues
// ---------------------------------------------------------------------------

const SEC_GLOBAL_REQUIREMENTS = [
  'Plain-English mandate (Securities Act Rule 421(d)) — short sentences, definite everyday words, active voice, no legalese, no multiple negatives.',
  'Forward-looking statements must be identified and accompanied by meaningful cautionary language (PSLRA safe harbor).',
  'Numerical data must reconcile to the audited financial statements; cite the F-page and line item for every metric.',
  'Materiality threshold: omit only what a reasonable investor would deem unimportant; when in doubt, disclose.',
  'No marketing puffery; balance every positive statement with the corresponding risk.',
  'Outputs must be in English. Currency in USD unless stated. Fiscal year alignment must be made explicit.',
];

const SEC_SECTIONS: SectionFormatSpec[] = [
  {
    section_code: 'cover',
    section_label: 'Prospectus Cover Page',
    section_label_zh: '招股说明书封面',
    statutory_anchor: 'Reg S-K Item 501 (17 CFR 229.501)',
    ordering: 1,
    required: true,
    min_word_count: 250,
    max_word_count: 800,
    required_elements: [
      'issuer_name: full legal name of the issuer',
      'security_offered: title and amount of securities being offered',
      'price_range: bona fide estimate of price range or formula (Item 501(b)(3))',
      'underwriter_names: names of the lead underwriters',
      'exchange_listing: proposed national securities exchange and ticker symbol',
      'risk_legend: cross-reference to Risk Factors with the page number',
      'sec_disclaimer: statement that SEC has not approved the securities (Item 501(b)(7))',
      'subject_to_completion: "Subject to Completion" legend if applicable (Rule 430A/430B)',
    ],
    mandatory_disclosures: [
      'Neither the Securities and Exchange Commission nor any state securities commission has approved or disapproved of these securities',
      'investing in our common stock involves a high degree of risk',
      'see "Risk Factors"',
    ],
    required_citations: [
      'Reg S-K Item 501(b)',
      'Securities Act Rule 421(d) (plain English)',
    ],
    output_schema: {
      required_subheadings: [
        '[Prospectus Cover Page]',
        'The Offering (capsule)',
        'Risk Factors Cross-Reference',
        'Required Legends',
      ],
      json_envelope: true,
      voice_guidance:
        'Third-person, plain English, neutral. Use "we" / "our Company" for the issuer. No marketing adjectives.',
    },
  },
  {
    section_code: 'summary',
    section_label: 'Prospectus Summary',
    section_label_zh: '招股说明书摘要',
    statutory_anchor: 'Reg S-K Item 503',
    ordering: 2,
    required: true,
    min_word_count: 1500,
    max_word_count: 6000,
    required_elements: [
      'overview: business overview and competitive strengths',
      'strategy: growth strategy in plain English',
      'risk_summary: a "Summary of Risk Factors" subsection cross-referencing the full Risk Factors',
      'corporate_info: corporate information (state of incorporation, principal executive office, website)',
      'offering_capsule: "The Offering" capsule (shares offered, post-offering shares, use of proceeds, dividend policy, lock-up, dual-class voting if any)',
      'summary_financials: summary historical and pro forma financial data',
      'emerging_growth_company: EGC status disclosure if applicable (JOBS Act §101)',
      'controlled_company: controlled-company status if applicable',
    ],
    mandatory_disclosures: [
      'this summary highlights information contained elsewhere in this prospectus and does not contain all of the information you should consider',
      'investing in our common stock involves a high degree of risk',
    ],
    required_citations: [
      'Reg S-K Item 503',
      'Reg S-K Item 105 (risk factors cross-reference)',
      'JOBS Act §101 (EGC) where applicable',
    ],
    output_schema: {
      required_subheadings: [
        'Overview',
        'Our Competitive Strengths',
        'Our Growth Strategy',
        'Summary of Risk Factors',
        'Corporate Information',
        'The Offering',
        'Summary Consolidated Financial Data',
      ],
      json_envelope: true,
      voice_guidance:
        'Plain English. Each paragraph ≤ 5 sentences. Active voice. Cross-reference page numbers as "[XX]" placeholders.',
    },
  },
  {
    section_code: 'risk_factors',
    section_label: 'Risk Factors',
    section_label_zh: '风险因素',
    statutory_anchor: 'Reg S-K Item 105 (17 CFR 229.105) and Item 503(c)',
    ordering: 3,
    required: true,
    min_word_count: 6000,
    max_word_count: 25000,
    required_elements: [
      'risk_categorization: risks grouped under descriptive headers (Risks Related to Our Business, Risks Related to Our Industry, Risks Related to Regulation, Risks Related to Our Common Stock and the Offering, Risks Related to Tax, Risks Related to Our Corporate Structure)',
      'specificity: each risk concrete to the issuer; no generic boilerplate',
      'magnitude_likelihood: each risk states why it is material and how it could harm financial condition / results / cash flows',
      'risk_factor_summary: bulletized "Summary of Risk Factors" preceding the full text where Reg S-K Item 105(c) trigger is met (>15 pages)',
      'forward_looking_caveat: each forward-looking statement flagged',
      'cybersecurity: cybersecurity risk factor where material',
      'going_concern: going-concern language if applicable',
      'controlled_company: controlled-company / dual-class risk if applicable',
      'vie_structure: VIE structural risks for China-based issuers (HFCAA, PCAOB inspection, CSRC approval)',
    ],
    mandatory_disclosures: [
      'investing in our common stock involves a high degree of risk',
      'you should carefully consider the risks and uncertainties described below',
      'the risks described below are not the only ones we face',
      'additional risks not currently known to us or that we currently deem immaterial may also adversely affect us',
    ],
    required_citations: [
      'Reg S-K Item 105',
      'Reg S-K Item 503(c)',
      'PSLRA forward-looking statement safe harbor',
      'HFCAA (for China-based issuers)',
    ],
    output_schema: {
      required_subheadings: [
        'Summary of Risk Factors',
        'Risks Related to Our Business and Industry',
        'Risks Related to Regulation and Litigation',
        'Risks Related to Our Common Stock and This Offering',
        'Risks Related to Our Corporate Structure',
        'General Risk Factors',
      ],
      json_envelope: true,
      voice_guidance:
        'Each risk factor: bold subheading stating the risk in one sentence, then 2-4 paragraphs of substantiation. No risk factor shorter than 75 words. No risk factor longer than 350 words.',
    },
  },
  {
    section_code: 'use_of_proceeds',
    section_label: 'Use of Proceeds',
    section_label_zh: '募集资金用途',
    statutory_anchor: 'Reg S-K Item 504 (17 CFR 229.504)',
    ordering: 4,
    required: true,
    min_word_count: 400,
    max_word_count: 2000,
    required_elements: [
      'estimated_net_proceeds: estimated net proceeds at midpoint, low and high end of the price range',
      'principal_purposes: principal purposes for which the net proceeds are intended',
      'allocation_table: tabular allocation by use, with $ amount and %',
      'priority_order: order of priority among uses if proceeds are insufficient',
      'discretion_of_management: statement that management has broad discretion over allocation',
      'temporary_investments: how proceeds will be invested pending application',
      'debt_repayment_terms: if any portion repays debt, the rate, maturity, and use-of-debt-proceeds',
      'related_party_payments: if any portion goes to insiders / affiliates, full disclosure',
    ],
    mandatory_disclosures: [
      'we intend to use the net proceeds',
      'we will have broad discretion in the application of the net proceeds',
      'pending the uses described above, we intend to invest the net proceeds in',
    ],
    required_citations: [
      'Reg S-K Item 504',
      'Reg S-K Item 506 (Dilution) cross-reference',
    ],
    output_schema: {
      required_subheadings: [
        'Use of Proceeds',
        'Allocation Table',
        'Pending Application of Proceeds',
      ],
      json_envelope: true,
      voice_guidance:
        'Plain English. State amounts numerically. If allocations are estimates, say so. Avoid vague language like "general corporate purposes" without quantification.',
    },
  },
  {
    section_code: 'mdna',
    section_label: "Management's Discussion and Analysis (MD&A)",
    section_label_zh: '管理层讨论与分析 (MD&A)',
    statutory_anchor: 'Reg S-K Item 303 (17 CFR 229.303)',
    ordering: 5,
    required: true,
    min_word_count: 5000,
    max_word_count: 25000,
    required_elements: [
      'overview: executive-level overview of the business and reporting period',
      'key_metrics: key performance indicators / non-GAAP measures with reconciliation to GAAP',
      'results_of_operations: line-by-line YoY analysis (revenue, cost of revenue, gross profit, operating expenses by category, operating income, interest, taxes, net income) — quantitative AND qualitative drivers',
      'segment_analysis: results by reportable segment if multiple',
      'liquidity_and_capital_resources: cash position, cash flows from operating/investing/financing, capital commitments, debt covenants',
      'critical_accounting_estimates: estimates that materially affect reported amounts (Item 303(b)(3))',
      'recent_accounting_pronouncements: ASUs adopted and pending',
      'off_balance_sheet_arrangements: per Item 303(b)(4)',
      'contractual_obligations: tabular contractual obligations table per Item 303(a)(5) (recommended even though no longer mandated)',
      'known_trends_and_uncertainties: forward-looking trends per Item 303(b)(2)(ii)',
      'inflation_supply_chain: macro factors (inflation, supply chain, FX) where material',
    ],
    mandatory_disclosures: [
      'the following discussion and analysis of our financial condition and results of operations should be read together with our consolidated financial statements',
      'critical accounting estimates',
      'this discussion contains forward-looking statements',
    ],
    required_citations: [
      'Reg S-K Item 303(a)',
      'Reg S-K Item 303(b)(2)(ii) (known trends)',
      'Reg S-K Item 303(b)(3) (critical estimates)',
      'Reg G (non-GAAP measures)',
      'Item 10(e) of Reg S-K (non-GAAP)',
    ],
    output_schema: {
      required_subheadings: [
        'Overview',
        'Key Performance Indicators',
        'Components of Results of Operations',
        'Results of Operations',
        'Liquidity and Capital Resources',
        'Cash Flows',
        'Critical Accounting Estimates',
        'Recent Accounting Pronouncements',
        'Quantitative and Qualitative Disclosures About Market Risk',
      ],
      json_envelope: true,
      voice_guidance:
        'Quantify every change ($ and %). Always pair the "what" with the "why". For non-GAAP, always show the GAAP reconciliation table. No marketing language.',
    },
  },
  {
    section_code: 'business',
    section_label: 'Business',
    section_label_zh: '业务',
    statutory_anchor: 'Reg S-K Item 101 (17 CFR 229.101)',
    ordering: 6,
    required: true,
    min_word_count: 5000,
    max_word_count: 30000,
    required_elements: [
      'general_development: general development of the business (Item 101(a))',
      'business_description: narrative description (products / services, markets, distribution, sources & availability of materials, dependence on customers, backlog, regulatory environment, R&D, employees, environmental compliance) (Item 101(c))',
      'human_capital: human capital resources disclosure (Item 101(c)(2)(ii))',
      'segments: financial information by reportable segment (Item 101(b))',
      'geographic_information: financial information by geographic area where material',
      'intellectual_property: patents, trademarks, licenses, franchises, concessions',
      'competition: competitive conditions',
      'government_regulation: material government regulations',
      'seasonality: seasonal aspects of the business',
      'environmental_disclosure: material effects of compliance with environmental laws',
      'legal_proceedings_xref: cross-reference to Legal Proceedings section',
    ],
    mandatory_disclosures: [
      'our human capital resources',
      'we are subject to various laws and regulations',
    ],
    required_citations: [
      'Reg S-K Item 101(a)',
      'Reg S-K Item 101(c)',
      'Reg S-K Item 101(c)(2)(ii) (human capital)',
    ],
    output_schema: {
      required_subheadings: [
        'Overview',
        'Our Industry and Market Opportunity',
        'Our Products and Services',
        'Our Customers',
        'Sales and Marketing',
        'Research and Development',
        'Competition',
        'Intellectual Property',
        'Government Regulation',
        'Human Capital Resources',
        'Properties',
        'Legal Proceedings',
      ],
      json_envelope: true,
      voice_guidance:
        'Factual third-person. Quantify market size with cited third-party sources. Disclose customer concentration if any 10%+ customers exist.',
    },
  },
  {
    section_code: 'management',
    section_label: 'Management — Directors and Executive Officers',
    section_label_zh: '管理层 — 董事与高管',
    statutory_anchor: 'Reg S-K Items 401 and 402',
    ordering: 7,
    required: true,
    min_word_count: 3000,
    max_word_count: 20000,
    required_elements: [
      'biographical_info: name, age, position, business experience for past 5 years for each director / executive officer (Item 401)',
      'family_relationships: family relationships among directors / executive officers',
      'legal_proceedings_directors: legal proceedings involving directors / officers per Item 401(f)',
      'committees: audit / compensation / nominating committee composition and independence',
      'corporate_governance: code of business conduct & ethics, independent director majority, board leadership structure',
      'compensation_discussion: CD&A or smaller-reporting-company scaled disclosure (Item 402)',
      'summary_compensation_table: required tables per Item 402(c) (or scaled equivalent)',
      'equity_awards: outstanding equity awards table',
      'pay_versus_performance: Item 402(v) where applicable',
      'director_compensation: Item 402(k)',
    ],
    mandatory_disclosures: [
      'the following table sets forth information regarding our directors and executive officers',
      'no family relationships',
      'our board has determined that',
    ],
    required_citations: [
      'Reg S-K Item 401',
      'Reg S-K Item 402',
      'Exchange listing standards on independence (Nasdaq Rule 5605 / NYSE 303A)',
    ],
    output_schema: {
      required_subheadings: [
        'Directors and Executive Officers',
        'Family Relationships',
        'Corporate Governance',
        'Board Committees',
        'Compensation Discussion and Analysis',
        'Summary Compensation Table',
        'Outstanding Equity Awards',
        'Director Compensation',
      ],
      json_envelope: true,
      voice_guidance: 'Use formal third-person. Tabular data must include all required columns.',
    },
  },
  {
    section_code: 'related_party',
    section_label: 'Certain Relationships and Related Party Transactions',
    section_label_zh: '关联方关系与交易',
    statutory_anchor: 'Reg S-K Item 404 (17 CFR 229.404)',
    ordering: 8,
    required: true,
    min_word_count: 800,
    max_word_count: 6000,
    required_elements: [
      'transactions_over_threshold: each transaction since the beginning of the registrant\'s last two fiscal years where the amount exceeds $120,000 and a related person had a material interest (Item 404(a))',
      'related_persons: name of related person, nature of relationship, transaction terms, amount',
      'review_policies: policies and procedures for review and approval of related-party transactions (Item 404(b))',
      'indemnification_agreements: indemnification arrangements with directors / officers',
      'registration_rights: registration rights agreements',
      'voting_agreements: any stockholder voting / lock-up agreements',
      'investor_rights_agreements: investor rights agreement summary',
    ],
    mandatory_disclosures: [
      'related person',
      'our board of directors has adopted a written policy',
      'each of the transactions described in this section was reviewed and approved',
    ],
    required_citations: [
      'Reg S-K Item 404(a)',
      'Reg S-K Item 404(b)',
    ],
    output_schema: {
      required_subheadings: [
        'Policies and Procedures for Related Person Transactions',
        'Related Person Transactions',
        'Indemnification Agreements',
        'Registration Rights',
      ],
      json_envelope: true,
      voice_guidance: 'Tabulate quantitative terms. Identify each related person by name and relationship.',
    },
  },
  {
    section_code: 'principal_holders',
    section_label: 'Principal and Selling Stockholders',
    section_label_zh: '主要及出售股东',
    statutory_anchor: 'Reg S-K Item 403',
    ordering: 9,
    required: true,
    min_word_count: 600,
    max_word_count: 4000,
    required_elements: [
      'beneficial_ownership_table: beneficial ownership table covering 5%+ holders, each director, each NEO, and all directors & officers as a group',
      'pre_post_offering: shares beneficially owned before and after the offering, in number and percentage',
      'selling_stockholders: name, shares offered, shares owned after offering for each selling stockholder',
      'voting_power: voting power vs economic ownership where dual-class',
      'footnotes: detailed footnotes explaining attribution rules (5% holder fund families, trusts, options exercisable within 60 days)',
    ],
    mandatory_disclosures: [
      'beneficial ownership is determined in accordance with the rules of the SEC',
      'shares of common stock subject to options or warrants currently exercisable, or exercisable within 60 days',
    ],
    required_citations: [
      'Reg S-K Item 403',
      'Rule 13d-3 (beneficial ownership)',
    ],
    output_schema: {
      required_subheadings: [
        'Security Ownership of Certain Beneficial Owners and Management',
        'Selling Stockholders',
      ],
      json_envelope: true,
      voice_guidance: 'Tabular. Show pre-offering, post-offering (no over-allotment), and post-offering (with over-allotment) columns.',
    },
  },
  {
    section_code: 'financials',
    section_label: 'Financial Statements and Supplementary Data',
    section_label_zh: '财务报表与补充数据',
    statutory_anchor: 'Reg S-X (17 CFR 210); Reg S-K Item 8 / Item 302',
    ordering: 10,
    required: true,
    min_word_count: 1500,
    max_word_count: 8000,
    required_elements: [
      'auditor_report: auditor\'s report from a PCAOB-registered firm covering all required periods',
      'balance_sheets: audited balance sheets for the two most recent fiscal year-ends (Reg S-X 3-01)',
      'statements_of_operations: audited statements of operations for the three most recent fiscal years (Reg S-X 3-02) — two for EGC / SRC',
      'statements_of_stockholders_equity: per Reg S-X 3-04',
      'statements_of_cash_flows: per Reg S-X 3-02',
      'notes: complete notes including significant accounting policies, segment disclosures, revenue recognition (ASC 606), leases (ASC 842), income taxes (ASC 740), EPS, share-based compensation (ASC 718), commitments & contingencies, subsequent events',
      'interim_statements: unaudited interim statements per Article 10 if filing more than 134 days after fiscal year-end',
      'pro_forma: pro forma financial information per Article 11 if material business combination',
      'selected_quarterly: quarterly financial data per Item 302 where required',
      'audit_committee_report: presence and content of audit committee report',
    ],
    mandatory_disclosures: [
      'consolidated financial statements',
      'in accordance with U.S. generally accepted accounting principles',
      'report of independent registered public accounting firm',
    ],
    required_citations: [
      'Reg S-X Article 3',
      'Reg S-X Article 10 (interim)',
      'Reg S-X Article 11 (pro forma)',
      'PCAOB AS 3101 (auditor\'s report)',
      'ASC 606, ASC 842, ASC 740, ASC 718',
    ],
    output_schema: {
      required_subheadings: [
        'Index to Consolidated Financial Statements',
        'Report of Independent Registered Public Accounting Firm',
        'Consolidated Balance Sheets',
        'Consolidated Statements of Operations',
        'Consolidated Statements of Stockholders\' Equity',
        'Consolidated Statements of Cash Flows',
        'Notes to Consolidated Financial Statements',
      ],
      json_envelope: true,
      voice_guidance: 'Numerical accuracy is paramount. Every figure tied back to the underlying ledger; no rounding errors > $1k.',
    },
  },
];

function build_sec_standard(market: TargetMarket, label: string, label_zh: string): JurisdictionFormatStandard {
  const sections_record: Record<string, SectionFormatSpec> = {};
  for (const s of SEC_SECTIONS) sections_record[s.section_code] = s;
  return {
    target_market: market,
    document_type: 'Form S-1 (US Domestic) / Form F-1 (Foreign Private Issuer)',
    locale_label: label,
    locale_label_zh: label_zh,
    global_requirements: SEC_GLOBAL_REQUIREMENTS,
    sections: sections_record,
  };
}

// ---------------------------------------------------------------------------
// HKEX Main Board standard (App.1A) — Listing Document / A1 Application Proof
// ---------------------------------------------------------------------------

const HKEX_MAIN_GLOBAL_REQUIREMENTS = [
  'Document must comply with HKEX Main Board Listing Rules and Companies (Winding Up and Miscellaneous Provisions) Ordinance Part XII Third Schedule.',
  'Bilingual filing: English and Traditional Chinese must be substantively identical; the agent should label which language version is being drafted.',
  'Dual-listing / WVR / weighted-voting-rights / dual-class shareholding (Ch.8A) — additional disclosure required when applicable.',
  'Sponsor due diligence is mandatory; every factual statement should be verifiable to a sponsor work paper reference.',
  'Currency: HKD unless otherwise stated; functional currency reconciliations required.',
  'Material differences from US GAAP if HKFRS / IFRS used must be highlighted (Ch.4.11).',
  'Forward-looking projections only with profit forecast assurance per Rule 11.16-11.20.',
];

const HKEX_MAIN_SECTIONS: SectionFormatSpec[] = [
  {
    section_code: 'summary',
    section_label: 'Summary and Highlights',
    section_label_zh: '概要及亮點',
    statutory_anchor: 'HKEX Main Board App.1A.6 / GL86-16',
    ordering: 1,
    required: true,
    min_word_count: 2000,
    max_word_count: 8000,
    required_elements: [
      'business_overview: succinct overview of business, products, services, mission',
      'competitive_strengths: competitive strengths grounded in industry data',
      'business_strategies: forward strategies (without making profit forecasts unless 11.16 compliant)',
      'industry_overview_summary: industry overview summary citing the independent industry consultant report',
      'risk_factors_summary: top risk factors summary cross-referenced to Risk Factors',
      'controlling_shareholders: identity of controlling shareholders and post-listing ownership',
      'corporate_history: brief corporate history and pre-IPO restructuring',
      'use_of_proceeds_summary: summary of use of proceeds with allocation',
      'dividend_policy: dividend policy stated',
      'offer_statistics: offer statistics (offer size, indicative price range, market cap range)',
      'financial_highlights: financial highlights covering the track-record period',
      'recent_developments: post-track-record developments',
      'no_material_adverse_change: NMAC statement',
    ],
    mandatory_disclosures: [
      'this summary aims to give you an overview of the information contained in this document',
      'as it is a summary, it does not contain all the information that may be important to you',
      'you should read the whole document before you decide to invest',
      'there are risks associated with any investment',
    ],
    required_citations: [
      'HKEX App.1A.6',
      'HKEX GL86-16 (Summary section guidance)',
      'Independent industry consultant report (CIC / Frost & Sullivan / similar)',
    ],
    output_schema: {
      required_subheadings: [
        'Overview',
        'Our Competitive Strengths',
        'Our Business Strategies',
        'Industry Overview',
        'Summary of Risk Factors',
        'Our Controlling Shareholders',
        'Our Corporate History and Reorganization',
        'Use of Proceeds',
        'Dividend Policy',
        'Offer Statistics',
        'Summary Historical Financial Information',
        'Recent Developments',
        'No Material Adverse Change',
      ],
      json_envelope: true,
      voice_guidance:
        'Formal. Avoid superlatives unless backed by independent industry consultant data. Tabulate financial highlights.',
    },
  },
  {
    section_code: 'risk_factors',
    section_label: 'Risk Factors',
    section_label_zh: '風險因素',
    statutory_anchor: 'HKEX Main Board App.1A.40 / GL16-19',
    ordering: 2,
    required: true,
    min_word_count: 6000,
    max_word_count: 25000,
    required_elements: [
      'risk_categorization: organized as Risks Relating to Our Business, Risks Relating to Our Industry, Risks Relating to Conducting Operations in [Jurisdiction], Risks Relating to the Offer Shares',
      'specificity: each risk specific to issuer, not generic',
      'pre_ipo_reorganization_risks: risks related to pre-IPO restructuring, especially VIE / contractual arrangements',
      'cornerstone_lockup: cornerstone investor lock-up risk where applicable',
      'wvr_risks: WVR / weighted voting rights risks where applicable (Ch.8A)',
      'sanctions_risks: sanctions / export-control risks where the issuer operates in sensitive jurisdictions',
      'pdpo_data_risks: data security / cybersecurity / PRC PIPL / cross-border data transfer risks for PRC issuers',
      'csrc_filing_risk: CSRC overseas listing filing requirement risk for PRC issuers (effective March 2023)',
    ],
    mandatory_disclosures: [
      'an investment in the [Offer] Shares involves various risks',
      'you should carefully consider all the information set out in this document and, in particular, should consider the following risks',
      'additional risks not presently known to us, or that we currently consider immaterial, may also impair our business',
    ],
    required_citations: [
      'HKEX App.1A.40',
      'HKEX GL16-19 (Risk Factors guidance)',
      'For PRC issuers: CSRC Overseas Listing Trial Measures (2023)',
    ],
    output_schema: {
      required_subheadings: [
        'Risks Relating to Our Business',
        'Risks Relating to Our Industry',
        'Risks Relating to Conducting Operations in [Jurisdiction]',
        'Risks Relating to the [Global] Offering',
      ],
      json_envelope: true,
      voice_guidance:
        'Each risk: bold heading stating the risk, then 2-4 paragraphs of substantiation. No risk shorter than 80 words.',
    },
  },
  {
    section_code: 'business',
    section_label: 'Business',
    section_label_zh: '業務',
    statutory_anchor: 'HKEX Main Board App.1A.28',
    ordering: 3,
    required: true,
    min_word_count: 6000,
    max_word_count: 35000,
    required_elements: [
      'overview: business overview',
      'competitive_strengths: competitive strengths',
      'business_strategies: business strategies',
      'business_model: business model and revenue model',
      'products_services: products and services described in detail',
      'customers: customers (top 5 / top 10) with concentration analysis',
      'suppliers: suppliers (top 5 / top 10) with concentration analysis',
      'sales_marketing: sales and marketing',
      'pricing: pricing policy',
      'production: production / operations / supply chain',
      'quality_control: quality control',
      'inventory: inventory management',
      'awards_recognition: awards and recognition',
      'employees: employees / human resources',
      'properties: properties (owned and leased)',
      'intellectual_property: intellectual property',
      'health_safety_environmental: H&S / environmental compliance — required by App.1A.28(1)(d) and Ch.27 ESG',
      'licensing_permits: licensing and regulatory permits required to operate, with status of each',
      'legal_compliance: legal compliance and proceedings',
      'risk_management: risk management and internal control',
      'insurance: insurance coverage',
    ],
    mandatory_disclosures: [
      'we have obtained all material licenses, permits, certificates and approvals required for our business operations',
      'during the track record period, we did not have any material non-compliance',
      'our internal control measures',
    ],
    required_citations: [
      'HKEX App.1A.28',
      'HKEX Ch.27 (ESG)',
      'Industry consultant report citations for every market data point',
      'Local-jurisdiction legal opinions (e.g. PRC legal opinion) for licensing claims',
    ],
    output_schema: {
      required_subheadings: [
        'Overview',
        'Competitive Strengths',
        'Business Strategies',
        'Business Model',
        'Our Products / Services',
        'Customers',
        'Suppliers',
        'Sales and Marketing',
        'Production and Operations',
        'Quality Control',
        'Awards and Recognition',
        'Employees',
        'Properties',
        'Intellectual Property',
        'Health, Safety and Environmental Matters',
        'Licensing and Regulatory Compliance',
        'Legal Proceedings and Compliance',
        'Risk Management and Internal Control',
        'Insurance',
      ],
      json_envelope: true,
      voice_guidance:
        'Formal. Cite the industry consultant report for every market-share / size / growth claim. Quantify customer / supplier concentration.',
    },
  },
  {
    section_code: 'industry',
    section_label: 'Industry Overview',
    section_label_zh: '行業概覽',
    statutory_anchor: 'HKEX Main Board App.1A.31 / GL103-19',
    ordering: 4,
    required: true,
    min_word_count: 4000,
    max_word_count: 18000,
    required_elements: [
      'consultant_engagement: identity of independent industry consultant, fee, basis of independence (per GL103-19)',
      'methodology: data sources and methodology',
      'industry_size_growth: industry size, historical CAGR, forecast CAGR',
      'value_chain: value chain analysis',
      'competitive_landscape: competitive landscape with named competitors and ranking',
      'market_share: issuer\'s market share / ranking',
      'drivers_trends: industry drivers and trends',
      'entry_barriers: entry barriers',
      'regulatory_environment: regulatory environment',
      'covid_macro: COVID-19 / macroeconomic impact where material',
    ],
    mandatory_disclosures: [
      'the information presented in this section is derived from a report commissioned by us',
      'the consultant has confirmed that it is independent of and not connected with us',
    ],
    required_citations: [
      'HKEX App.1A.31',
      'HKEX GL103-19 (industry consultant)',
      'Independent industry consultant report (every figure must be cited)',
    ],
    output_schema: {
      required_subheadings: [
        'Source of Information',
        'Overview of the [Industry] Market',
        'Market Size and Growth',
        'Competitive Landscape',
        'Industry Drivers and Trends',
        'Entry Barriers',
        'Regulatory Environment',
      ],
      json_envelope: true,
      voice_guidance: 'Every quantitative claim cited to the consultant report. Tabular market-size and growth data.',
    },
  },
  {
    section_code: 'connected',
    section_label: 'Connected Transactions',
    section_label_zh: '關連交易',
    statutory_anchor: 'HKEX Main Board Ch.14A',
    ordering: 5,
    required: true,
    min_word_count: 1200,
    max_word_count: 8000,
    required_elements: [
      'connected_persons_identification: identification of connected persons (controllers, directors, supervisors, senior management, their associates)',
      'transaction_summary: summary of each connected transaction',
      'historical_amounts: historical transaction amounts during track record period',
      'annual_caps: proposed annual caps for the next 3 years',
      'pricing_basis: pricing policy / arm\'s length basis',
      'reasons_benefits: reasons for and benefits of each transaction',
      'continuing_vs_one_off: classification as continuing connected transaction (CCT) or one-off',
      'waivers_sought: waivers sought from independent shareholders\' approval / annual caps',
      'directors_view: directors\' confirmation that transactions are on normal commercial terms',
      'sponsor_view: sponsor\'s view on fairness',
    ],
    mandatory_disclosures: [
      'in the ordinary and usual course of business of our group',
      'on normal commercial terms or better',
      'fair and reasonable and in the interests of the company and its shareholders as a whole',
    ],
    required_citations: [
      'HKEX Ch.14A',
      'HKEX Practice Note on Ch.14A',
    ],
    output_schema: {
      required_subheadings: [
        'Identification of Connected Persons',
        'Continuing Connected Transactions',
        'One-off Connected Transactions',
        'Annual Caps',
        'Pricing Policy',
        'Reasons and Benefits',
        'Directors\' View',
        'Sponsor\'s View',
        'Waivers Sought',
      ],
      json_envelope: true,
      voice_guidance: 'Tabulate amounts. Each transaction needs pricing basis, classification, and waiver status.',
    },
  },
  {
    section_code: 'mdna',
    section_label: 'Financial Information (MD&A equivalent)',
    section_label_zh: '財務資料 (管理層討論與分析)',
    statutory_anchor: 'HKEX Main Board App.1A.32-33',
    ordering: 6,
    required: true,
    min_word_count: 6000,
    max_word_count: 25000,
    required_elements: [
      'overview: financial overview',
      'basis_of_presentation: basis of presentation, accounting standards (HKFRS / IFRS)',
      'critical_accounting_policies: critical accounting policies and judgments',
      'principal_pl_components: principal income statement components with definitions',
      'results_of_operations: line-by-line YoY analysis with quantitative + qualitative drivers',
      'liquidity_capital_resources: liquidity and capital resources',
      'working_capital_sufficiency: working capital sufficiency statement (App.1A.36) — at least 12 months',
      'indebtedness: indebtedness statement (App.1A.32(2)(d))',
      'capital_commitments: capital commitments and contingent liabilities',
      'off_balance_sheet: off-balance-sheet arrangements',
      'distributable_reserves: distributable reserves (Ch.13.05)',
      'no_material_adverse_change: NMAC statement (App.1A.38)',
      'profit_forecast: profit forecast and assumptions if any (Ch.11.16-11.20)',
      'dividend_policy: dividend policy with historical payout',
    ],
    mandatory_disclosures: [
      'our directors confirm that, taking into account the financial resources available to our group',
      'we have sufficient working capital for our present requirements, that is for at least the next 12 months',
      'no material adverse change',
    ],
    required_citations: [
      'HKEX App.1A.32-33',
      'HKEX App.1A.36 (working capital sufficiency)',
      'HKEX App.1A.38 (NMAC)',
      'HKEX Ch.11.16-11.20 (profit forecast)',
    ],
    output_schema: {
      required_subheadings: [
        'Overview',
        'Basis of Presentation',
        'Critical Accounting Policies and Estimates',
        'Components of Our Results of Operations',
        'Results of Operations',
        'Liquidity and Capital Resources',
        'Working Capital',
        'Indebtedness',
        'Capital Commitments and Contingent Liabilities',
        'Distributable Reserves',
        'No Material Adverse Change',
        'Dividend Policy',
      ],
      json_envelope: true,
      voice_guidance: 'Quantify every change. Always pair the "what" with the "why". Tabulate financial line items.',
    },
  },
  {
    section_code: 'directors',
    section_label: 'Directors and Senior Management',
    section_label_zh: '董事及高級管理人員',
    statutory_anchor: 'HKEX Main Board App.1A.41 / Ch.3.08-3.09',
    ordering: 7,
    required: true,
    min_word_count: 3000,
    max_word_count: 18000,
    required_elements: [
      'biographical_info: full biographical information for each director and senior manager',
      'qualifications: qualifications, experience, and other directorships in past 3 years',
      'independence: independence assessment for INEDs (Rule 3.13)',
      'committees: composition of audit / remuneration / nomination committees',
      'company_secretary: company secretary disclosure (Rule 3.28)',
      'authorized_representatives: authorized representatives (Rule 3.05)',
      'compliance_advisers: compliance advisers (Rule 3A.19)',
      'corporate_governance: compliance with Corporate Governance Code (App.14)',
      'remuneration: remuneration policy and historical compensation',
      'service_contracts: directors\' service contracts',
      'directors_interests: directors\' interests in shares / debentures of the issuer',
      'competing_interests: directors\' competing interests / non-competition undertakings',
    ],
    mandatory_disclosures: [
      'each of our independent non-executive directors has confirmed his/her independence',
      'we have appointed [name] as our compliance adviser',
      'we have complied with the Corporate Governance Code',
    ],
    required_citations: [
      'HKEX App.1A.41',
      'HKEX Ch.3 (Sponsors, Compliance Advisers, INEDs)',
      'HKEX App.14 (Corporate Governance Code)',
    ],
    output_schema: {
      required_subheadings: [
        'Directors',
        'Senior Management',
        'Company Secretary',
        'Compliance Adviser',
        'Board Committees',
        'Corporate Governance',
        'Remuneration',
        'Directors\' Interests',
        'Non-Competition Undertakings',
      ],
      json_envelope: true,
      voice_guidance: 'Formal. Cite Rule references. Use full names and titles.',
    },
  },
  {
    section_code: 'use_of_proceeds',
    section_label: 'Future Plans and Use of Proceeds',
    section_label_zh: '未來計劃及所得款項用途',
    statutory_anchor: 'HKEX Main Board App.1A.48',
    ordering: 8,
    required: true,
    min_word_count: 800,
    max_word_count: 5000,
    required_elements: [
      'future_plans: implementation plan for the next 36 months tied to use of proceeds',
      'estimated_net_proceeds: estimated net proceeds at low / mid / high indicative price',
      'allocation: allocation of net proceeds across uses (with %)',
      'specific_milestones: specific milestones to be achieved with each use',
      'pending_application: pending application of proceeds (deposits / treasury investments)',
      'over_allotment_proceeds: how additional proceeds from over-allotment will be used',
      'shortfall_handling: how shortfalls (under low end of indicative price) will be addressed',
    ],
    mandatory_disclosures: [
      'we intend to apply our future plans and the net proceeds from the [global offering]',
      'to the extent that the net proceeds are not immediately used',
    ],
    required_citations: [
      'HKEX App.1A.48',
      'HKEX GL95-18 (use of proceeds)',
    ],
    output_schema: {
      required_subheadings: [
        'Future Plans',
        'Use of Proceeds',
        'Allocation of Net Proceeds',
        'Pending Application',
      ],
      json_envelope: true,
      voice_guidance: 'Quantify each use with both $ amount and %. Tie to a measurable milestone where possible.',
    },
  },
  {
    section_code: 'esg',
    section_label: 'Environmental, Social and Governance Matters',
    section_label_zh: '環境、社會及管治',
    statutory_anchor: 'HKEX Main Board App.27 (ESG Reporting Guide); Ch.13.91',
    ordering: 9,
    required: true,
    min_word_count: 1500,
    max_word_count: 10000,
    required_elements: [
      'esg_governance: ESG governance structure (board oversight, management responsibility)',
      'environmental_kpis: KPIs A1.1-A4.1 (emissions, resources, environment & natural resources, climate change)',
      'social_kpis: KPIs B1.1-B8.2 (employment, health & safety, development, labor standards, supply chain, product responsibility, anti-corruption, community)',
      'climate_disclosure: climate-related disclosures (TCFD aligned per Ch.13.91A from Jan 2025)',
      'reporting_principles: materiality, quantitative, balance, consistency',
      'reporting_boundary: reporting boundary explanation',
      'comply_or_explain: comply-or-explain provisions explicitly addressed',
    ],
    mandatory_disclosures: [
      'a statement from the board containing the following elements: a disclosure of the board\'s oversight of ESG issues',
      'the board\'s ESG management approach and strategy',
      'how the board reviews progress made against ESG-related goals',
    ],
    required_citations: [
      'HKEX App.27 (ESG Reporting Guide)',
      'HKEX Ch.13.91',
      'TCFD recommendations (where Ch.13.91A applies)',
    ],
    output_schema: {
      required_subheadings: [
        'ESG Governance',
        'Reporting Principles and Boundary',
        'Environmental Aspects (A1-A4)',
        'Social Aspects (B1-B8)',
        'Climate-Related Disclosures',
      ],
      json_envelope: true,
      voice_guidance: 'Quantitative wherever possible (emissions data, energy consumption, employee diversity). Reference each KPI by its App.27 code.',
    },
  },
  {
    section_code: 'accountants_report',
    section_label: 'Accountants\' Report',
    section_label_zh: '會計師報告',
    statutory_anchor: 'HKEX Main Board Ch.4 / App.1A.43',
    ordering: 10,
    required: true,
    min_word_count: 2000,
    max_word_count: 10000,
    required_elements: [
      'reporting_accountants: identity and PCAOB / HKICPA registration of reporting accountants',
      'track_record_period: track record period of 3 financial years (or 2 for biotech under Ch.18A; 2 for specialist tech under Ch.18C)',
      'opinion: reporting accountants\' opinion (HKSA 700)',
      'historical_financial_information: balance sheets, income statements, cash flows, equity for the track record period',
      'notes: significant accounting policies, segment reporting, revenue recognition (HKFRS 15), leases (HKFRS 16), financial instruments (HKFRS 9), income taxes',
      'pro_forma_financial_information: pro forma financial information per Ch.4.29 if applicable',
      'profit_forecast_assurance: profit forecast assurance per Ch.4.34 if any forecast made',
      'adjustments: any adjustments and reconciliations',
    ],
    mandatory_disclosures: [
      'in our opinion, the historical financial information gives a true and fair view',
      'in accordance with hong kong financial reporting standards',
      'reporting accountants',
    ],
    required_citations: [
      'HKEX Ch.4 / App.1A.43',
      'HKSA 700 (auditor\'s opinion)',
      'HKFRS 15, HKFRS 16, HKFRS 9',
    ],
    output_schema: {
      required_subheadings: [
        'Report on the Historical Financial Information',
        'Historical Financial Information',
        'Notes to the Historical Financial Information',
        'Pro Forma Financial Information',
      ],
      json_envelope: true,
      voice_guidance: 'Numerical accuracy paramount. Use HKD as functional currency unless issuer states otherwise. Reconcile to functional currency.',
    },
  },
];

function build_hkex_main_standard(): JurisdictionFormatStandard {
  const sections_record: Record<string, SectionFormatSpec> = {};
  for (const s of HKEX_MAIN_SECTIONS) sections_record[s.section_code] = s;
  return {
    target_market: 'HKEX_MAIN',
    document_type: 'A1 Application Proof / Listing Document (HKEX Main Board)',
    locale_label: 'HKEX Main Board — Listing Document (App.1A)',
    locale_label_zh: '香港聯交所主板 — 上市文件 (App.1A)',
    global_requirements: HKEX_MAIN_GLOBAL_REQUIREMENTS,
    sections: sections_record,
  };
}

// HKEX GEM — same canonical sections but reduced track record (2 years), App.1B anchors.
function build_hkex_gem_standard(): JurisdictionFormatStandard {
  const sections_record: Record<string, SectionFormatSpec> = {};
  for (const base of HKEX_MAIN_SECTIONS) {
    // Map App.1A → App.1B and reduce track record where applicable
    const cloned: SectionFormatSpec = {
      ...base,
      statutory_anchor: base.statutory_anchor.replace(/App\.1A/g, 'App.1B').replace('Main Board', 'GEM'),
    };
    if (cloned.section_code === 'accountants_report') {
      cloned.required_elements = cloned.required_elements.map(e =>
        e.startsWith('track_record_period')
          ? 'track_record_period: track record period of 2 financial years (GEM Ch.11.10)'
          : e,
      );
    }
    sections_record[cloned.section_code] = cloned;
  }
  return {
    target_market: 'HKEX_GEM',
    document_type: 'GEM Listing Document (HKEX GEM)',
    locale_label: 'HKEX GEM — Listing Document (App.1B)',
    locale_label_zh: '香港聯交所 GEM — 上市文件 (App.1B)',
    global_requirements: [
      ...HKEX_MAIN_GLOBAL_REQUIREMENTS,
      'GEM is a market for SMEs with a higher risk profile; the entire document must reinforce that the issuer\'s business is at an earlier stage.',
      'Track record: 2 financial years (vs 3 for Main Board).',
    ],
    sections: sections_record,
  };
}

// ---------------------------------------------------------------------------
// Master registry — covers all 7 TargetMarkets
// ---------------------------------------------------------------------------

export const PFS_REGISTRY: Record<TargetMarket, JurisdictionFormatStandard> = {
  SEC_NASDAQ_GS: build_sec_standard(
    'SEC_NASDAQ_GS',
    'SEC — Form S-1 / F-1 (Nasdaq Global Select Market)',
    '美國 SEC — Form S-1 / F-1 (納斯達克全球精選市場)',
  ),
  SEC_NASDAQ_GM: build_sec_standard(
    'SEC_NASDAQ_GM',
    'SEC — Form S-1 / F-1 (Nasdaq Global Market)',
    '美國 SEC — Form S-1 / F-1 (納斯達克全球市場)',
  ),
  SEC_NASDAQ_CM: build_sec_standard(
    'SEC_NASDAQ_CM',
    'SEC — Form S-1 / F-1 (Nasdaq Capital Market)',
    '美國 SEC — Form S-1 / F-1 (納斯達克資本市場)',
  ),
  SEC_NYSE: build_sec_standard(
    'SEC_NYSE',
    'SEC — Form S-1 / F-1 (NYSE)',
    '美國 SEC — Form S-1 / F-1 (紐約證券交易所)',
  ),
  SEC_NYSE_AMERICAN: build_sec_standard(
    'SEC_NYSE_AMERICAN',
    'SEC — Form S-1 / F-1 (NYSE American)',
    '美國 SEC — Form S-1 / F-1 (NYSE American)',
  ),
  HKEX_MAIN: build_hkex_main_standard(),
  HKEX_GEM:  build_hkex_gem_standard(),
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Get the full jurisdiction standard for a market. */
export function get_jurisdiction_standard(target_market: TargetMarket): JurisdictionFormatStandard {
  return PFS_REGISTRY[target_market];
}

/**
 * Get the section spec for a given (target_market, section_code) pair.
 * Returns null if the section does not exist for that jurisdiction (in which
 * case the caller should fall back to a generic prompt).
 */
export function get_section_spec(
  target_market: TargetMarket,
  section_code: string,
): SectionFormatSpec | null {
  const std = PFS_REGISTRY[target_market];
  if (!std) return null;
  return std.sections[section_code] ?? null;
}

/** Enumerate all section codes available for a market in canonical order. */
export function list_section_codes(target_market: TargetMarket): string[] {
  const std = PFS_REGISTRY[target_market];
  if (!std) return [];
  return Object.values(std.sections)
    .sort((a, b) => a.ordering - b.ordering)
    .map(s => s.section_code);
}

// ---------------------------------------------------------------------------
// Prompt rendering — turns a SectionFormatSpec into an enforceable
// "Format Standard (binding)" block that gets injected into the agent's
// system prompt by agent_runner.build_system_prompt().
// ---------------------------------------------------------------------------

/**
 * Render the binding format block in the requested locale. Used by
 * agent_runner; also exported for test inspection.
 */
export function render_format_block(
  std: JurisdictionFormatStandard,
  spec: SectionFormatSpec,
  locale: 'en' | 'zh',
): string {
  if (locale === 'zh') {
    const lines: string[] = [];
    lines.push(`## 格式标准（强制约束 / Format Standard — binding）`);
    lines.push(`本节产出必须严格符合下列法规格式要求。任何缺失要素都会被合规校验器（PFS Linter）记录为 \`gaps[]\` 并阻止定稿。`);
    lines.push('');
    lines.push(`**上市地 / 文件类型：** ${std.locale_label_zh}（${std.document_type}）`);
    lines.push(`**目标市场代码：** ${std.target_market}`);
    lines.push(`**章节：** ${spec.section_label_zh} (\`${spec.section_code}\`，文档顺序 ${spec.ordering})`);
    lines.push(`**法规依据：** ${spec.statutory_anchor}`);
    if (spec.min_word_count || spec.max_word_count) {
      const lo = spec.min_word_count ? `下限 ${spec.min_word_count}` : '';
      const hi = spec.max_word_count ? `上限 ${spec.max_word_count}` : '';
      lines.push(`**字数要求：** ${[lo, hi].filter(Boolean).join(' · ')} 字（英文按 word，中文按字）`);
    }
    lines.push('');
    lines.push(`### 跨节通用规则（必须遵守）`);
    for (const g of std.global_requirements) lines.push(`- ${g}`);
    lines.push('');
    lines.push(`### 必备子节标题（按此顺序输出）`);
    for (const h of spec.output_schema.required_subheadings) lines.push(`- ${h}`);
    lines.push('');
    lines.push(`### 必备要素（每条都必须在正文中实际覆盖）`);
    for (const el of spec.required_elements) lines.push(`- ${el}`);
    lines.push('');
    lines.push(`### 强制披露语句（须出现，可改写但语义须保留）`);
    for (const d of spec.mandatory_disclosures) lines.push(`- "${d}"`);
    lines.push('');
    lines.push(`### 引用要求`);
    for (const c of spec.required_citations) lines.push(`- ${c}`);
    lines.push('');
    lines.push(`### 语言与口吻`);
    lines.push(`- ${spec.output_schema.voice_guidance}`);
    lines.push('');
    lines.push(`### 输出协议（必须严格遵守）`);
    lines.push(`先以**结构化 Markdown** 输出整篇章节正文（按必备子节标题分节），随后**必须**附加一段 \`\`\`json 代码块，内容为：`);
    lines.push('```json');
    lines.push(`{`);
    lines.push(`  "meta": {`);
    lines.push(`    "target_market": "${std.target_market}",`);
    lines.push(`    "section_code": "${spec.section_code}",`);
    lines.push(`    "statutory_anchor": "${spec.statutory_anchor}",`);
    lines.push(`    "locale": "zh",`);
    lines.push(`    "word_count": <实际字数>`);
    lines.push(`  },`);
    lines.push(`  "sections": [`);
    lines.push(`    { "heading": "<子节标题>", "body": "<该子节的 Markdown 正文>", "citations": ["<法规/数据源>"] }`);
    lines.push(`  ],`);
    lines.push(`  "compliance_checklist": [`);
    lines.push(`    { "id": "<必备要素 code>", "label": "<人类可读说明>", "covered": true|false, "evidence": "<在正文中体现的句子>" }`);
    lines.push(`  ],`);
    lines.push(`  "gaps": [ "<未能覆盖的必备要素 / 强制披露 / 引用，附原因>" ]`);
    lines.push(`}`);
    lines.push('```');
    lines.push(`如有缺数据导致无法满足某要素，禁止编造数字；改为在 \`gaps\` 中清楚说明缺什么、应由谁提供（保荐人 / 审计师 / 公司管理层 / 法律顾问）。`);
    return lines.join('\n');
  }
  // EN
  const lines: string[] = [];
  lines.push(`## Format Standard (binding)`);
  lines.push(`The output for this section MUST conform to the following regulator-mandated format. Any missing required element will be flagged as a \`gap\` by the PFS compliance linter and will block sign-off.`);
  lines.push('');
  lines.push(`**Listing venue / Document type:** ${std.locale_label} (${std.document_type})`);
  lines.push(`**Target market code:** ${std.target_market}`);
  lines.push(`**Section:** ${spec.section_label} (\`${spec.section_code}\`, ordering ${spec.ordering})`);
  lines.push(`**Statutory anchor:** ${spec.statutory_anchor}`);
  if (spec.min_word_count || spec.max_word_count) {
    const lo = spec.min_word_count ? `min ${spec.min_word_count}` : '';
    const hi = spec.max_word_count ? `max ${spec.max_word_count}` : '';
    lines.push(`**Word count target:** ${[lo, hi].filter(Boolean).join(' · ')} words`);
  }
  lines.push('');
  lines.push(`### Global jurisdictional requirements (always apply)`);
  for (const g of std.global_requirements) lines.push(`- ${g}`);
  lines.push('');
  lines.push(`### Required subheadings (output in this order)`);
  for (const h of spec.output_schema.required_subheadings) lines.push(`- ${h}`);
  lines.push('');
  lines.push(`### Required elements (every one must be substantively covered in the body)`);
  for (const el of spec.required_elements) lines.push(`- ${el}`);
  lines.push('');
  lines.push(`### Mandatory disclosure language (must appear, paraphrasing allowed but meaning preserved)`);
  for (const d of spec.mandatory_disclosures) lines.push(`- "${d}"`);
  lines.push('');
  lines.push(`### Citation requirements`);
  for (const c of spec.required_citations) lines.push(`- ${c}`);
  lines.push('');
  lines.push(`### Voice and tone`);
  lines.push(`- ${spec.output_schema.voice_guidance}`);
  lines.push('');
  lines.push(`### Output protocol (strict)`);
  lines.push(`First, emit the full section as **structured Markdown** under the required subheadings (in order). Then, you MUST append a fenced \`\`\`json block with the following envelope:`);
  lines.push('```json');
  lines.push(`{`);
  lines.push(`  "meta": {`);
  lines.push(`    "target_market": "${std.target_market}",`);
  lines.push(`    "section_code": "${spec.section_code}",`);
  lines.push(`    "statutory_anchor": "${spec.statutory_anchor}",`);
  lines.push(`    "locale": "en",`);
  lines.push(`    "word_count": <integer>`);
  lines.push(`  },`);
  lines.push(`  "sections": [`);
  lines.push(`    { "heading": "<subheading>", "body": "<markdown body of that subsection>", "citations": ["<rule/source>"] }`);
  lines.push(`  ],`);
  lines.push(`  "compliance_checklist": [`);
  lines.push(`    { "id": "<required element code>", "label": "<human readable>", "covered": true|false, "evidence": "<sentence in the body that satisfies it>" }`);
  lines.push(`  ],`);
  lines.push(`  "gaps": [ "<any missing required element / disclosure / citation with reason>" ]`);
  lines.push(`}`);
  lines.push('```');
  lines.push(`If data is missing such that an element cannot be honestly satisfied, DO NOT fabricate numbers — list the gap explicitly and identify who should supply it (sponsor / auditor / management / legal counsel).`);
  return lines.join('\n');
}
