// file: src/ipo/orchestration/stages.ts
// description: IPO project stage gate definitions — sequential lifecycle with
//              required workstreams, exit criteria, and required signoff roles
//              before transitioning to the next stage.
// reference: db/ipo_schema.sql (ipo_projects.stage), src/ipo/types/index.ts

import type {
  ProjectStage,
  WorkstreamType,
  SignoffRole,
} from '../types/index';

export interface StageDefinition {
  stage: ProjectStage;
  display_name: string;
  description: string;
  typical_duration_weeks: [number, number];

  /** Workstreams that must reach 'completed' before this stage can exit */
  required_workstreams: WorkstreamType[];

  /** Workstreams that may run in parallel during this stage */
  optional_workstreams: WorkstreamType[];

  /** Exit criteria — human-readable checklist for the stage gate */
  exit_criteria: string[];

  /** Signoff roles required to advance to next stage */
  required_signoff_roles: SignoffRole[];

  /** Next stage(s) — usually one, except branches like WITHDRAWN */
  next_stages: ProjectStage[];
}

export const IPO_STAGE_DEFINITIONS: Record<ProjectStage, StageDefinition> = {
  PRE_IPO_DIAGNOSIS: {
    stage: 'PRE_IPO_DIAGNOSIS',
    display_name: 'Pre-IPO Diagnosis',
    description:
      'Comprehensive readiness check across financial, ICFR, governance, and disclosure dimensions. Outputs a gap report and remediation plan.',
    typical_duration_weeks: [4, 8],
    required_workstreams: [
      'FINANCIAL_DIAGNOSIS',
      'INTERNAL_CONTROL',
      'INDUSTRY_ANALYSIS',
      'JURISDICTION_COMPLIANCE',
    ],
    optional_workstreams: ['RELATED_PARTY_REVIEW', 'ESG_DISCLOSURE'],
    exit_criteria: [
      'Pre-IPO diagnosis report issued and reviewed',
      'All HIGH/CRITICAL findings have an assigned remediation owner',
      'Industry KPI gap-to-benchmark documented',
      'Listing market suitability confirmed',
    ],
    required_signoff_roles: ['CFO', 'COMPLIANCE'],
    next_stages: ['READINESS_REMEDIATION', 'WITHDRAWN'],
  },

  READINESS_REMEDIATION: {
    stage: 'READINESS_REMEDIATION',
    display_name: 'Readiness Remediation',
    description:
      'Close gaps identified in Pre-IPO Diagnosis: process redesign, ICFR controls, restated historicals, governance reforms.',
    typical_duration_weeks: [12, 32],
    required_workstreams: [
      'INTERNAL_CONTROL',
      'FINANCIAL_DIAGNOSIS',
    ],
    optional_workstreams: [
      'TAX_OPTIMIZATION',
      'RELATED_PARTY_REVIEW',
      'ESG_DISCLOSURE',
    ],
    exit_criteria: [
      'All HIGH/CRITICAL findings remediated or formally accepted',
      'ICFR control matrix designed and walkthroughs passed',
      'Audit committee formed with required independent directors',
      'Whistleblower / code of ethics policies adopted',
    ],
    required_signoff_roles: ['CFO', 'AUDITOR', 'COMPLIANCE'],
    next_stages: ['RESTRUCTURING', 'AUDIT_TRACK_RECORD'],
  },

  RESTRUCTURING: {
    stage: 'RESTRUCTURING',
    display_name: 'Legal & Tax Restructuring',
    description:
      'Establish listing vehicle, complete VIE / red-chip / direct architecture, settle pre-IPO investments, lock cap table.',
    typical_duration_weeks: [8, 24],
    required_workstreams: ['LEGAL_STRUCTURING', 'TAX_OPTIMIZATION'],
    optional_workstreams: ['RELATED_PARTY_REVIEW'],
    exit_criteria: [
      'Listing vehicle incorporated and operational',
      'Capital structure finalized with pre-IPO investors',
      'Cross-border tax memo issued',
      'All material subsidiaries transferred under listco',
    ],
    required_signoff_roles: ['LAWYER', 'CFO'],
    next_stages: ['AUDIT_TRACK_RECORD'],
  },

  AUDIT_TRACK_RECORD: {
    stage: 'AUDIT_TRACK_RECORD',
    display_name: 'Audited Track Record',
    description:
      'Complete multi-year PCAOB / HKICPA audited financials covering the required track record period.',
    typical_duration_weeks: [16, 36],
    required_workstreams: ['AUDIT_PREPARATION', 'INTERNAL_CONTROL'],
    optional_workstreams: ['FINANCIAL_DIAGNOSIS'],
    exit_criteria: [
      'Track record period audits issued with unqualified opinion',
      'No material weaknesses outstanding in ICFR',
      'Auditor consent letter prepared',
      'Quarterly stub period (if any) reviewed',
    ],
    required_signoff_roles: ['AUDITOR', 'CFO'],
    next_stages: ['FILING_PREPARATION'],
  },

  FILING_PREPARATION: {
    stage: 'FILING_PREPARATION',
    display_name: 'Filing Preparation',
    description:
      'Draft S-1 / F-1 (US) or A1 / Listing Document (HK), valuation models, and roadshow narrative.',
    typical_duration_weeks: [8, 16],
    required_workstreams: [
      'PROSPECTUS_DRAFTING',
      'VALUATION_MODELING',
      'JURISDICTION_COMPLIANCE',
    ],
    optional_workstreams: ['INDUSTRY_ANALYSIS', 'ESG_DISCLOSURE'],
    exit_criteria: [
      'Initial filing draft reviewed by all required roles',
      'Risk factors comprehensively cover business / legal / market risks',
      'Use-of-proceeds narrative consistent with valuation model',
      'All financial disclosures tie to audited financials',
    ],
    required_signoff_roles: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'],
    next_stages: ['REGULATOR_REVIEW'],
  },

  REGULATOR_REVIEW: {
    stage: 'REGULATOR_REVIEW',
    display_name: 'Regulator Review',
    description:
      'Respond to SEC comment letters or HKEX hearing comments; iterate on filing until clearance.',
    typical_duration_weeks: [12, 32],
    required_workstreams: ['REGULATOR_QA', 'PROSPECTUS_DRAFTING'],
    optional_workstreams: ['VALUATION_MODELING'],
    exit_criteria: [
      'All regulator comments cleared',
      'Final amended filing reflects every cleared response',
      'No outstanding material amendments to financial statements',
    ],
    required_signoff_roles: ['LAWYER', 'AUDITOR', 'CFO', 'SPONSOR'],
    next_stages: ['PRICING_ROADSHOW', 'WITHDRAWN'],
  },

  PRICING_ROADSHOW: {
    stage: 'PRICING_ROADSHOW',
    display_name: 'Pricing & Roadshow',
    description:
      'Bookbuilding, investor education, roadshow execution, pricing committee, allocations.',
    typical_duration_weeks: [2, 4],
    required_workstreams: [
      'ROADSHOW_PREPARATION',
      'VALUATION_MODELING',
      'STOCK_PRICE_SIMULATION',
    ],
    optional_workstreams: [],
    exit_criteria: [
      'Roadshow Q&A bank prepared and rehearsed',
      'Comparable-company and DCF valuations within underwriter range',
      'Stock price scenarios simulated for offer pricing decision',
      'Pricing committee approval documented',
    ],
    required_signoff_roles: ['CFO', 'SPONSOR'],
    next_stages: ['LISTED'],
  },

  LISTED: {
    stage: 'LISTED',
    display_name: 'Listed',
    description: 'First day of trading. Lock-up period commences.',
    typical_duration_weeks: [0, 1],
    required_workstreams: [],
    optional_workstreams: ['POST_IPO_REPORTING'],
    exit_criteria: ['Trading commenced', 'First-day disclosure filings made'],
    required_signoff_roles: [],
    next_stages: ['POST_IPO_MONITORING'],
  },

  POST_IPO_MONITORING: {
    stage: 'POST_IPO_MONITORING',
    display_name: 'Post-IPO Monitoring',
    description:
      'Quarterly / interim reporting, lock-up tracking, ongoing disclosure obligations, ICFR sustainment.',
    typical_duration_weeks: [52, 156],
    required_workstreams: ['POST_IPO_REPORTING', 'INTERNAL_CONTROL'],
    optional_workstreams: ['ESG_DISCLOSURE', 'STOCK_PRICE_SIMULATION'],
    exit_criteria: [
      'First annual / interim filing on time',
      'Lock-up release events tracked',
      'No material weaknesses identified',
    ],
    required_signoff_roles: ['CFO', 'AUDITOR'],
    next_stages: ['COMPLETED'],
  },

  WITHDRAWN: {
    stage: 'WITHDRAWN',
    display_name: 'Withdrawn',
    description: 'Project withdrawn before listing.',
    typical_duration_weeks: [0, 0],
    required_workstreams: [],
    optional_workstreams: [],
    exit_criteria: [],
    required_signoff_roles: [],
    next_stages: [],
  },

  COMPLETED: {
    stage: 'COMPLETED',
    display_name: 'Completed',
    description: 'Engagement closed.',
    typical_duration_weeks: [0, 0],
    required_workstreams: [],
    optional_workstreams: [],
    exit_criteria: [],
    required_signoff_roles: [],
    next_stages: [],
  },
};

/**
 * Validate whether a project can transition from current stage to target stage
 * by checking that all required workstreams are completed and all required
 * signoff roles have approved.
 */
export interface StageTransitionContext {
  current_stage: ProjectStage;
  target_stage: ProjectStage;
  workstream_statuses: Record<WorkstreamType, string>;
  signoff_approvals: Record<SignoffRole, boolean>;
}

export interface StageTransitionResult {
  allowed: boolean;
  blockers: string[];
}

export function validate_stage_transition(
  ctx: StageTransitionContext
): StageTransitionResult {
  const blockers: string[] = [];
  const def = IPO_STAGE_DEFINITIONS[ctx.current_stage];

  if (!def.next_stages.includes(ctx.target_stage)) {
    blockers.push(
      `Invalid transition: ${ctx.current_stage} → ${ctx.target_stage}. Allowed: ${def.next_stages.join(', ')}`
    );
    return { allowed: false, blockers };
  }

  for (const ws of def.required_workstreams) {
    const status = ctx.workstream_statuses[ws];
    if (status !== 'completed') {
      blockers.push(`Workstream ${ws} is ${status ?? 'not started'}, must be completed`);
    }
  }

  for (const role of def.required_signoff_roles) {
    if (!ctx.signoff_approvals[role]) {
      blockers.push(`Signoff missing from role ${role}`);
    }
  }

  return { allowed: blockers.length === 0, blockers };
}
