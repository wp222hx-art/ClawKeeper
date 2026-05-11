// file: dashboard/src/lib/ipo-api.ts
// description: IPOPilot-specific API client. Wraps the /api/ipo/* endpoints
//              exposed by the backend in a typed surface for React Query.

// In dev (vite), use a relative base so requests go through the vite proxy
// (defined in dashboard/vite.config.ts), which is the only safe path when the
// dashboard is served from a sandbox/public URL — the browser cannot reach
// `http://localhost:9100` directly. Set VITE_API_URL only for production builds
// that point to a deployed backend.
const BASE_URL = import.meta.env.VITE_API_URL || '';

function get_headers(): HeadersInit {
  const token = localStorage.getItem('clawkeeper_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function fetch_json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...get_headers(), ...(init.headers || {}) },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Domain types (kept loose — backend Zod schema is the source of truth)
// ---------------------------------------------------------------------------
export type TargetMarket =
  | 'SEC_NASDAQ_GS' | 'SEC_NASDAQ_GM' | 'SEC_NASDAQ_CM'
  | 'SEC_NYSE' | 'SEC_NYSE_AMERICAN'
  | 'HKEX_MAIN' | 'HKEX_GEM';

export type Industry = 'SAAS' | 'BIOPHARMA' | 'CLEAN_ENERGY' | 'OTHER';

export type ListingStructure =
  | 'DIRECT' | 'VIE' | 'RED_CHIP' | 'SPAC_MERGER'
  | 'CARVE_OUT' | 'DUAL_PRIMARY' | 'SECONDARY_LISTING';

export type ProjectStage =
  | 'PRE_IPO_DIAGNOSIS' | 'READINESS_REMEDIATION' | 'RESTRUCTURING'
  | 'AUDIT_TRACK_RECORD' | 'FILING_PREPARATION' | 'REGULATOR_REVIEW'
  | 'PRICING_ROADSHOW' | 'LISTED' | 'POST_IPO_MONITORING'
  | 'WITHDRAWN' | 'COMPLETED';

export interface IpoProject {
  id: string;
  company_legal_name: string;
  company_short_name?: string | null;
  target_market: TargetMarket;
  industry: Industry;
  listing_structure: ListingStructure | null;
  stage: ProjectStage;
  status: string;
  proposed_ticker?: string | null;
  target_listing_date?: string | null;
  primary_advisor_firm?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  company_legal_name: string;
  company_short_name?: string;
  company_jurisdiction?: string;
  company_website?: string;
  company_description?: string;
  target_market: TargetMarket;
  target_listing_date?: string;
  proposed_ticker?: string;
  industry: Industry;
  industry_subcategory?: string;
  listing_structure?: ListingStructure;
  primary_advisor_firm?: string;
  confidentiality_level?: 'STANDARD' | 'RESTRICTED' | 'STRICTLY_CONFIDENTIAL';
  notes?: string;
}

export interface PlanWorkstream {
  workstream_id: string;
  workstream_type: string;
  display_name: string;
  lead_agent_id: string;
  active_worker_count: number;
  is_mandatory: boolean;
  required_signoffs: string[];
}

export interface PlanStage {
  stage: ProjectStage;
  display_name: string;
  workstreams: PlanWorkstream[] | number; // POST returns full, GET dashboard returns count
}

export interface ProjectPlanSummary {
  plan_id: string;
  total_workstreams: number;
  total_active_agents: number;
  estimated_total_duration_weeks: [number, number];
  stages: PlanStage[];
}

export interface DashboardPayload {
  project: IpoProject;
  current_stage: ProjectStage;
  plan_summary: ProjectPlanSummary;
  workstreams: Array<{
    id: string;
    workstream_type: string;
    status: string;
    lead_agent_id: string | null;
    risk_level: string | null;
    blocker_count: number;
    started_at: string | null;
    completed_at: string | null;
  }>;
  findings_by_severity: Array<{ severity: string; n: number }>;
  documents_by_status: Array<{ status: string; n: number }>;
  signoffs_pending: Array<{
    id: string; document_id: string; reviewer_role: string;
    status: string; requested_at: string;
  }>;
}

export interface IpoAgentCatalogItem {
  id: string;
  display_name: string;
  display_name_zh: string;
  tier: string;
  category: string;
  description: string;
  description_zh: string;
  capabilities: string[];
  citation_required: boolean;
  required_signoff_for_outputs: string[];
  has_skill_files: boolean;
  knowledge_acquisition: {
    discovery_method: 'llm_curated' | 'static_curated' | 'rag_only';
    jurisdictions: string[];
    scope_in: string[];
    scope_out: string[];
  } | null;
}

export interface AgentSkillBundle {
  agent_id: string;
  agent_md_path: string;
  agent_md: string | null;
  agent_md_bytes: number;
  skills: Array<{ path: string; content: string | null; bytes: number }>;
  resolved_at: string;
}

export interface SkillCoverageReport {
  total_agents: number;
  agents_with_agent_md: number;
  agents_missing_agent_md: string[];
  total_skill_refs: number;
  unique_skills: number;
  skills_with_content: number;
  skills_missing: string[];
}

export interface RegulationItem {
  id: string;
  code: string;
  title: string;
  jurisdiction: 'US' | 'HK' | 'INTL';
  authority: string;
  version?: string | null;
  effective_date?: string | null;
  source_url?: string | null;
  summary?: string | null;
  tags?: string[] | null;
}

export interface RegulationSearchResult {
  strategy: 'vector' | 'text';
  query: string;
  count: number;
  results: Array<{
    id: string;
    regulation_id: string;
    section: string | null;
    heading: string | null;
    content: string;
    score: number;
    code: string;
    title: string;
    jurisdiction: string;
    authority: string;
    source_url?: string | null;
  }>;
}

export interface ProviderLiveStatus {
  code: string;
  display_name: string;
  is_default: boolean;
  default_chat_model: string;
  default_embedding_model: string | null;
  base_url_redacted: string;
  registered_at: string;
}

export interface ModelInfo {
  id: string;
  display_name?: string;
  family?: string;
  capability: 'chat' | 'embedding' | 'image' | 'audio' | 'rerank' | 'unknown';
  context_window?: number | null;
  owned_by?: string | null;
  created_at?: string | null;
}

export interface ListModelsResponse {
  provider: 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';
  count: number;
  models: ModelInfo[];
  fetched_at: string;
}

export interface AgentRunRequest {
  prompt: string;
  locale?: 'en' | 'zh';
  context?: string;
  provider_code?: 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';
  model?: string;
  temperature?: number;
  max_tokens?: number;
  /** Listing jurisdiction (PFS Layer 1 — selects the format standard). */
  target_market?: TargetMarket;
  /** Section code, e.g. 'risk_factors', 'mdna' — see PFS_REGISTRY. */
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
  compliance_score: number;
}

export interface AgentRunResult {
  agent_id: string;
  agent_display_name: string;
  agent_display_name_zh: string;
  tier: string;
  category: string;
  provider: 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK' | 'NONE';
  model: string;
  mode: 'live' | 'dry_run';
  output: string;
  finish_reason: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  citation_required: boolean;
  required_signoffs: string[];
  warnings: string[];
  ms_elapsed: number;
  started_at: string;
  pfs_report?: PfsReport;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------
export const ipo_api = {
  // Projects
  list_projects: () => fetch_json<{ projects: IpoProject[]; count: number }>('/api/ipo/projects'),
  get_project: (id: string) => fetch_json<{ project: IpoProject }>(`/api/ipo/projects/${id}`),
  create_project: (input: CreateProjectInput) =>
    fetch_json<{ project: IpoProject; plan: ProjectPlanSummary }>('/api/ipo/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  get_dashboard: (id: string) => fetch_json<DashboardPayload>(`/api/ipo/projects/${id}/dashboard`),
  request_transition: (id: string, target_stage: ProjectStage) =>
    fetch_json<{ allowed: boolean; target_stage: ProjectStage | null; blockers: string[] }>(
      `/api/ipo/projects/${id}/transition`,
      { method: 'POST', body: JSON.stringify({ target_stage }) },
    ),

  // Signoffs
  list_signoffs: (project_id?: string, status?: string) => {
    const q = new URLSearchParams();
    if (project_id) q.set('project_id', project_id);
    if (status) q.set('status', status);
    return fetch_json<{ signoffs: Array<Record<string, unknown>>; count: number }>(`/api/ipo/signoffs?${q}`);
  },
  decide_signoff: (id: string, status: 'APPROVED' | 'REJECTED' | 'WAIVED', notes?: string) =>
    fetch_json(`/api/ipo/signoffs/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    }),

  // Regulations / RAG
  list_regulations: (jurisdiction?: 'US' | 'HK' | 'INTL') => {
    const q = jurisdiction ? `?jurisdiction=${jurisdiction}` : '';
    return fetch_json<{ regulations: RegulationItem[]; count: number }>(`/api/ipo/regulations${q}`);
  },
  search_regulations: (query: string, opts?: { jurisdiction?: 'US' | 'HK' | 'INTL'; limit?: number }) =>
    fetch_json<RegulationSearchResult>('/api/ipo/regulations/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...opts }),
    }),

  // Providers
  list_providers: () => fetch_json<{
    live: ProviderLiveStatus[];
    persisted: Array<Record<string, unknown>>;
    configured: boolean;
  }>('/api/ipo/providers'),
  register_provider: (cfg: {
    code: 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';
    api_key: string;
    base_url?: string;
    default_chat_model?: string;
    default_embedding_model?: string;
    display_name?: string;
    make_default?: boolean;
    persist?: boolean;
  }) => fetch_json('/api/ipo/providers', { method: 'POST', body: JSON.stringify(cfg) }),
  set_default_provider: (code: string) =>
    fetch_json('/api/ipo/providers/default', { method: 'POST', body: JSON.stringify({ code }) }),
  health_check_providers: () =>
    fetch_json('/api/ipo/providers/health', { method: 'POST' }),
  list_provider_models: (code: 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK') =>
    fetch_json<ListModelsResponse>(`/api/ipo/providers/${code}/models`),
  probe_provider_models: (cfg: {
    code: 'TOKENHOT' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK';
    api_key: string;
    base_url?: string;
  }) => fetch_json<ListModelsResponse>('/api/ipo/providers/probe-models', {
    method: 'POST',
    body: JSON.stringify(cfg),
  }),

  // Agents
  list_agents: (filters?: { tier?: string; category?: string }) => {
    const q = new URLSearchParams();
    if (filters?.tier) q.set('tier', filters.tier);
    if (filters?.category) q.set('category', filters.category);
    return fetch_json<{ count: number; agents: IpoAgentCatalogItem[] }>(`/api/ipo/agents?${q}`);
  },
  get_agent: (id: string) => fetch_json<{ agent: IpoAgentCatalogItem }>(`/api/ipo/agents/${id}`),
  get_agent_bundle: (id: string) => fetch_json<AgentSkillBundle>(`/api/ipo/agents/${id}/bundle`),
  get_skill_coverage: () => fetch_json<SkillCoverageReport>('/api/ipo/agents/coverage'),
  run_agent: (id: string, body: AgentRunRequest) =>
    fetch_json<{ ok: true; result: AgentRunResult }>(`/api/ipo/agents/${id}/run`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
export const STAGE_LABELS: Record<ProjectStage, string> = {
  PRE_IPO_DIAGNOSIS:     '1. Pre-IPO Diagnosis',
  READINESS_REMEDIATION: '2. Readiness Remediation',
  RESTRUCTURING:         '3. Restructuring',
  AUDIT_TRACK_RECORD:    '4. Audit & Track Record',
  FILING_PREPARATION:    '5. Filing Preparation',
  REGULATOR_REVIEW:      '6. Regulator Review',
  PRICING_ROADSHOW:      '7. Pricing & Roadshow',
  LISTED:                '8. Listed',
  POST_IPO_MONITORING:   '9. Post-IPO Monitoring',
  WITHDRAWN:             '✕ Withdrawn',
  COMPLETED:             '✓ Completed',
};

export const STAGE_ORDER: ProjectStage[] = [
  'PRE_IPO_DIAGNOSIS', 'READINESS_REMEDIATION', 'RESTRUCTURING',
  'AUDIT_TRACK_RECORD', 'FILING_PREPARATION', 'REGULATOR_REVIEW',
  'PRICING_ROADSHOW', 'LISTED', 'POST_IPO_MONITORING',
];

export const MARKET_LABELS: Record<TargetMarket, string> = {
  SEC_NASDAQ_GS:     'Nasdaq Global Select',
  SEC_NASDAQ_GM:     'Nasdaq Global Market',
  SEC_NASDAQ_CM:     'Nasdaq Capital Market',
  SEC_NYSE:          'NYSE',
  SEC_NYSE_AMERICAN: 'NYSE American',
  HKEX_MAIN:         'HKEX Main Board',
  HKEX_GEM:          'HKEX GEM',
};

export const INDUSTRY_LABELS: Record<Industry, string> = {
  SAAS:         'SaaS',
  BIOPHARMA:    'BioPharma',
  CLEAN_ENERGY: 'Clean Energy',
  OTHER:        'Other',
};
