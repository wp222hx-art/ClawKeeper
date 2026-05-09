// file: src/ipo/orchestration/agent_registry.ts
// description: In-memory registry of all IPOPilot agents — IDs, capabilities,
//              tier (CEO / Lead / Worker), and skill bindings. Used by
//              IPOOrchestrationService to resolve agents by capability and to
//              power the dashboard's agent directory.
// reference: agents/ipo/**/AGENT.md, src/ipo/orchestration/workstream_blueprint.ts

export type AgentTier = 'CEO' | 'JURISDICTION_LEAD' | 'INDUSTRY_LEAD' | 'FUNCTIONAL_LEAD' | 'WORKER';

export type AgentCategory =
  | 'CEO'
  | 'JURISDICTION_SEC' | 'JURISDICTION_HKEX'
  | 'INDUSTRY_SAAS' | 'INDUSTRY_BIOPHARMA' | 'INDUSTRY_CLEAN_ENERGY'
  | 'FINANCIAL' | 'AUDIT' | 'INTERNAL_CONTROL'
  | 'LEGAL' | 'TAX' | 'VALUATION'
  | 'DISCLOSURE' | 'POST_IPO' | 'RAG';

export interface IpoAgentDefinition {
  id: string;
  display_name: string;
  tier: AgentTier;
  category: AgentCategory;
  description: string;
  capabilities: string[];
  skill_files: string[];           // Paths to SKILL.md files
  agent_md_path: string;            // Path to AGENT.md
  required_signoff_for_outputs?: string[];
  citation_required: boolean;       // True for regulation-citing agents
}

// ---------------------------------------------------------------------------
// CEO
// ---------------------------------------------------------------------------
const CEO_AGENTS: IpoAgentDefinition[] = [
  {
    id: 'ipo_director',
    display_name: 'IPO Director',
    tier: 'CEO',
    category: 'CEO',
    description: 'Top-level conductor. Receives client mandate, assembles workstreams, monitors stage gates.',
    capabilities: ['mandate_intake', 'project_planning', 'stage_gate_management', 'escalation_routing'],
    skill_files: ['skills/ipo/project-planning/SKILL.md'],
    agent_md_path: 'agents/ipo/ceo/AGENT.md',
    citation_required: false,
  },
];

// ---------------------------------------------------------------------------
// Jurisdiction & Industry Leads
// ---------------------------------------------------------------------------
const LEAD_AGENTS: IpoAgentDefinition[] = [
  // Jurisdiction
  { id: 'ipo_jurisdiction_lead', display_name: 'Jurisdiction Compliance Lead', tier: 'JURISDICTION_LEAD',
    category: 'JURISDICTION_SEC', description: 'Routes work to SEC or HKEX teams based on target_market.',
    capabilities: ['jurisdiction_routing', 'numerical_threshold_check', 'governance_check'],
    skill_files: ['skills/ipo/jurisdiction-routing/SKILL.md'],
    agent_md_path: 'agents/ipo/jurisdiction-leads/AGENT.md', citation_required: true },

  // Industry
  { id: 'ipo_industry_analysis_lead', display_name: 'Industry Analysis Lead', tier: 'INDUSTRY_LEAD',
    category: 'INDUSTRY_SAAS', description: 'Coordinates industry-specific analysis with sector experts.',
    capabilities: ['industry_routing', 'benchmark_orchestration'],
    skill_files: ['skills/ipo/industry-routing/SKILL.md'],
    agent_md_path: 'agents/ipo/industry-leads/AGENT.md', citation_required: false },

  // Functional Leads
  { id: 'ipo_financial_diagnosis_lead', display_name: 'Financial Diagnosis Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'FINANCIAL', description: 'Owns financial readiness diagnosis workstream.',
    capabilities: ['financial_diagnosis', 'finding_aggregation'],
    skill_files: ['skills/ipo/financial-diagnosis/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: false,
    required_signoff_for_outputs: ['CFO'] },

  { id: 'ipo_audit_lead', display_name: 'Audit Preparation Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'AUDIT', description: 'Owns audit-readiness, materiality, and PCAOB-compliant workpaper prep.',
    capabilities: ['audit_planning', 'materiality_calculation', 'workpaper_review'],
    skill_files: ['skills/ipo/audit-preparation/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['AUDITOR', 'CFO'] },

  { id: 'ipo_internal_control_lead', display_name: 'Internal Control Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'INTERNAL_CONTROL', description: 'Owns ICFR design, walkthrough, testing, deficiency tracking.',
    capabilities: ['icfr_design', 'walkthrough_planning', 'deficiency_tracking'],
    skill_files: ['skills/ipo/icfr-design/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['AUDITOR', 'COMPLIANCE'] },

  { id: 'ipo_legal_lead', display_name: 'Legal Structuring Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'LEGAL', description: 'Owns listing-vehicle architecture, related-party cleanup, governance reform.',
    capabilities: ['legal_structuring', 'related_party_review', 'governance_design'],
    skill_files: ['skills/ipo/legal-structuring/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER'] },

  { id: 'ipo_tax_lead', display_name: 'Tax Optimization Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'TAX', description: 'Owns cross-border tax architecture and transfer-pricing.',
    capabilities: ['tax_structuring', 'treaty_analysis', 'transfer_pricing'],
    skill_files: ['skills/ipo/tax-optimization/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'CFO'] },

  { id: 'ipo_disclosure_lead', display_name: 'Disclosure & Drafting Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'DISCLOSURE', description: 'Owns prospectus drafting, regulator Q&A, roadshow narrative.',
    capabilities: ['document_drafting', 'comment_response', 'narrative_design'],
    skill_files: ['skills/ipo/prospectus-drafting/SKILL.md', 'skills/ipo/comment-response/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'] },

  { id: 'ipo_valuation_lead', display_name: 'Valuation Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'VALUATION', description: 'Owns DCF / comps / precedent-tx valuation and sensitivity.',
    capabilities: ['dcf_modeling', 'comp_analysis', 'sensitivity_analysis'],
    skill_files: ['skills/ipo/valuation-modeling/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: false,
    required_signoff_for_outputs: ['CFO', 'SPONSOR'] },

  { id: 'ipo_post_ipo_lead', display_name: 'Post-IPO Lead', tier: 'FUNCTIONAL_LEAD',
    category: 'POST_IPO', description: 'Owns ongoing reporting, lock-up tracking, stock-price simulation.',
    capabilities: ['quarterly_reporting', 'lockup_tracking', 'price_simulation'],
    skill_files: ['skills/ipo/post-ipo-reporting/SKILL.md'],
    agent_md_path: 'agents/ipo/functional-leads/AGENT.md', citation_required: false,
    required_signoff_for_outputs: ['CFO', 'AUDITOR'] },
];

// ---------------------------------------------------------------------------
// Worker Agents — SEC (7)
// ---------------------------------------------------------------------------
const WORKERS_SEC: IpoAgentDefinition[] = [
  { id: 'sec_s1_drafter', display_name: 'SEC S-1 Drafter', tier: 'WORKER', category: 'JURISDICTION_SEC',
    description: 'Drafts S-1 / F-1 sections (Item 1-29) per Reg S-K with citations.',
    capabilities: ['s1_drafting', 'f1_drafting', 'mdna_drafting'],
    skill_files: ['skills/ipo/sec-s1-drafting/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_s1_drafter/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'] },

  { id: 'sec_regsk_checker', display_name: 'SEC Reg S-K Checker', tier: 'WORKER', category: 'JURISDICTION_SEC',
    description: 'Verifies prospectus sections against Reg S-K item-by-item requirements.',
    capabilities: ['regsk_compliance_check'], skill_files: ['skills/ipo/regsk-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_regsk_checker/AGENT.md', citation_required: true },

  { id: 'sec_comment_responder', display_name: 'SEC Comment Letter Responder', tier: 'WORKER', category: 'JURISDICTION_SEC',
    description: 'Drafts cited responses to SEC staff comment letters.',
    capabilities: ['comment_response_drafting'], skill_files: ['skills/ipo/comment-response/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_comment_responder/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR'] },

  { id: 'sec_sox_advisor', display_name: 'SOX 404 Advisor', tier: 'WORKER', category: 'JURISDICTION_SEC',
    description: 'Advises on SOX 302 / 404 compliance roadmap.',
    capabilities: ['sox_advisory'], skill_files: ['skills/ipo/sox-advisory/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_sox_advisor/AGENT.md', citation_required: true },

  { id: 'sec_safe_harbor_checker', display_name: 'Safe Harbor Checker', tier: 'WORKER', category: 'JURISDICTION_SEC',
    description: 'Reviews forward-looking statements for PSLRA safe-harbor compliance.',
    capabilities: ['safe_harbor_check'], skill_files: ['skills/ipo/safe-harbor-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_safe_harbor_checker/AGENT.md', citation_required: true },

  { id: 'sec_pcaob_audit_advisor', display_name: 'PCAOB Audit Advisor', tier: 'WORKER', category: 'JURISDICTION_SEC',
    description: 'Translates PCAOB AS 2201 / 1105 into actionable audit-prep tasks.',
    capabilities: ['pcaob_advisory'], skill_files: ['skills/ipo/pcaob-advisory/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_pcaob_audit_advisor/AGENT.md', citation_required: true },

  { id: 'sec_listing_standards_matcher', display_name: 'SEC Listing Standards Matcher', tier: 'WORKER', category: 'JURISDICTION_SEC',
    description: 'Matches the issuer to Nasdaq GS/GM/CM or NYSE/NYSE American thresholds.',
    capabilities: ['listing_standards_match'], skill_files: ['skills/ipo/listing-standards-match/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/sec/sec_listing_standards_matcher/AGENT.md', citation_required: true },
];

// ---------------------------------------------------------------------------
// Worker Agents — HKEX (7)
// ---------------------------------------------------------------------------
const WORKERS_HKEX: IpoAgentDefinition[] = [
  { id: 'hkex_a1_drafter', display_name: 'HKEX A1 Drafter', tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description: 'Drafts A1 application proof and listing document sections per Ch.11.',
    capabilities: ['a1_drafting', 'listing_doc_drafting'],
    skill_files: ['skills/ipo/hkex-a1-drafting/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_a1_drafter/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'] },

  { id: 'hkex_chapter_checker', display_name: 'HKEX Main Board Rules Checker', tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description: 'Verifies eligibility under Main Board Listing Rules Ch. 8 / 9 / 11.',
    capabilities: ['main_board_rules_check'], skill_files: ['skills/ipo/hkex-rules-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_chapter_checker/AGENT.md', citation_required: true },

  { id: 'hkex_gem_checker', display_name: 'HKEX GEM Rules Checker', tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description: 'Verifies eligibility under GEM Listing Rules Ch. 11.',
    capabilities: ['gem_rules_check'], skill_files: ['skills/ipo/hkex-gem-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_gem_checker/AGENT.md', citation_required: true },

  { id: 'hkex_sponsor_qa_handler', display_name: 'HKEX Sponsor Q&A Handler', tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description: 'Drafts cited responses to HKEX hearing comments and post-hearing comments.',
    capabilities: ['hkex_qa_response'], skill_files: ['skills/ipo/hkex-qa-response/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_sponsor_qa_handler/AGENT.md', citation_required: true,
    required_signoff_for_outputs: ['LAWYER', 'SPONSOR'] },

  { id: 'hkex_connected_tx_analyzer', display_name: 'HKEX Connected Transaction Analyzer', tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description: 'Identifies and quantifies connected transactions under Ch. 14A.',
    capabilities: ['connected_tx_analysis'], skill_files: ['skills/ipo/hkex-connected-tx/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_connected_tx_analyzer/AGENT.md', citation_required: true },

  { id: 'hkex_esg_disclosure_drafter', display_name: 'HKEX ESG Disclosure Drafter', tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description: 'Drafts ESG report per HKEX Appendix 27 mandatory disclosures.',
    capabilities: ['esg_disclosure_drafting'], skill_files: ['skills/ipo/hkex-esg/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_esg_disclosure_drafter/AGENT.md', citation_required: true },

  { id: 'hkex_track_record_validator', display_name: 'HKEX Track Record Validator', tier: 'WORKER', category: 'JURISDICTION_HKEX',
    description: 'Validates the 3-year (or shortened under 18A/18C) track record period.',
    capabilities: ['track_record_validation'], skill_files: ['skills/ipo/hkex-track-record/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/hkex/hkex_track_record_validator/AGENT.md', citation_required: true },
];

// ---------------------------------------------------------------------------
// Worker Agents — Industry Specialists (9)
// ---------------------------------------------------------------------------
const WORKERS_SAAS: IpoAgentDefinition[] = [
  { id: 'saas_metrics_analyzer', display_name: 'SaaS Metrics Analyzer', tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description: 'Analyzes ARR/MRR/NRR/CAC/LTV/Magic Number against benchmarks.',
    capabilities: ['saas_metric_analysis'], skill_files: ['skills/ipo/saas-metrics/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/saas_metrics_analyzer/AGENT.md', citation_required: false },
  { id: 'saas_revenue_recognition_advisor', display_name: 'SaaS Revenue Recognition Advisor', tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description: 'Advises on ASC 606 / IFRS 15 application for SaaS contracts.',
    capabilities: ['revrec_advisory'], skill_files: ['skills/ipo/saas-revrec/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/saas_revenue_recognition_advisor/AGENT.md', citation_required: true },
  { id: 'saas_cohort_analyzer', display_name: 'SaaS Cohort Analyzer', tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description: 'Builds cohort retention / expansion / churn analyses.',
    capabilities: ['cohort_analysis'], skill_files: ['skills/ipo/saas-cohort/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/saas_cohort_analyzer/AGENT.md', citation_required: false },
];

const WORKERS_BIOPHARMA: IpoAgentDefinition[] = [
  { id: 'biopharma_pipeline_evaluator', display_name: 'BioPharma Pipeline Evaluator', tier: 'WORKER', category: 'INDUSTRY_BIOPHARMA',
    description: 'Evaluates clinical pipeline (Phase I/II/III) success probability and risk.',
    capabilities: ['pipeline_evaluation'], skill_files: ['skills/ipo/biopharma-pipeline/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/biopharma/biopharma_pipeline_evaluator/AGENT.md', citation_required: false },
  { id: 'biopharma_ip_analyzer', display_name: 'BioPharma IP Analyzer', tier: 'WORKER', category: 'INDUSTRY_BIOPHARMA',
    description: 'Analyzes patent portfolio, freedom-to-operate, exclusivity windows.',
    capabilities: ['ip_analysis'], skill_files: ['skills/ipo/biopharma-ip/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/biopharma/biopharma_ip_analyzer/AGENT.md', citation_required: true },
  { id: 'biopharma_clinical_disclosure_drafter', display_name: 'BioPharma Clinical Disclosure Drafter', tier: 'WORKER', category: 'INDUSTRY_BIOPHARMA',
    description: 'Drafts clinical-trial-result disclosures per ICH-GCP and SEC/HKEX rules.',
    capabilities: ['clinical_disclosure'], skill_files: ['skills/ipo/biopharma-clinical-disclosure/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/biopharma/biopharma_clinical_disclosure_drafter/AGENT.md', citation_required: true },
];

const WORKERS_CLEAN_ENERGY: IpoAgentDefinition[] = [
  { id: 'cleanenergy_capex_analyzer', display_name: 'Clean Energy Capex Analyzer', tier: 'WORKER', category: 'INDUSTRY_CLEAN_ENERGY',
    description: 'Analyzes capex schedules, capacity ramp curves, and unit economics.',
    capabilities: ['capex_analysis'], skill_files: ['skills/ipo/cleanenergy-capex/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/cleanenergy/cleanenergy_capex_analyzer/AGENT.md', citation_required: false },
  { id: 'cleanenergy_subsidy_tracker', display_name: 'Clean Energy Subsidy Tracker', tier: 'WORKER', category: 'INDUSTRY_CLEAN_ENERGY',
    description: 'Tracks subsidy / IRA / tax-credit programs across jurisdictions.',
    capabilities: ['subsidy_tracking'], skill_files: ['skills/ipo/cleanenergy-subsidy/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/cleanenergy/cleanenergy_subsidy_tracker/AGENT.md', citation_required: true },
  { id: 'cleanenergy_supply_chain_analyzer', display_name: 'Clean Energy Supply Chain Analyzer', tier: 'WORKER', category: 'INDUSTRY_CLEAN_ENERGY',
    description: 'Analyzes upstream commodity (Li/Co/poly-Si) exposure and concentration.',
    capabilities: ['supply_chain_analysis'], skill_files: ['skills/ipo/cleanenergy-supply-chain/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/cleanenergy/cleanenergy_supply_chain_analyzer/AGENT.md', citation_required: false },
];

// ---------------------------------------------------------------------------
// Worker Agents — Financial / Audit / ICFR / Legal / Tax / Valuation / Post (~30)
// ---------------------------------------------------------------------------
const WORKERS_FINANCIAL: IpoAgentDefinition[] = [
  { id: 'ipo_revenue_quality_analyzer', display_name: 'Revenue Quality Analyzer', tier: 'WORKER', category: 'FINANCIAL',
    description: 'Tests revenue concentration, recognition timing, channel stuffing risk.',
    capabilities: ['revenue_quality'], skill_files: ['skills/ipo/revenue-quality/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_revenue_quality_analyzer/AGENT.md', citation_required: false },
  { id: 'ipo_cash_flow_analyst', display_name: 'Cash Flow Analyst', tier: 'WORKER', category: 'FINANCIAL',
    description: 'Reconciles operating, investing, financing cash flows; FCF normalization.',
    capabilities: ['cash_flow_analysis'], skill_files: ['skills/ipo/cash-flow-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_cash_flow_analyst/AGENT.md', citation_required: false },
  { id: 'ipo_kpi_tracker', display_name: 'KPI Tracker', tier: 'WORKER', category: 'FINANCIAL',
    description: 'Tracks operating KPIs and benchmarks against industry quartiles.',
    capabilities: ['kpi_tracking'], skill_files: ['skills/ipo/kpi-tracking/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_kpi_tracker/AGENT.md', citation_required: false },
  { id: 'ipo_variance_analyst', display_name: 'Variance Analyst', tier: 'WORKER', category: 'FINANCIAL',
    description: 'Period-over-period variance analysis with explanation drafts.',
    capabilities: ['variance_analysis'], skill_files: ['skills/ipo/variance-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_variance_analyst/AGENT.md', citation_required: false },
  { id: 'ipo_pl_diagnostician', display_name: 'P&L Diagnostician', tier: 'WORKER', category: 'FINANCIAL',
    description: 'Diagnoses P&L: margin trends, opex discipline, non-recurring items.',
    capabilities: ['pl_diagnosis'], skill_files: ['skills/ipo/pl-diagnosis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_pl_diagnostician/AGENT.md', citation_required: false },
  { id: 'ipo_balance_sheet_diagnostician', display_name: 'Balance Sheet Diagnostician', tier: 'WORKER', category: 'FINANCIAL',
    description: 'Diagnoses balance sheet: leverage, liquidity, asset quality.',
    capabilities: ['balance_sheet_diagnosis'], skill_files: ['skills/ipo/balance-sheet-diagnosis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_balance_sheet_diagnostician/AGENT.md', citation_required: false },
  { id: 'ipo_capital_efficiency_analyzer', display_name: 'Capital Efficiency Analyzer', tier: 'WORKER', category: 'FINANCIAL',
    description: 'ROIC, ROE, asset turnover analysis.',
    capabilities: ['capital_efficiency'], skill_files: ['skills/ipo/capital-efficiency/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_capital_efficiency_analyzer/AGENT.md', citation_required: false },
  { id: 'ipo_working_capital_analyzer', display_name: 'Working Capital Analyzer', tier: 'WORKER', category: 'FINANCIAL',
    description: 'DSO/DPO/DIO cycles, working capital sensitivity.',
    capabilities: ['working_capital'], skill_files: ['skills/ipo/working-capital/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/financial/ipo_working_capital_analyzer/AGENT.md', citation_required: false },
];

const WORKERS_AUDIT: IpoAgentDefinition[] = [
  { id: 'ipo_audit_preparer', display_name: 'Audit Preparer', tier: 'WORKER', category: 'AUDIT',
    description: 'Prepares audit-ready trial balance, schedules, and supporting evidence.',
    capabilities: ['audit_preparation'], skill_files: ['skills/ipo/audit-preparer/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_audit_preparer/AGENT.md', citation_required: true },
  { id: 'ipo_workpaper_organizer', display_name: 'Workpaper Organizer', tier: 'WORKER', category: 'AUDIT',
    description: 'Organizes workpapers per audit-firm template; references PCAOB AS 1215.',
    capabilities: ['workpaper_organization'], skill_files: ['skills/ipo/workpaper-organization/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_workpaper_organizer/AGENT.md', citation_required: true },
  { id: 'ipo_materiality_calculator', display_name: 'Materiality Calculator', tier: 'WORKER', category: 'AUDIT',
    description: 'Computes overall materiality, performance materiality, and TE thresholds.',
    capabilities: ['materiality_calculation'], skill_files: ['skills/ipo/materiality/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_materiality_calculator/AGENT.md', citation_required: true },
  { id: 'ipo_sampling_planner', display_name: 'Sampling Planner', tier: 'WORKER', category: 'AUDIT',
    description: 'Plans audit sample sizes per AS 2315 / ISA 530.',
    capabilities: ['sampling_planning'], skill_files: ['skills/ipo/sampling-planning/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_sampling_planner/AGENT.md', citation_required: true },
  { id: 'ipo_deficiency_tracker', display_name: 'Deficiency Tracker', tier: 'WORKER', category: 'AUDIT',
    description: 'Tracks audit deficiencies and remediation status.',
    capabilities: ['deficiency_tracking'], skill_files: ['skills/ipo/deficiency-tracking/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_deficiency_tracker/AGENT.md', citation_required: false },
];

const WORKERS_ICFR: IpoAgentDefinition[] = [
  { id: 'ipo_icfr_designer', display_name: 'ICFR Control Designer', tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description: 'Designs entity-level + process-level controls; produces RACI / control matrix.',
    capabilities: ['icfr_design'], skill_files: ['skills/ipo/icfr-design/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_icfr_designer/AGENT.md', citation_required: true },
  { id: 'ipo_internal_control_monitor', display_name: 'Internal Control Monitor', tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description: 'Continuous control monitoring and exception flagging.',
    capabilities: ['control_monitoring'], skill_files: ['skills/ipo/control-monitoring/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_internal_control_monitor/AGENT.md', citation_required: false },
  { id: 'ipo_segregation_checker', display_name: 'Segregation of Duties Checker', tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description: 'Detects SoD conflicts in transactional system access.',
    capabilities: ['sod_check'], skill_files: ['skills/ipo/sod-check/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_segregation_checker/AGENT.md', citation_required: false },
  { id: 'ipo_fraud_detector', display_name: 'Fraud Indicator Detector', tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description: 'Applies AS 2401 fraud risk factors to flag anomalies.',
    capabilities: ['fraud_detection'], skill_files: ['skills/ipo/fraud-detection/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_fraud_detector/AGENT.md', citation_required: true },
  { id: 'ipo_itgc_assessor', display_name: 'IT General Controls Assessor', tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description: 'Assesses ITGC: access, change management, operations, computer ops.',
    capabilities: ['itgc_assessment'], skill_files: ['skills/ipo/itgc-assessment/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_itgc_assessor/AGENT.md', citation_required: true },
  { id: 'ipo_walkthrough_documenter', display_name: 'Walkthrough Documenter', tier: 'WORKER', category: 'INTERNAL_CONTROL',
    description: 'Documents process walkthroughs with control points and risk linkage.',
    capabilities: ['walkthrough_documentation'], skill_files: ['skills/ipo/walkthrough-documentation/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/audit/ipo_walkthrough_documenter/AGENT.md', citation_required: false },
];

const WORKERS_LEGAL_TAX: IpoAgentDefinition[] = [
  { id: 'ipo_restructuring_advisor', display_name: 'Restructuring Advisor', tier: 'WORKER', category: 'LEGAL',
    description: 'Advises VIE / red-chip / direct structure trade-offs.',
    capabilities: ['restructuring_advisory'], skill_files: ['skills/ipo/restructuring/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_restructuring_advisor/AGENT.md', citation_required: true },
  { id: 'ipo_lockup_clause_analyzer', display_name: 'Lockup Clause Analyzer', tier: 'WORKER', category: 'LEGAL',
    description: 'Analyzes existing investor lock-up clauses; recommends underwriter lockup.',
    capabilities: ['lockup_analysis'], skill_files: ['skills/ipo/lockup-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_lockup_clause_analyzer/AGENT.md', citation_required: true },
  { id: 'ipo_related_party_tx_reviewer', display_name: 'Related Party Tx Reviewer', tier: 'WORKER', category: 'LEGAL',
    description: 'Identifies and reviews related-party transactions per Item 404 / Ch.14A.',
    capabilities: ['related_party_review'], skill_files: ['skills/ipo/related-party-review/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_related_party_tx_reviewer/AGENT.md', citation_required: true },
  { id: 'ipo_corporate_governance_advisor', display_name: 'Corporate Governance Advisor', tier: 'WORKER', category: 'LEGAL',
    description: 'Recommends board composition, committees, charters per market rules.',
    capabilities: ['governance_advisory'], skill_files: ['skills/ipo/governance/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_corporate_governance_advisor/AGENT.md', citation_required: true },
  { id: 'ipo_cross_border_tax_optimizer', display_name: 'Cross-Border Tax Optimizer', tier: 'WORKER', category: 'TAX',
    description: 'Optimizes cross-border tax architecture using treaties.',
    capabilities: ['tax_optimization'], skill_files: ['skills/ipo/tax-optimization/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_cross_border_tax_optimizer/AGENT.md', citation_required: true },
  { id: 'ipo_transfer_pricing_advisor', display_name: 'Transfer Pricing Advisor', tier: 'WORKER', category: 'TAX',
    description: 'Advises on transfer pricing methods, documentation, BEPS alignment.',
    capabilities: ['transfer_pricing'], skill_files: ['skills/ipo/transfer-pricing/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_transfer_pricing_advisor/AGENT.md', citation_required: true },
  { id: 'ipo_treaty_analyzer', display_name: 'Tax Treaty Analyzer', tier: 'WORKER', category: 'TAX',
    description: 'Analyzes applicable double-tax treaties and withholding rates.',
    capabilities: ['treaty_analysis'], skill_files: ['skills/ipo/treaty-analysis/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_treaty_analyzer/AGENT.md', citation_required: true },
];

const WORKERS_VALUATION: IpoAgentDefinition[] = [
  { id: 'ipo_dcf_modeler', display_name: 'DCF Modeler', tier: 'WORKER', category: 'VALUATION',
    description: 'Builds DCF models with terminal value, sensitivities, scenarios.',
    capabilities: ['dcf_modeling'], skill_files: ['skills/ipo/dcf-modeling/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_dcf_modeler/AGENT.md', citation_required: false },
  { id: 'ipo_comparable_company_valuator', display_name: 'Comparable Company Valuator', tier: 'WORKER', category: 'VALUATION',
    description: 'Builds public-company multiple-based valuations.',
    capabilities: ['comp_valuation'], skill_files: ['skills/ipo/comp-valuation/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_comparable_company_valuator/AGENT.md', citation_required: false },
  { id: 'ipo_precedent_transaction_analyzer', display_name: 'Precedent Transaction Analyzer', tier: 'WORKER', category: 'VALUATION',
    description: 'Builds precedent-M&A and precedent-IPO valuations.',
    capabilities: ['precedent_tx_analysis'], skill_files: ['skills/ipo/precedent-tx/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_precedent_transaction_analyzer/AGENT.md', citation_required: false },
  { id: 'ipo_wacc_calculator', display_name: 'WACC Calculator', tier: 'WORKER', category: 'VALUATION',
    description: 'Computes WACC with industry betas and country-risk premiums.',
    capabilities: ['wacc_calculation'], skill_files: ['skills/ipo/wacc/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_wacc_calculator/AGENT.md', citation_required: false },
  { id: 'ipo_sensitivity_analyzer', display_name: 'Sensitivity Analyzer', tier: 'WORKER', category: 'VALUATION',
    description: 'Builds tornado / one-way / two-way sensitivity tables.',
    capabilities: ['sensitivity_analysis'], skill_files: ['skills/ipo/sensitivity/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/valuation/ipo_sensitivity_analyzer/AGENT.md', citation_required: false },
];

const WORKERS_DISCLOSURE: IpoAgentDefinition[] = [
  { id: 'ipo_business_section_drafter', display_name: 'Business Section Drafter', tier: 'WORKER', category: 'DISCLOSURE',
    description: 'Drafts the Business / Description section of the prospectus.',
    capabilities: ['business_section_drafting'], skill_files: ['skills/ipo/business-section/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_business_section_drafter/AGENT.md', citation_required: true },
  { id: 'ipo_risk_factors_drafter', display_name: 'Risk Factors Drafter', tier: 'WORKER', category: 'DISCLOSURE',
    description: 'Drafts comprehensive Risk Factors section.',
    capabilities: ['risk_factors_drafting'], skill_files: ['skills/ipo/risk-factors/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_risk_factors_drafter/AGENT.md', citation_required: true },
  { id: 'ipo_use_of_proceeds_drafter', display_name: 'Use of Proceeds Drafter', tier: 'WORKER', category: 'DISCLOSURE',
    description: 'Drafts Use of Proceeds section consistent with valuation.',
    capabilities: ['proceeds_drafting'], skill_files: ['skills/ipo/use-of-proceeds/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_use_of_proceeds_drafter/AGENT.md', citation_required: true },
  { id: 'ipo_mdna_drafter', display_name: 'MD&A Drafter', tier: 'WORKER', category: 'DISCLOSURE',
    description: 'Drafts Management Discussion & Analysis per Item 303.',
    capabilities: ['mdna_drafting'], skill_files: ['skills/ipo/mdna/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_mdna_drafter/AGENT.md', citation_required: true },
  { id: 'ipo_amendment_planner', display_name: 'Amendment Planner', tier: 'WORKER', category: 'DISCLOSURE',
    description: 'Plans which sections need to be amended after each comment round.',
    capabilities: ['amendment_planning'], skill_files: ['skills/ipo/amendment-planning/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_amendment_planner/AGENT.md', citation_required: false },
  { id: 'ipo_investor_narrative_drafter', display_name: 'Investor Narrative Drafter', tier: 'WORKER', category: 'DISCLOSURE',
    description: 'Drafts the equity story / roadshow narrative.',
    capabilities: ['narrative_drafting'], skill_files: ['skills/ipo/narrative-drafting/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_investor_narrative_drafter/AGENT.md', citation_required: false },
  { id: 'ipo_esg_metric_calculator', display_name: 'ESG Metric Calculator', tier: 'WORKER', category: 'DISCLOSURE',
    description: 'Calculates GHG, social, and governance metrics required by HKEX App.27.',
    capabilities: ['esg_metric_calculation'], skill_files: ['skills/ipo/esg-metrics/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/legal/ipo_esg_metric_calculator/AGENT.md', citation_required: true },
];

const WORKERS_POST_IPO: IpoAgentDefinition[] = [
  { id: 'ipo_stock_price_simulator', display_name: 'Stock Price Simulator', tier: 'WORKER', category: 'POST_IPO',
    description: 'Runs Monte-Carlo / GARCH price-path simulations.',
    capabilities: ['price_simulation'], skill_files: ['skills/ipo/price-simulation/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_stock_price_simulator/AGENT.md', citation_required: false },
  { id: 'ipo_roadshow_qa_simulator', display_name: 'Roadshow Q&A Simulator', tier: 'WORKER', category: 'POST_IPO',
    description: 'Generates probable investor questions and rehearsal answers.',
    capabilities: ['roadshow_qa_simulation'], skill_files: ['skills/ipo/roadshow-qa/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_roadshow_qa_simulator/AGENT.md', citation_required: false },
  { id: 'ipo_quarterly_filing_assistant', display_name: 'Quarterly Filing Assistant', tier: 'WORKER', category: 'POST_IPO',
    description: 'Assists with 10-Q / interim report preparation.',
    capabilities: ['quarterly_filing'], skill_files: ['skills/ipo/quarterly-filing/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_quarterly_filing_assistant/AGENT.md', citation_required: true },
  { id: 'ipo_lockup_period_tracker', display_name: 'Lockup Period Tracker', tier: 'WORKER', category: 'POST_IPO',
    description: 'Tracks lock-up release schedule and supply overhang risk.',
    capabilities: ['lockup_tracking'], skill_files: ['skills/ipo/lockup-tracking/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/postipo/ipo_lockup_period_tracker/AGENT.md', citation_required: false },
];

const WORKERS_INDUSTRY_SUPPORT: IpoAgentDefinition[] = [
  { id: 'ipo_competitive_positioner', display_name: 'Competitive Positioner', tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description: 'Maps the issuer against named competitors on key dimensions.',
    capabilities: ['competitive_positioning'], skill_files: ['skills/ipo/competitive-positioning/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/ipo_competitive_positioner/AGENT.md', citation_required: false },
  { id: 'ipo_tam_sam_som_estimator', display_name: 'TAM/SAM/SOM Estimator', tier: 'WORKER', category: 'INDUSTRY_SAAS',
    description: 'Estimates Total/Serviceable/Obtainable Addressable Market.',
    capabilities: ['market_sizing'], skill_files: ['skills/ipo/market-sizing/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/saas/ipo_tam_sam_som_estimator/AGENT.md', citation_required: false },
];

// ---------------------------------------------------------------------------
// RAG retrieval agents (3)
// ---------------------------------------------------------------------------
const WORKERS_RAG: IpoAgentDefinition[] = [
  { id: 'ipo_regulation_retriever', display_name: 'Regulation Retriever', tier: 'WORKER', category: 'RAG',
    description: 'Vector + BM25 retrieval over regulation knowledge base; returns cited chunks.',
    capabilities: ['regulation_retrieval'], skill_files: ['skills/ipo/regulation-retrieval/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/rag/ipo_regulation_retriever/AGENT.md', citation_required: true },
  { id: 'ipo_precedent_case_retriever', display_name: 'Precedent Case Retriever', tier: 'WORKER', category: 'RAG',
    description: 'Retrieves comparable IPO filings, comment-letter answers, and hearings.',
    capabilities: ['precedent_retrieval'], skill_files: ['skills/ipo/precedent-retrieval/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/rag/ipo_precedent_case_retriever/AGENT.md', citation_required: true },
  { id: 'ipo_industry_benchmark_retriever', display_name: 'Industry Benchmark Retriever', tier: 'WORKER', category: 'RAG',
    description: 'Retrieves curated industry benchmark distributions (p10/25/50/75/90).',
    capabilities: ['benchmark_retrieval'], skill_files: ['skills/ipo/benchmark-retrieval/SKILL.md'],
    agent_md_path: 'agents/ipo/workers/rag/ipo_industry_benchmark_retriever/AGENT.md', citation_required: false },
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
