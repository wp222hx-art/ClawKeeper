-- =============================================================================
-- IPOPilot Row-Level Security Policies
-- =============================================================================
-- Reuses ClawKeeper's helper functions:
--   current_tenant_id(), current_user_role(), is_super_admin()
-- All tenant-scoped IPO tables enforce: tenant_id = current_tenant_id()
-- =============================================================================

ALTER TABLE ipo_projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_workstreams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_findings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_filing_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_review_signoffs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_ai_citations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_valuation_models     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_stock_simulations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_regulator_qa         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ipo_ai_providers         ENABLE ROW LEVEL SECURITY;
-- ipo_regulations / ipo_regulation_chunks / ipo_industry_benchmarks are
-- public reference data, no RLS.

CREATE POLICY ipo_projects_isolation ON ipo_projects
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_workstreams_isolation ON ipo_workstreams
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_findings_isolation ON ipo_findings
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_filing_documents_isolation ON ipo_filing_documents
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_review_signoffs_isolation ON ipo_review_signoffs
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_ai_citations_isolation ON ipo_ai_citations
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_valuation_models_isolation ON ipo_valuation_models
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_stock_simulations_isolation ON ipo_stock_simulations
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_regulator_qa_isolation ON ipo_regulator_qa
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

-- AI provider keys: only tenant_admin and super_admin can manage
CREATE POLICY ipo_ai_providers_isolation ON ipo_ai_providers
    FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id());

CREATE POLICY ipo_ai_providers_admin_write ON ipo_ai_providers
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('tenant_admin', 'super_admin')
    );

CREATE POLICY ipo_ai_providers_admin_update ON ipo_ai_providers
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('tenant_admin', 'super_admin')
    );

-- Filing documents: viewers can read; only accountant/admin can write;
-- only signed-off paths can mark final (enforced by trigger)
CREATE POLICY ipo_filing_documents_viewer_read ON ipo_filing_documents
    FOR SELECT USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('viewer','accountant','tenant_admin','super_admin')
    );

CREATE POLICY ipo_filing_documents_accountant_write ON ipo_filing_documents
    FOR INSERT WITH CHECK (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('accountant','tenant_admin','super_admin')
    );

CREATE POLICY ipo_filing_documents_accountant_update ON ipo_filing_documents
    FOR UPDATE USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('accountant','tenant_admin','super_admin')
    );

-- Service role bypass
GRANT ALL ON ALL TABLES    IN SCHEMA public TO clawkeeper_service;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO clawkeeper_service;
