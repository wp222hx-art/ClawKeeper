// file: src/ipo/orchestration/workstream_blueprint.ts
// description: Blueprint mapping each WorkstreamType to its lead agent,
//              participating worker agents, output artifacts, and the
//              jurisdiction/industry filters that determine activation.
// reference: src/ipo/orchestration/stages.ts, agents/ipo/**/AGENT.md

import type {
  WorkstreamType,
  TargetMarket,
  Industry,
  SignoffRole,
} from '../types/index';

export interface WorkstreamBlueprint {
  workstream_type: WorkstreamType;
  display_name: string;
  description: string;

  /** Lead agent owning the workstream */
  lead_agent_id: string;

  /** Worker agents that may be invoked under this lead */
  worker_agent_ids: string[];

  /** Filing document types or finding categories produced by this workstream */
  output_artifacts: string[];

  /** Required signoffs before workstream completion can be claimed */
  required_signoffs: SignoffRole[];

  /** Markets for which this workstream is mandatory */
  mandatory_for_markets: TargetMarket[] | 'ALL';

  /** Industries for which this workstream gets specialized agents activated */
  industry_specializations: Partial<Record<Industry, string[]>>;
}

const ALL_SEC_MARKETS: TargetMarket[] = [
  'SEC_NASDAQ_GS', 'SEC_NASDAQ_GM', 'SEC_NASDAQ_CM',
  'SEC_NYSE', 'SEC_NYSE_AMERICAN',
];
const ALL_HKEX_MARKETS: TargetMarket[] = ['HKEX_MAIN', 'HKEX_GEM'];

export const WORKSTREAM_BLUEPRINTS: Record<WorkstreamType, WorkstreamBlueprint> = {
  FINANCIAL_DIAGNOSIS: {
    workstream_type: 'FINANCIAL_DIAGNOSIS',
    display_name: 'Financial Diagnosis',
    description:
      'Diagnose the company financial health for IPO readiness: revenue quality, expense discipline, capital efficiency, KPI gap to industry.',
    lead_agent_id: 'ipo_financial_diagnosis_lead',
    worker_agent_ids: [
      'ipo_revenue_quality_analyzer',
      'ipo_cash_flow_analyst',
      'ipo_kpi_tracker',
      'ipo_variance_analyst',
      'ipo_pl_diagnostician',
      'ipo_balance_sheet_diagnostician',
      'ipo_capital_efficiency_analyzer',
      'ipo_working_capital_analyzer',
    ],
    output_artifacts: ['PRE_IPO_DIAGNOSIS_REPORT', 'FINANCIAL_FINDING'],
    required_signoffs: ['CFO'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {
      SAAS: ['saas_metrics_analyzer', 'saas_cohort_analyzer'],
      BIOPHARMA: ['biopharma_pipeline_evaluator'],
      CLEAN_ENERGY: ['cleanenergy_capex_analyzer', 'cleanenergy_supply_chain_analyzer'],
    },
  },

  AUDIT_PREPARATION: {
    workstream_type: 'AUDIT_PREPARATION',
    display_name: 'Audit Preparation',
    description:
      'Prepare the company for an integrated audit: workpaper readiness, materiality, sample selection, deficiency tracking.',
    lead_agent_id: 'ipo_audit_lead',
    worker_agent_ids: [
      'ipo_audit_preparer',
      'ipo_workpaper_organizer',
      'ipo_materiality_calculator',
      'ipo_sampling_planner',
      'ipo_deficiency_tracker',
      'ipo_pcaob_audit_advisor',
    ],
    output_artifacts: ['AUDIT_READINESS_REPORT', 'ICFR_FINDING'],
    required_signoffs: ['AUDITOR', 'CFO'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  INTERNAL_CONTROL: {
    workstream_type: 'INTERNAL_CONTROL',
    display_name: 'Internal Control over Financial Reporting',
    description:
      'Design and test entity-level controls, process-level controls (P2P, O2C, R2R), and IT general controls per SOX 404 / equivalents.',
    lead_agent_id: 'ipo_internal_control_lead',
    worker_agent_ids: [
      'ipo_icfr_designer',
      'ipo_internal_control_monitor',
      'ipo_segregation_checker',
      'ipo_fraud_detector',
      'ipo_itgc_assessor',
      'ipo_walkthrough_documenter',
    ],
    output_artifacts: ['ICFR_FINDING', 'CONTROL_MATRIX'],
    required_signoffs: ['AUDITOR', 'COMPLIANCE'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  LEGAL_STRUCTURING: {
    workstream_type: 'LEGAL_STRUCTURING',
    display_name: 'Legal Structuring',
    description:
      'Choose listing vehicle (Cayman / Delaware / direct), VIE / red-chip / direct architecture, related party / connected transaction cleanup.',
    lead_agent_id: 'ipo_legal_lead',
    worker_agent_ids: [
      'ipo_restructuring_advisor',
      'ipo_lockup_clause_analyzer',
      'ipo_related_party_tx_reviewer',
      'ipo_corporate_governance_advisor',
    ],
    output_artifacts: ['LEGAL_FINDING', 'STRUCTURE_MEMO'],
    required_signoffs: ['LAWYER', 'CFO'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  TAX_OPTIMIZATION: {
    workstream_type: 'TAX_OPTIMIZATION',
    display_name: 'Tax Optimization',
    description:
      'Cross-border tax structure, treaty utilization, transfer pricing, repatriation strategy.',
    lead_agent_id: 'ipo_tax_lead',
    worker_agent_ids: [
      'ipo_cross_border_tax_optimizer',
      'ipo_transfer_pricing_advisor',
      'ipo_treaty_analyzer',
    ],
    output_artifacts: ['TAX_MEMO'],
    required_signoffs: ['LAWYER', 'CFO'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  PROSPECTUS_DRAFTING: {
    workstream_type: 'PROSPECTUS_DRAFTING',
    display_name: 'Prospectus Drafting',
    description:
      'Draft jurisdiction-specific filing documents (S-1/F-1 or HKEX A1) section by section, with grounded citations.',
    lead_agent_id: 'ipo_disclosure_lead',
    worker_agent_ids: [
      'sec_s1_drafter',
      'sec_safe_harbor_checker',
      'hkex_a1_drafter',
      'hkex_track_record_validator',
      'ipo_business_section_drafter',
      'ipo_risk_factors_drafter',
      'ipo_use_of_proceeds_drafter',
      'ipo_mdna_drafter',
    ],
    output_artifacts: ['SEC_S1', 'SEC_F1', 'HKEX_A1', 'HKEX_PROSPECTUS'],
    required_signoffs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {
      BIOPHARMA: ['biopharma_clinical_disclosure_drafter'],
      CLEAN_ENERGY: ['cleanenergy_subsidy_tracker'],
    },
  },

  REGULATOR_QA: {
    workstream_type: 'REGULATOR_QA',
    display_name: 'Regulator Q&A',
    description:
      'Respond to SEC comment letters or HKEX hearing comments with cited, audit-grade responses.',
    lead_agent_id: 'ipo_disclosure_lead',
    worker_agent_ids: [
      'sec_comment_responder',
      'hkex_sponsor_qa_handler',
      'ipo_amendment_planner',
    ],
    output_artifacts: ['COMMENT_LETTER_RESPONSE'],
    required_signoffs: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  VALUATION_MODELING: {
    workstream_type: 'VALUATION_MODELING',
    display_name: 'Valuation Modeling',
    description:
      'Build DCF, comparable-company, and precedent-transaction models. Run scenario and sensitivity analyses.',
    lead_agent_id: 'ipo_valuation_lead',
    worker_agent_ids: [
      'ipo_dcf_modeler',
      'ipo_comparable_company_valuator',
      'ipo_precedent_transaction_analyzer',
      'ipo_wacc_calculator',
      'ipo_sensitivity_analyzer',
    ],
    output_artifacts: ['VALUATION_MEMO', 'DCF_VALUATION_REPORT', 'COMPARABLE_COMPANY_ANALYSIS'],
    required_signoffs: ['CFO', 'SPONSOR'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {
      BIOPHARMA: ['biopharma_pipeline_evaluator'],
    },
  },

  INDUSTRY_ANALYSIS: {
    workstream_type: 'INDUSTRY_ANALYSIS',
    display_name: 'Industry Analysis',
    description:
      'Industry-specific KPI gap analysis, competitive positioning, market sizing, regulatory tailwinds/headwinds.',
    lead_agent_id: 'ipo_industry_analysis_lead',
    worker_agent_ids: [
      'ipo_industry_benchmark_retriever',
      'ipo_competitive_positioner',
      'ipo_tam_sam_som_estimator',
    ],
    output_artifacts: ['INDUSTRY_FINDING', 'INDUSTRY_MEMO'],
    required_signoffs: ['CFO'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {
      SAAS: ['saas_metrics_analyzer', 'saas_revenue_recognition_advisor', 'saas_cohort_analyzer'],
      BIOPHARMA: ['biopharma_pipeline_evaluator', 'biopharma_ip_analyzer'],
      CLEAN_ENERGY: [
        'cleanenergy_capex_analyzer',
        'cleanenergy_subsidy_tracker',
        'cleanenergy_supply_chain_analyzer',
      ],
    },
  },

  JURISDICTION_COMPLIANCE: {
    workstream_type: 'JURISDICTION_COMPLIANCE',
    display_name: 'Jurisdiction Compliance',
    description:
      'Verify the company qualifies for the target listing market: numerical thresholds, governance, free float, lockups.',
    lead_agent_id: 'ipo_jurisdiction_lead',
    worker_agent_ids: [
      // Activated based on target_market
      'sec_listing_standards_matcher',
      'sec_regsk_checker',
      'sec_sox_advisor',
      'sec_pcaob_audit_advisor',
      'hkex_chapter_checker',
      'hkex_gem_checker',
      'hkex_track_record_validator',
      'hkex_connected_tx_analyzer',
      'hkex_esg_disclosure_drafter',
    ],
    output_artifacts: ['JURISDICTION_CHECKLIST', 'COMPLIANCE_FINDING'],
    required_signoffs: ['LAWYER', 'COMPLIANCE'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  ROADSHOW_PREPARATION: {
    workstream_type: 'ROADSHOW_PREPARATION',
    display_name: 'Roadshow Preparation',
    description: 'Investor narrative, Q&A bank, simulated roadshow rehearsals.',
    lead_agent_id: 'ipo_disclosure_lead',
    worker_agent_ids: [
      'ipo_roadshow_qa_simulator',
      'ipo_investor_narrative_drafter',
    ],
    output_artifacts: ['ROADSHOW_DECK', 'QA_BANK'],
    required_signoffs: ['CFO', 'SPONSOR'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  STOCK_PRICE_SIMULATION: {
    workstream_type: 'STOCK_PRICE_SIMULATION',
    display_name: 'Stock Price Simulation',
    description: 'Monte-Carlo / GARCH stock price path simulations and break-issue probability.',
    lead_agent_id: 'ipo_post_ipo_lead',
    worker_agent_ids: ['ipo_stock_price_simulator'],
    output_artifacts: ['SIMULATION_REPORT'],
    required_signoffs: ['CFO'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  POST_IPO_REPORTING: {
    workstream_type: 'POST_IPO_REPORTING',
    display_name: 'Post-IPO Reporting',
    description: 'Quarterly / interim reporting, lock-up tracking, ongoing disclosure.',
    lead_agent_id: 'ipo_post_ipo_lead',
    worker_agent_ids: [
      'ipo_quarterly_filing_assistant',
      'ipo_lockup_period_tracker',
    ],
    output_artifacts: ['SEC_10Q', 'SEC_10K', 'SEC_8K'],
    required_signoffs: ['CFO', 'AUDITOR'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },

  ESG_DISCLOSURE: {
    workstream_type: 'ESG_DISCLOSURE',
    display_name: 'ESG Disclosure',
    description: 'ESG reporting required for HKEX (Appendix 27); voluntary for SEC issuers but recommended.',
    lead_agent_id: 'ipo_disclosure_lead',
    worker_agent_ids: ['hkex_esg_disclosure_drafter', 'ipo_esg_metric_calculator'],
    output_artifacts: ['ESG_REPORT'],
    required_signoffs: ['COMPLIANCE'],
    mandatory_for_markets: ALL_HKEX_MARKETS,
    industry_specializations: {
      CLEAN_ENERGY: ['cleanenergy_subsidy_tracker'],
    },
  },

  RELATED_PARTY_REVIEW: {
    workstream_type: 'RELATED_PARTY_REVIEW',
    display_name: 'Related Party Review',
    description:
      'Identify, document, and disclose all related party / connected transactions per Reg S-K Item 404 or HKEX Ch.14A.',
    lead_agent_id: 'ipo_legal_lead',
    worker_agent_ids: [
      'ipo_related_party_tx_reviewer',
      'hkex_connected_tx_analyzer',
    ],
    output_artifacts: ['RELATED_PARTY_FINDING', 'CONNECTED_TX_DISCLOSURE'],
    required_signoffs: ['LAWYER', 'INDEPENDENT_DIR'],
    mandatory_for_markets: 'ALL',
    industry_specializations: {},
  },
};

/**
 * Resolve which worker agents to activate for a given workstream based on the
 * project's target market and industry. Returns the union of:
 *   1) Always-on workers in the blueprint
 *   2) Industry-specialized workers (if industry has specialization)
 *   3) Market-specific workers (filtered by target market prefix)
 */
export function resolve_active_workers(
  workstream_type: WorkstreamType,
  target_market: TargetMarket,
  industry: Industry
): string[] {
  const bp = WORKSTREAM_BLUEPRINTS[workstream_type];
  const market_prefix = target_market.startsWith('SEC_') ? 'sec_'
                       : target_market.startsWith('HKEX_') ? 'hkex_'
                       : '';

  const market_filtered = bp.worker_agent_ids.filter(id => {
    if (id.startsWith('sec_')) return market_prefix === 'sec_';
    if (id.startsWith('hkex_')) return market_prefix === 'hkex_';
    return true; // Generic workers always included
  });

  const specialized = bp.industry_specializations[industry] ?? [];
  return Array.from(new Set([...market_filtered, ...specialized]));
}

export function is_workstream_mandatory(
  workstream_type: WorkstreamType,
  target_market: TargetMarket
): boolean {
  const bp = WORKSTREAM_BLUEPRINTS[workstream_type];
  if (bp.mandatory_for_markets === 'ALL') return true;
  return bp.mandatory_for_markets.includes(target_market);
}
