-- =============================================================================
-- IPOPilot Database Schema
-- =============================================================================
-- Multi-jurisdiction IPO advisory platform built on top of the ClawKeeper
-- multi-tenant + RLS + audit infrastructure.
--
-- Scope (MVP):
--   - Markets: SEC (Nasdaq/NYSE), HKEX (Main Board / GEM)
--   - Industries: SaaS, BioPharma, Clean Energy
--   - Workstreams: Pre-IPO diagnosis, audit prep, restructuring,
--                  prospectus drafting, regulator Q&A, valuation,
--                  roadshow prep, post-IPO monitoring
--
-- Design principles:
--   1. AI Co-Pilot — every AI-drafted artifact MUST go through
--      review_signoffs before being marked final.
--   2. Citation enforcement — every regulation-related AI output is
--      tracked in ai_citations linking to source_chunk_id.
--   3. Tenant isolation via RLS (delegates to current_tenant_id()).
--   4. Append-only audit log via log_audit_entry() trigger.
-- =============================================================================

-- pgvector for RAG knowledge base
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 1. IPO Projects
-- =============================================================================
-- A "project" represents a single company's IPO journey on a specific market.
-- The same legal entity can have multiple projects if pursuing dual listing
-- (e.g., HKEX primary + NASDAQ secondary).

CREATE TABLE IF NOT EXISTS ipo_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Company identity
    company_legal_name VARCHAR(500) NOT NULL,
    company_short_name VARCHAR(255),
    company_jurisdiction VARCHAR(100), -- Cayman / Delaware / Hong Kong / PRC ...
    company_website VARCHAR(500),
    company_description TEXT,

    -- Listing target
    target_market VARCHAR(50) NOT NULL CHECK (target_market IN (
        'SEC_NASDAQ_GS',   -- Nasdaq Global Select
        'SEC_NASDAQ_GM',   -- Nasdaq Global Market
        'SEC_NASDAQ_CM',   -- Nasdaq Capital Market
        'SEC_NYSE',
        'SEC_NYSE_AMERICAN',
        'HKEX_MAIN',       -- HKEX Main Board
        'HKEX_GEM'         -- HKEX GEM
    )),
    target_listing_date DATE,
    proposed_ticker VARCHAR(10),

    -- Industry classification
    industry VARCHAR(50) NOT NULL CHECK (industry IN (
        'SAAS',
        'BIOPHARMA',
        'CLEAN_ENERGY',
        'OTHER'
    )),
    industry_subcategory VARCHAR(100),

    -- Listing structure
    listing_structure VARCHAR(50) CHECK (listing_structure IN (
        'DIRECT',          -- Direct listing of operating entity
        'VIE',             -- Variable Interest Entity (PRC operating)
        'RED_CHIP',        -- Red-chip structure
        'SPAC_MERGER',     -- De-SPAC
        'CARVE_OUT',       -- Spin-off / carve-out
        'DUAL_PRIMARY',
        'SECONDARY_LISTING'
    )),

    -- Stage gate
    stage VARCHAR(50) NOT NULL DEFAULT 'PRE_IPO_DIAGNOSIS' CHECK (stage IN (
        'PRE_IPO_DIAGNOSIS',     -- Stage 1: Financial / governance health check
        'READINESS_REMEDIATION', -- Stage 2: Fix gaps identified in stage 1
        'RESTRUCTURING',         -- Stage 3: Legal/tax restructuring
        'AUDIT_TRACK_RECORD',    -- Stage 4: Multi-year audited financials
        'FILING_PREPARATION',    -- Stage 5: Draft S-1 / A1 prospectus
        'REGULATOR_REVIEW',      -- Stage 6: SEC comments / HKEX hearing
        'PRICING_ROADSHOW',      -- Stage 7: Pricing & roadshow
        'LISTED',
        'POST_IPO_MONITORING',
        'WITHDRAWN',
        'COMPLETED'
    )),

    -- Headline financial snapshot (refreshed periodically)
    last_fy_revenue_cents BIGINT,
    last_fy_net_income_cents BIGINT,
    last_fy_currency CHAR(3) DEFAULT 'USD',
    estimated_valuation_cents BIGINT,
    estimated_offer_size_cents BIGINT,

    -- Project metadata
    primary_advisor_firm VARCHAR(255),       -- Lead audit / sponsor firm
    project_lead_user_id UUID REFERENCES users(id),
    confidentiality_level VARCHAR(50) DEFAULT 'STANDARD' CHECK (confidentiality_level IN (
        'STANDARD', 'RESTRICTED', 'STRICTLY_CONFIDENTIAL'
    )),

    -- State
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'on_hold', 'archived', 'cancelled'
    )),
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_ipo_projects_tenant ON ipo_projects(tenant_id);
CREATE INDEX idx_ipo_projects_stage ON ipo_projects(stage);
CREATE INDEX idx_ipo_projects_market ON ipo_projects(target_market);
CREATE INDEX idx_ipo_projects_industry ON ipo_projects(industry);
CREATE INDEX idx_ipo_projects_status ON ipo_projects(status);

-- =============================================================================
-- 2. Workstreams (parallel work tracks within a project)
-- =============================================================================
-- A workstream is a long-running parallel work-track owned by one
-- functional Lead agent (e.g., FinancialDiagnosisLead).

CREATE TABLE IF NOT EXISTS ipo_workstreams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,

    workstream_type VARCHAR(50) NOT NULL CHECK (workstream_type IN (
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
        'RELATED_PARTY_REVIEW'
    )),

    -- Lead agent owning this workstream
    owner_agent_id VARCHAR(100) NOT NULL,
    owner_user_id UUID REFERENCES users(id),

    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'awaiting_review', 'completed', 'blocked', 'cancelled'
    )),

    -- Stage gate this workstream contributes to (optional)
    blocking_stage VARCHAR(50),

    progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
    findings_summary TEXT,          -- High-level rollup, AI-drafted
    risk_level VARCHAR(20) CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),

    started_at TIMESTAMPTZ,
    expected_completion_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ipo_workstreams_tenant ON ipo_workstreams(tenant_id);
CREATE INDEX idx_ipo_workstreams_project ON ipo_workstreams(project_id);
CREATE INDEX idx_ipo_workstreams_type ON ipo_workstreams(workstream_type);
CREATE INDEX idx_ipo_workstreams_status ON ipo_workstreams(status);

-- =============================================================================
-- 3. Findings (audit-grade observations produced by agents)
-- =============================================================================
-- Each agent emits findings into this table. Findings are the atomic units
-- aggregated into the project's risk register and into final reports.

CREATE TABLE IF NOT EXISTS ipo_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,
    workstream_id UUID REFERENCES ipo_workstreams(id) ON DELETE SET NULL,

    -- Source
    source_agent_id VARCHAR(100) NOT NULL,
    finding_category VARCHAR(50) NOT NULL CHECK (finding_category IN (
        'FINANCIAL', 'TAX', 'LEGAL', 'ICFR', 'GOVERNANCE',
        'DISCLOSURE', 'VALUATION', 'INDUSTRY', 'OPERATIONAL',
        'ESG', 'RELATED_PARTY', 'OTHER'
    )),

    severity VARCHAR(20) NOT NULL CHECK (severity IN (
        'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    )),

    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    impact_assessment TEXT,

    -- Evidence linkage
    evidence_urls JSONB DEFAULT '[]'::jsonb,
    affected_entities JSONB DEFAULT '[]'::jsonb,  -- [{type, id, name}]

    -- Workflow state
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'in_remediation', 'remediated', 'accepted_risk', 'false_positive', 'closed'
    )),
    assigned_to UUID REFERENCES users(id),
    target_resolution_date DATE,
    resolved_at TIMESTAMPTZ,

    -- AI provenance
    ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
    requires_human_review BOOLEAN DEFAULT TRUE,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ipo_findings_tenant ON ipo_findings(tenant_id);
CREATE INDEX idx_ipo_findings_project ON ipo_findings(project_id);
CREATE INDEX idx_ipo_findings_workstream ON ipo_findings(workstream_id);
CREATE INDEX idx_ipo_findings_severity ON ipo_findings(severity);
CREATE INDEX idx_ipo_findings_status ON ipo_findings(status);
CREATE INDEX idx_ipo_findings_category ON ipo_findings(finding_category);

-- =============================================================================
-- 4. Filing Documents (versioned IPO documents)
-- =============================================================================
-- Documents are versioned and section-structured. AI-drafted content goes
-- here but cannot be marked 'final' without an entry in review_signoffs.

CREATE TABLE IF NOT EXISTS ipo_filing_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,

    doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN (
        -- SEC
        'SEC_S1', 'SEC_F1', 'SEC_S1A', 'SEC_424B4',
        'SEC_10K', 'SEC_10Q', 'SEC_8K',
        -- HKEX
        'HKEX_A1', 'HKEX_PHIP', 'HKEX_PROSPECTUS', 'HKEX_LISTING_DOCUMENT',
        -- Internal
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
        'OTHER'
    )),
    doc_title VARCHAR(500),
    version INT NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    -- Section-structured content
    -- { sections: [{ id, heading, content, ai_drafted, status, ... }] }
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_word_count INT DEFAULT 0,

    -- AI provenance
    ai_drafted BOOLEAN DEFAULT FALSE,
    drafting_agent_id VARCHAR(100),
    based_on_template VARCHAR(255),

    -- Lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'in_review', 'revision_requested', 'approved', 'submitted', 'final', 'superseded'
    )),

    -- Compliance gates: must reference review_signoffs entries before status='final'
    requires_signoffs JSONB DEFAULT '[]'::jsonb,  -- ['AUDITOR','LAWYER','CFO','SPONSOR']
    signoffs_complete BOOLEAN DEFAULT FALSE,

    submitted_to VARCHAR(100),
    submitted_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    UNIQUE(project_id, doc_type, version)
);

CREATE INDEX idx_ipo_docs_tenant ON ipo_filing_documents(tenant_id);
CREATE INDEX idx_ipo_docs_project ON ipo_filing_documents(project_id);
CREATE INDEX idx_ipo_docs_type ON ipo_filing_documents(doc_type);
CREATE INDEX idx_ipo_docs_status ON ipo_filing_documents(status);
CREATE INDEX idx_ipo_docs_current ON ipo_filing_documents(project_id, doc_type) WHERE is_current = TRUE;

-- =============================================================================
-- 5. Review Signoffs (THE compliance gate — AI Co-Pilot enforcement)
-- =============================================================================
-- No filing document can transition to status='final' without N entries here
-- where N = cardinality(requires_signoffs) and each role is signed off.

CREATE TABLE IF NOT EXISTS ipo_review_signoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,

    -- Target artifact (one of doc / finding / valuation)
    artifact_type VARCHAR(50) NOT NULL CHECK (artifact_type IN (
        'FILING_DOCUMENT', 'FINDING', 'VALUATION_MODEL', 'COMMENT_RESPONSE'
    )),
    artifact_id UUID NOT NULL,
    artifact_version INT NOT NULL DEFAULT 1,

    -- Reviewer
    reviewer_user_id UUID NOT NULL REFERENCES users(id),
    reviewer_role VARCHAR(50) NOT NULL CHECK (reviewer_role IN (
        'AUDITOR',          -- External / signing audit partner
        'LAWYER',           -- Securities counsel
        'CFO',              -- Issuer CFO
        'SPONSOR',          -- HKEX sponsor representative / SEC underwriter
        'COMPLIANCE',       -- Internal compliance
        'INDEPENDENT_DIR',  -- Independent director (audit committee)
        'OTHER'
    )),
    reviewer_firm VARCHAR(255),
    reviewer_signature_metadata JSONB DEFAULT '{}'::jsonb,  -- e.g. e-sign provider txn id

    -- Decision
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'revision_requested', 'recused'
    )),
    decision_rationale TEXT,
    conditions TEXT,                 -- e.g. "Approved subject to clearing comment 42"

    requested_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ipo_signoffs_tenant ON ipo_review_signoffs(tenant_id);
CREATE INDEX idx_ipo_signoffs_project ON ipo_review_signoffs(project_id);
CREATE INDEX idx_ipo_signoffs_artifact ON ipo_review_signoffs(artifact_type, artifact_id);
CREATE INDEX idx_ipo_signoffs_reviewer ON ipo_review_signoffs(reviewer_user_id);
CREATE INDEX idx_ipo_signoffs_status ON ipo_review_signoffs(status);

-- =============================================================================
-- 6. Regulations (RAG knowledge base — primary source documents)
-- =============================================================================
-- Authoritative regulatory texts. Each chunk is embedded for retrieval.

CREATE TABLE IF NOT EXISTS ipo_regulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    jurisdiction VARCHAR(50) NOT NULL CHECK (jurisdiction IN (
        'SEC', 'HKEX', 'PCAOB', 'FASB', 'IASB', 'IRS', 'IRD_HK',
        'NASDAQ', 'NYSE', 'CSRC', 'SGX', 'OTHER'
    )),
    doc_type VARCHAR(100) NOT NULL,        -- 'Reg S-K', 'HKEX Listing Rules Ch.8', etc.
    title VARCHAR(500) NOT NULL,
    section VARCHAR(255),
    subsection VARCHAR(255),
    effective_date DATE,
    superseded_date DATE,
    version VARCHAR(50),
    source_url TEXT,
    full_text TEXT,
    language CHAR(2) DEFAULT 'en',

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regulations_jurisdiction ON ipo_regulations(jurisdiction);
CREATE INDEX idx_regulations_doctype ON ipo_regulations(doc_type);
CREATE INDEX idx_regulations_effective ON ipo_regulations(effective_date);
CREATE INDEX idx_regulations_active ON ipo_regulations(jurisdiction, doc_type)
    WHERE superseded_date IS NULL;

CREATE TABLE IF NOT EXISTS ipo_regulation_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id UUID NOT NULL REFERENCES ipo_regulations(id) ON DELETE CASCADE,

    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_heading VARCHAR(500),
    section_path VARCHAR(500),               -- e.g. 'Chapter 8 > Rule 8.05 > (1)(a)'
    token_count INT,

    -- Embedding kept nullable so MVP can ship before AI provider is wired up.
    -- Dimension 1536 matches OpenAI text-embedding-3-small (default low-cost).
    -- Will be re-embedded with selectable models once AI provider config is live.
    embedding vector(1536),
    embedding_model VARCHAR(100),
    embedded_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reg_chunks_regulation ON ipo_regulation_chunks(regulation_id);
-- HNSW index for vector similarity (created conditionally; pgvector >= 0.5)
DO $$
BEGIN
    BEGIN
        CREATE INDEX idx_reg_chunks_embedding_hnsw
            ON ipo_regulation_chunks
            USING hnsw (embedding vector_cosine_ops);
    EXCEPTION WHEN OTHERS THEN
        -- Fallback for older pgvector: ivfflat
        CREATE INDEX idx_reg_chunks_embedding_ivf
            ON ipo_regulation_chunks
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
    END;
END $$;

-- =============================================================================
-- 7. AI Citations (provenance enforcement)
-- =============================================================================
-- Every regulation-related AI output is tracked here. Findings and document
-- sections that lack at least one citation_id are flagged as un-grounded.

CREATE TABLE IF NOT EXISTS ipo_ai_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,

    -- What made this claim
    source_agent_id VARCHAR(100) NOT NULL,
    source_task_id UUID,

    -- Where the claim lives
    claim_artifact_type VARCHAR(50) CHECK (claim_artifact_type IN (
        'FILING_DOCUMENT_SECTION', 'FINDING', 'VALUATION_INPUT', 'COMMENT_RESPONSE', 'CHAT_MESSAGE'
    )),
    claim_artifact_id UUID,
    claim_text TEXT NOT NULL,

    -- The supporting authority
    cited_regulation_id UUID REFERENCES ipo_regulations(id) ON DELETE SET NULL,
    cited_chunk_id UUID REFERENCES ipo_regulation_chunks(id) ON DELETE SET NULL,
    quoted_text TEXT,
    citation_format VARCHAR(255),            -- e.g. "Reg S-K Item 303(a)(3)(ii)"

    -- Quality scoring
    relevance_score DECIMAL(3,2),
    verified_by_human BOOLEAN DEFAULT FALSE,
    verified_by_user_id UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_citations_tenant ON ipo_ai_citations(tenant_id);
CREATE INDEX idx_citations_project ON ipo_ai_citations(project_id);
CREATE INDEX idx_citations_artifact ON ipo_ai_citations(claim_artifact_type, claim_artifact_id);
CREATE INDEX idx_citations_chunk ON ipo_ai_citations(cited_chunk_id);

-- =============================================================================
-- 8. Valuation Models
-- =============================================================================

CREATE TABLE IF NOT EXISTS ipo_valuation_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,

    model_type VARCHAR(50) NOT NULL CHECK (model_type IN (
        'DCF',                   -- Discounted Cash Flow
        'COMPARABLE_COMPANY',    -- Trading comps
        'PRECEDENT_TRANSACTION', -- Precedent M&A / IPO
        'SUM_OF_THE_PARTS',
        'DIVIDEND_DISCOUNT',
        'REAL_OPTIONS',          -- Common for biotech
        'BOOK_VALUE',
        'BLENDED'
    )),
    scenario VARCHAR(50) NOT NULL DEFAULT 'BASE' CHECK (scenario IN (
        'BASE', 'BULL', 'BEAR', 'STRESS', 'CUSTOM'
    )),

    -- Inputs and outputs are stored as JSONB so frontend can render
    -- arbitrary models without schema migrations.
    inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    assumptions TEXT,

    enterprise_value_cents BIGINT,
    equity_value_cents BIGINT,
    implied_share_price_cents BIGINT,
    implied_pe_ratio NUMERIC(10,2),
    implied_ev_revenue NUMERIC(10,2),
    implied_ev_ebitda NUMERIC(10,2),

    -- Authorship
    built_by_agent_id VARCHAR(100),
    notes TEXT,

    -- Lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'in_review', 'approved', 'rejected', 'superseded'
    )),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_valuations_tenant ON ipo_valuation_models(tenant_id);
CREATE INDEX idx_valuations_project ON ipo_valuation_models(project_id);
CREATE INDEX idx_valuations_type ON ipo_valuation_models(model_type);

-- =============================================================================
-- 9. Stock Price Simulations
-- =============================================================================
-- Post-IPO price path simulations (Monte Carlo / GARCH / bootstrap).
-- Heavy numeric arrays kept in JSONB for MVP; can be moved to a dedicated
-- TimescaleDB hypertable later if frequency demands it.

CREATE TABLE IF NOT EXISTS ipo_stock_simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,

    method VARCHAR(50) NOT NULL CHECK (method IN (
        'MONTE_CARLO_GBM',           -- Geometric Brownian Motion
        'MONTE_CARLO_JUMP_DIFFUSION',
        'GARCH',
        'HISTORICAL_BOOTSTRAP',
        'SCENARIO_BASED'
    )),

    -- Initial conditions
    initial_price_cents BIGINT NOT NULL,
    horizon_days INT NOT NULL,
    num_paths INT NOT NULL,

    -- Model parameters
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. { drift: 0.08, volatility: 0.45, jump_intensity: 0.05, ... }

    -- Aggregated outputs (full paths in detail_blob)
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. { mean_terminal_price, p5, p25, p50, p75, p95,
    --        prob_below_offer, max_drawdown_p95, ... }

    -- Optional full per-path data; kept separately so listing queries are fast
    detail_blob JSONB,

    notes TEXT,
    built_by_agent_id VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_simulations_tenant ON ipo_stock_simulations(tenant_id);
CREATE INDEX idx_simulations_project ON ipo_stock_simulations(project_id);
CREATE INDEX idx_simulations_method ON ipo_stock_simulations(method);

-- =============================================================================
-- 10. Regulator Q&A (comment letters / hearing questions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ipo_regulator_qa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES ipo_projects(id) ON DELETE CASCADE,

    round_number INT NOT NULL DEFAULT 1,    -- 1st round comments, 2nd round, ...
    source VARCHAR(50) NOT NULL CHECK (source IN (
        'SEC_COMMENT_LETTER',
        'HKEX_FIRST_COMMENT',
        'HKEX_HEARING',
        'HKEX_POST_HEARING',
        'INTERNAL_MOCK_QA',
        'OTHER'
    )),
    question_number VARCHAR(20),
    question_text TEXT NOT NULL,
    question_topic VARCHAR(100),

    -- AI draft + human revision
    ai_draft_response TEXT,
    ai_drafting_agent_id VARCHAR(100),
    final_response TEXT,

    -- Reference docs / sections that need to be amended
    requires_amendments_to JSONB DEFAULT '[]'::jsonb,

    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN (
        'open', 'drafting', 'in_review', 'submitted', 'cleared', 'resubmit_required'
    )),

    received_at TIMESTAMPTZ,
    response_due_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    cleared_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qa_tenant ON ipo_regulator_qa(tenant_id);
CREATE INDEX idx_qa_project ON ipo_regulator_qa(project_id);
CREATE INDEX idx_qa_status ON ipo_regulator_qa(status);
CREATE INDEX idx_qa_source ON ipo_regulator_qa(source);

-- =============================================================================
-- 11. Industry Benchmarks
-- =============================================================================
-- Curated industry KPIs used by industry-expert agents for comparative
-- analysis. Public reference data — NO tenant_id (shared across tenants).

CREATE TABLE IF NOT EXISTS ipo_industry_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    industry VARCHAR(50) NOT NULL,
    sub_industry VARCHAR(100),
    region VARCHAR(50),                  -- 'US', 'HK', 'GLOBAL', 'PRC', ...
    metric_key VARCHAR(100) NOT NULL,    -- 'ARR_GROWTH', 'NRR', 'GROSS_MARGIN', ...
    metric_label VARCHAR(255) NOT NULL,
    metric_unit VARCHAR(50),             -- '%', 'x', 'months', 'USD/customer', ...

    -- Distribution stats
    p10 NUMERIC(20,6),
    p25 NUMERIC(20,6),
    p50 NUMERIC(20,6),                   -- Median
    p75 NUMERIC(20,6),
    p90 NUMERIC(20,6),
    mean NUMERIC(20,6),

    sample_size INT,
    as_of_date DATE,
    source VARCHAR(255),                 -- e.g. "SaaS Capital 2024"
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_benchmarks_industry ON ipo_industry_benchmarks(industry, sub_industry);
CREATE INDEX idx_benchmarks_metric ON ipo_industry_benchmarks(metric_key);
CREATE INDEX idx_benchmarks_region ON ipo_industry_benchmarks(region);

-- =============================================================================
-- 12. AI Provider Configurations (Phase 2 enablement)
-- =============================================================================
-- Tenant-level configuration for multiple LLM providers. Keys stored as
-- AES-encrypted blobs (encryption applied at application layer).

CREATE TABLE IF NOT EXISTS ipo_ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    provider_code VARCHAR(50) NOT NULL CHECK (provider_code IN (
        'TOKENHOT', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'AZURE_OPENAI',
        'GOOGLE_GEMINI', 'CUSTOM'
    )),
    display_name VARCHAR(255) NOT NULL,
    base_url VARCHAR(500),
    api_key_encrypted TEXT,             -- AES-GCM ciphertext, app-layer
    api_key_last4 CHAR(4),              -- For UI display
    default_model VARCHAR(100),
    embedding_model VARCHAR(100),

    -- Routing controls
    is_default BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    monthly_budget_cents BIGINT,
    monthly_spend_cents BIGINT DEFAULT 0,
    rate_limit_rpm INT,

    -- Allowed agent classes
    allowed_agent_categories JSONB DEFAULT '[]'::jsonb,

    last_health_check_at TIMESTAMPTZ,
    last_health_status VARCHAR(20) CHECK (last_health_status IN ('healthy','degraded','down','unknown')),

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_providers_tenant ON ipo_ai_providers(tenant_id);
CREATE INDEX idx_ai_providers_default ON ipo_ai_providers(tenant_id) WHERE is_default = TRUE;

-- =============================================================================
-- updated_at triggers
-- =============================================================================

CREATE TRIGGER update_ipo_projects_updated_at BEFORE UPDATE ON ipo_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_workstreams_updated_at BEFORE UPDATE ON ipo_workstreams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_findings_updated_at BEFORE UPDATE ON ipo_findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_filing_documents_updated_at BEFORE UPDATE ON ipo_filing_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_regulations_updated_at BEFORE UPDATE ON ipo_regulations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_valuation_models_updated_at BEFORE UPDATE ON ipo_valuation_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_regulator_qa_updated_at BEFORE UPDATE ON ipo_regulator_qa
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_industry_benchmarks_updated_at BEFORE UPDATE ON ipo_industry_benchmarks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ipo_ai_providers_updated_at BEFORE UPDATE ON ipo_ai_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Audit triggers (reuse existing log_audit_entry function)
-- =============================================================================

CREATE TRIGGER audit_ipo_projects AFTER INSERT OR UPDATE OR DELETE ON ipo_projects
    FOR EACH ROW EXECUTE FUNCTION log_audit_entry();

CREATE TRIGGER audit_ipo_filing_documents AFTER INSERT OR UPDATE OR DELETE ON ipo_filing_documents
    FOR EACH ROW EXECUTE FUNCTION log_audit_entry();

CREATE TRIGGER audit_ipo_review_signoffs AFTER INSERT OR UPDATE OR DELETE ON ipo_review_signoffs
    FOR EACH ROW EXECUTE FUNCTION log_audit_entry();

CREATE TRIGGER audit_ipo_findings AFTER INSERT OR UPDATE OR DELETE ON ipo_findings
    FOR EACH ROW EXECUTE FUNCTION log_audit_entry();

CREATE TRIGGER audit_ipo_valuation_models AFTER INSERT OR UPDATE OR DELETE ON ipo_valuation_models
    FOR EACH ROW EXECUTE FUNCTION log_audit_entry();

CREATE TRIGGER audit_ipo_regulator_qa AFTER INSERT OR UPDATE OR DELETE ON ipo_regulator_qa
    FOR EACH ROW EXECUTE FUNCTION log_audit_entry();

-- =============================================================================
-- Compliance gate trigger: a filing document cannot transition to 'final'
-- without an approving signoff for every required reviewer role.
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_signoff_gate()
RETURNS TRIGGER AS $$
DECLARE
    required_role TEXT;
    has_approval BOOLEAN;
    required_roles JSONB;
BEGIN
    IF NEW.status IN ('final','approved','submitted') AND
       (OLD.status IS NULL OR OLD.status NOT IN ('final','approved','submitted')) THEN

        required_roles := COALESCE(NEW.requires_signoffs, '[]'::jsonb);

        FOR required_role IN
            SELECT jsonb_array_elements_text(required_roles)
        LOOP
            SELECT EXISTS (
                SELECT 1
                FROM ipo_review_signoffs s
                WHERE s.artifact_type = 'FILING_DOCUMENT'
                  AND s.artifact_id = NEW.id
                  AND s.artifact_version = NEW.version
                  AND s.reviewer_role = required_role
                  AND s.status = 'approved'
            ) INTO has_approval;

            IF NOT has_approval THEN
                RAISE EXCEPTION
                    'Compliance gate: cannot mark document % v% as %, missing signoff from role %',
                    NEW.id, NEW.version, NEW.status, required_role;
            END IF;
        END LOOP;

        NEW.signoffs_complete := TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_filing_signoff
    BEFORE UPDATE ON ipo_filing_documents
    FOR EACH ROW EXECUTE FUNCTION enforce_signoff_gate();
