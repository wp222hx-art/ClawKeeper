// file: src/ipo/types/index.ts
// description: Core domain types for IPOPilot — projects, workstreams,
//              findings, filing documents, signoffs, valuations, simulations.
// reference: db/ipo_schema.sql, agents/ipo/**/AGENT.md

import { z } from 'zod';

// ============================================================================
// Markets & Industries
// ============================================================================

export const TargetMarket = z.enum([
  'SEC_NASDAQ_GS',
  'SEC_NASDAQ_GM',
  'SEC_NASDAQ_CM',
  'SEC_NYSE',
  'SEC_NYSE_AMERICAN',
  'HKEX_MAIN',
  'HKEX_GEM',
]);
export type TargetMarket = z.infer<typeof TargetMarket>;

export const Industry = z.enum(['SAAS', 'BIOPHARMA', 'CLEAN_ENERGY', 'OTHER']);
export type Industry = z.infer<typeof Industry>;

export const ListingStructure = z.enum([
  'DIRECT',
  'VIE',
  'RED_CHIP',
  'SPAC_MERGER',
  'CARVE_OUT',
  'DUAL_PRIMARY',
  'SECONDARY_LISTING',
]);
export type ListingStructure = z.infer<typeof ListingStructure>;

// ============================================================================
// Stage gate (sequential)
// ============================================================================

export const ProjectStage = z.enum([
  'PRE_IPO_DIAGNOSIS',
  'READINESS_REMEDIATION',
  'RESTRUCTURING',
  'AUDIT_TRACK_RECORD',
  'FILING_PREPARATION',
  'REGULATOR_REVIEW',
  'PRICING_ROADSHOW',
  'LISTED',
  'POST_IPO_MONITORING',
  'WITHDRAWN',
  'COMPLETED',
]);
export type ProjectStage = z.infer<typeof ProjectStage>;

export const STAGE_ORDER: ProjectStage[] = [
  'PRE_IPO_DIAGNOSIS',
  'READINESS_REMEDIATION',
  'RESTRUCTURING',
  'AUDIT_TRACK_RECORD',
  'FILING_PREPARATION',
  'REGULATOR_REVIEW',
  'PRICING_ROADSHOW',
  'LISTED',
  'POST_IPO_MONITORING',
  'COMPLETED',
];

// ============================================================================
// Workstreams (parallel work tracks)
// ============================================================================

export const WorkstreamType = z.enum([
  'FINANCIAL_DIAGNOSIS',
  'AUDIT_PREPARATION',
  'INTERNAL_CONTROL',
  'LEGAL_STRUCTURING',
  'TAX_OPTIMIZATION',
  'PROSPECTUS_DRAFTING',
  'REGULATOR_QA',
  'VALUATION_MODELING',
  'INDUSTRY_ANALYSIS',
  'JURISDICTION_COMPLIANCE',
  'ROADSHOW_PREPARATION',
  'STOCK_PRICE_SIMULATION',
  'POST_IPO_REPORTING',
  'ESG_DISCLOSURE',
  'RELATED_PARTY_REVIEW',
]);
export type WorkstreamType = z.infer<typeof WorkstreamType>;

export const WorkstreamStatus = z.enum([
  'pending',
  'in_progress',
  'awaiting_review',
  'completed',
  'blocked',
  'cancelled',
]);
export type WorkstreamStatus = z.infer<typeof WorkstreamStatus>;

export const RiskLevel = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevel>;

// ============================================================================
// Project
// ============================================================================

export const IpoProject = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),

  company_legal_name: z.string().min(1).max(500),
  company_short_name: z.string().nullable().optional(),
  company_jurisdiction: z.string().nullable().optional(),
  company_website: z.string().url().nullable().optional(),
  company_description: z.string().nullable().optional(),

  target_market: TargetMarket,
  target_listing_date: z.string().nullable().optional(),
  proposed_ticker: z.string().nullable().optional(),

  industry: Industry,
  industry_subcategory: z.string().nullable().optional(),

  listing_structure: ListingStructure.nullable().optional(),
  stage: ProjectStage,

  last_fy_revenue_cents: z.bigint().nullable().optional(),
  last_fy_net_income_cents: z.bigint().nullable().optional(),
  last_fy_currency: z.string().length(3).default('USD'),
  estimated_valuation_cents: z.bigint().nullable().optional(),
  estimated_offer_size_cents: z.bigint().nullable().optional(),

  primary_advisor_firm: z.string().nullable().optional(),
  project_lead_user_id: z.string().uuid().nullable().optional(),
  confidentiality_level: z.enum(['STANDARD', 'RESTRICTED', 'STRICTLY_CONFIDENTIAL']).default('STANDARD'),

  status: z.enum(['active', 'on_hold', 'archived', 'cancelled']).default('active'),
  notes: z.string().nullable().optional(),

  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable().optional(),
});
export type IpoProject = z.infer<typeof IpoProject>;

export const CreateIpoProjectInput = IpoProject.pick({
  company_legal_name: true,
  company_short_name: true,
  company_jurisdiction: true,
  company_website: true,
  company_description: true,
  target_market: true,
  target_listing_date: true,
  proposed_ticker: true,
  industry: true,
  industry_subcategory: true,
  listing_structure: true,
  primary_advisor_firm: true,
  confidentiality_level: true,
  notes: true,
});
export type CreateIpoProjectInput = z.infer<typeof CreateIpoProjectInput>;

// ============================================================================
// Workstream
// ============================================================================

export const IpoWorkstream = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  workstream_type: WorkstreamType,
  owner_agent_id: z.string(),
  owner_user_id: z.string().uuid().nullable().optional(),
  status: WorkstreamStatus,
  blocking_stage: ProjectStage.nullable().optional(),
  progress_pct: z.number().int().min(0).max(100).default(0),
  findings_summary: z.string().nullable().optional(),
  risk_level: RiskLevel.nullable().optional(),
  started_at: z.string().nullable().optional(),
  expected_completion_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IpoWorkstream = z.infer<typeof IpoWorkstream>;

// ============================================================================
// Finding (audit-grade observation)
// ============================================================================

export const FindingCategory = z.enum([
  'FINANCIAL', 'TAX', 'LEGAL', 'ICFR', 'GOVERNANCE',
  'DISCLOSURE', 'VALUATION', 'INDUSTRY', 'OPERATIONAL',
  'ESG', 'RELATED_PARTY', 'OTHER',
]);
export type FindingCategory = z.infer<typeof FindingCategory>;

export const FindingSeverity = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type FindingSeverity = z.infer<typeof FindingSeverity>;

export const FindingStatus = z.enum([
  'open', 'in_remediation', 'remediated', 'accepted_risk', 'false_positive', 'closed',
]);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const IpoFinding = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  workstream_id: z.string().uuid().nullable().optional(),
  source_agent_id: z.string(),
  finding_category: FindingCategory,
  severity: FindingSeverity,
  title: z.string().min(1).max(500),
  description: z.string(),
  recommendation: z.string().nullable().optional(),
  impact_assessment: z.string().nullable().optional(),
  evidence_urls: z.array(z.string()).default([]),
  affected_entities: z.array(z.record(z.string(), z.unknown())).default([]),
  status: FindingStatus.default('open'),
  assigned_to: z.string().uuid().nullable().optional(),
  target_resolution_date: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  ai_confidence: z.number().min(0).max(1).nullable().optional(),
  requires_human_review: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IpoFinding = z.infer<typeof IpoFinding>;

// ============================================================================
// Filing Document
// ============================================================================

export const FilingDocType = z.enum([
  // SEC
  'SEC_S1', 'SEC_F1', 'SEC_S1A', 'SEC_424B4',
  'SEC_10K', 'SEC_10Q', 'SEC_8K',
  // HKEX
  'HKEX_A1', 'HKEX_PHIP', 'HKEX_PROSPECTUS', 'HKEX_LISTING_DOCUMENT',
  // Internal
  'PRE_IPO_DIAGNOSIS_REPORT',
  'AUDIT_READINESS_REPORT',
  'VALUATION_MEMO',
  'RISK_REGISTER',
  'MANAGEMENT_DISCUSSION',
  'RISK_FACTORS_SECTION',
  'BUSINESS_DESCRIPTION_SECTION',
  'USE_OF_PROCEEDS_SECTION',
  'COMPARABLE_COMPANY_ANALYSIS',
  'DCF_VALUATION_REPORT',
  'ROADSHOW_DECK',
  'COMMENT_LETTER_RESPONSE',
  'OTHER',
]);
export type FilingDocType = z.infer<typeof FilingDocType>;

export const FilingDocStatus = z.enum([
  'draft', 'in_review', 'revision_requested', 'approved', 'submitted', 'final', 'superseded',
]);
export type FilingDocStatus = z.infer<typeof FilingDocStatus>;

export const SignoffRole = z.enum([
  'AUDITOR', 'LAWYER', 'CFO', 'SPONSOR', 'COMPLIANCE', 'INDEPENDENT_DIR', 'OTHER',
]);
export type SignoffRole = z.infer<typeof SignoffRole>;

export const FilingDocumentSection = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.string().default(''),
  ai_drafted: z.boolean().default(false),
  drafting_agent_id: z.string().nullable().optional(),
  status: z.enum(['empty', 'draft', 'reviewed', 'final']).default('empty'),
  citations: z.array(z.string().uuid()).default([]),
  word_count: z.number().int().nonnegative().default(0),
});
export type FilingDocumentSection = z.infer<typeof FilingDocumentSection>;

export const FilingDocumentContent = z.object({
  sections: z.array(FilingDocumentSection).default([]),
  notes: z.string().nullable().optional(),
});
export type FilingDocumentContent = z.infer<typeof FilingDocumentContent>;

export const IpoFilingDocument = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  doc_type: FilingDocType,
  doc_title: z.string().nullable().optional(),
  version: z.number().int().positive().default(1),
  is_current: z.boolean().default(true),
  content: FilingDocumentContent,
  content_word_count: z.number().int().nonnegative().default(0),
  ai_drafted: z.boolean().default(false),
  drafting_agent_id: z.string().nullable().optional(),
  based_on_template: z.string().nullable().optional(),
  status: FilingDocStatus.default('draft'),
  requires_signoffs: z.array(SignoffRole).default([]),
  signoffs_complete: z.boolean().default(false),
  submitted_to: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().uuid().nullable().optional(),
});
export type IpoFilingDocument = z.infer<typeof IpoFilingDocument>;

// ============================================================================
// Review Signoff
// ============================================================================

export const SignoffStatus = z.enum([
  'pending', 'approved', 'rejected', 'revision_requested', 'recused',
]);
export type SignoffStatus = z.infer<typeof SignoffStatus>;

export const ReviewSignoff = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  artifact_type: z.enum(['FILING_DOCUMENT', 'FINDING', 'VALUATION_MODEL', 'COMMENT_RESPONSE']),
  artifact_id: z.string().uuid(),
  artifact_version: z.number().int().positive().default(1),
  reviewer_user_id: z.string().uuid(),
  reviewer_role: SignoffRole,
  reviewer_firm: z.string().nullable().optional(),
  status: SignoffStatus,
  decision_rationale: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
  requested_at: z.string(),
  decided_at: z.string().nullable().optional(),
  deadline_at: z.string().nullable().optional(),
});
export type ReviewSignoff = z.infer<typeof ReviewSignoff>;

// ============================================================================
// Citations
// ============================================================================

export const AiCitation = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  source_agent_id: z.string(),
  source_task_id: z.string().uuid().nullable().optional(),
  claim_artifact_type: z.enum([
    'FILING_DOCUMENT_SECTION', 'FINDING', 'VALUATION_INPUT', 'COMMENT_RESPONSE', 'CHAT_MESSAGE',
  ]).nullable().optional(),
  claim_artifact_id: z.string().uuid().nullable().optional(),
  claim_text: z.string(),
  cited_regulation_id: z.string().uuid().nullable().optional(),
  cited_chunk_id: z.string().uuid().nullable().optional(),
  quoted_text: z.string().nullable().optional(),
  citation_format: z.string().nullable().optional(),
  relevance_score: z.number().min(0).max(1).nullable().optional(),
  verified_by_human: z.boolean().default(false),
  verified_by_user_id: z.string().uuid().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  created_at: z.string(),
});
export type AiCitation = z.infer<typeof AiCitation>;

// ============================================================================
// Valuation
// ============================================================================

export const ValuationModelType = z.enum([
  'DCF',
  'COMPARABLE_COMPANY',
  'PRECEDENT_TRANSACTION',
  'SUM_OF_THE_PARTS',
  'DIVIDEND_DISCOUNT',
  'REAL_OPTIONS',
  'BOOK_VALUE',
  'BLENDED',
]);
export type ValuationModelType = z.infer<typeof ValuationModelType>;

export const ValuationScenario = z.enum(['BASE', 'BULL', 'BEAR', 'STRESS', 'CUSTOM']);
export type ValuationScenario = z.infer<typeof ValuationScenario>;

export const ValuationModel = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid(),
  model_type: ValuationModelType,
  scenario: ValuationScenario,
  inputs: z.record(z.string(), z.unknown()),
  outputs: z.record(z.string(), z.unknown()),
  assumptions: z.string().nullable().optional(),
  enterprise_value_cents: z.bigint().nullable().optional(),
  equity_value_cents: z.bigint().nullable().optional(),
  implied_share_price_cents: z.bigint().nullable().optional(),
  implied_pe_ratio: z.number().nullable().optional(),
  implied_ev_revenue: z.number().nullable().optional(),
  implied_ev_ebitda: z.number().nullable().optional(),
  built_by_agent_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'rejected', 'superseded']).default('draft'),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ValuationModel = z.infer<typeof ValuationModel>;

// ============================================================================
// Stock Simulation
// ============================================================================

export const StockSimulationMethod = z.enum([
  'MONTE_CARLO_GBM',
  'MONTE_CARLO_JUMP_DIFFUSION',
  'GARCH',
  'HISTORICAL_BOOTSTRAP',
  'SCENARIO_BASED',
]);
export type StockSimulationMethod = z.infer<typeof StockSimulationMethod>;

export const StockSimulationSummary = z.object({
  mean_terminal_price_cents: z.bigint(),
  p5_terminal_price_cents: z.bigint(),
  p25_terminal_price_cents: z.bigint(),
  p50_terminal_price_cents: z.bigint(),
  p75_terminal_price_cents: z.bigint(),
  p95_terminal_price_cents: z.bigint(),
  prob_below_offer: z.number().min(0).max(1),
  prob_above_offer_plus_30: z.number().min(0).max(1),
  max_drawdown_p95: z.number().min(0).max(1),
});
export type StockSimulationSummary = z.infer<typeof StockSimulationSummary>;

// ============================================================================
// Regulator Q&A
// ============================================================================

export const RegulatorQaSource = z.enum([
  'SEC_COMMENT_LETTER',
  'HKEX_FIRST_COMMENT',
  'HKEX_HEARING',
  'HKEX_POST_HEARING',
  'INTERNAL_MOCK_QA',
  'OTHER',
]);
export type RegulatorQaSource = z.infer<typeof RegulatorQaSource>;

export const RegulatorQaStatus = z.enum([
  'open', 'drafting', 'in_review', 'submitted', 'cleared', 'resubmit_required',
]);
export type RegulatorQaStatus = z.infer<typeof RegulatorQaStatus>;

// ============================================================================
// Industry benchmark
// ============================================================================

export const IndustryBenchmark = z.object({
  id: z.string().uuid(),
  industry: Industry,
  sub_industry: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  metric_key: z.string(),
  metric_label: z.string(),
  metric_unit: z.string().nullable().optional(),
  p10: z.number().nullable().optional(),
  p25: z.number().nullable().optional(),
  p50: z.number().nullable().optional(),
  p75: z.number().nullable().optional(),
  p90: z.number().nullable().optional(),
  mean: z.number().nullable().optional(),
  sample_size: z.number().int().nullable().optional(),
  as_of_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type IndustryBenchmark = z.infer<typeof IndustryBenchmark>;

// ============================================================================
// AI Provider
// ============================================================================

export const AiProviderCode = z.enum([
  'TOKENHOT', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'AZURE_OPENAI', 'GOOGLE_GEMINI', 'CUSTOM',
]);
export type AiProviderCode = z.infer<typeof AiProviderCode>;

export const AiProvider = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  provider_code: AiProviderCode,
  display_name: z.string(),
  base_url: z.string().nullable().optional(),
  api_key_last4: z.string().length(4).nullable().optional(),
  default_model: z.string().nullable().optional(),
  embedding_model: z.string().nullable().optional(),
  is_default: z.boolean().default(false),
  enabled: z.boolean().default(true),
  monthly_budget_cents: z.bigint().nullable().optional(),
  monthly_spend_cents: z.bigint().default(0n),
  rate_limit_rpm: z.number().int().nullable().optional(),
  allowed_agent_categories: z.array(z.string()).default([]),
  last_health_check_at: z.string().nullable().optional(),
  last_health_status: z.enum(['healthy', 'degraded', 'down', 'unknown']).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AiProvider = z.infer<typeof AiProvider>;
