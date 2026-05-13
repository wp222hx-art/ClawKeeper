// file: src/api/routes/ipo_projects.ts
// description: IPOPilot project + workstream + dashboard API routes.
// reference: db/ipo_schema.sql, src/ipo/orchestration/ipo_orchestration_service.ts,
//            src/ipo/types/index.ts

import { Hono } from 'hono';
import type { Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import { ipo_orchestration_service } from '../../ipo/orchestration/ipo_orchestration_service';
import {
  CreateIpoProjectInput as CreateIpoProjectInputSchema,
  ProjectStage as ProjectStageSchema,
} from '../../ipo/types/index';
import type { z } from 'zod';

type ProjectStage = z.infer<typeof ProjectStageSchema>;

export function create_ipo_project_routes(sql: Sql<Record<string, unknown>>) {
  const app = new Hono<AppEnv>();

  // ---------------------------------------------------------------------------
  // POST /api/ipo/projects — create a new IPO project + auto-build plan
  // ---------------------------------------------------------------------------
  app.post('/', async (c) => {
    const tenant_id = c.get('tenant_id');
    const user_id = c.get('user_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }

    const parsed = CreateIpoProjectInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 422);
    }
    const input = parsed.data;

    try {
      const [row] = await sql<Array<{
        id: string; company_legal_name: string; target_market: string;
        industry: string; listing_structure: string; stage: string;
        created_at: Date;
      }>>`
        INSERT INTO ipo_projects (
          tenant_id, created_by, company_legal_name, company_short_name,
          company_jurisdiction, company_website, company_description,
          target_market, target_listing_date, proposed_ticker,
          industry, industry_subcategory, listing_structure,
          primary_advisor_firm, confidentiality_level, notes,
          stage, status, created_at, updated_at
        ) VALUES (
          ${tenant_id}, ${user_id}, ${input.company_legal_name},
          ${input.company_short_name ?? null},
          ${input.company_jurisdiction ?? null},
          ${input.company_website ?? null},
          ${input.company_description ?? null},
          ${input.target_market},
          ${input.target_listing_date ?? null},
          ${input.proposed_ticker ?? null},
          ${input.industry},
          ${input.industry_subcategory ?? null},
          ${input.listing_structure ?? null},
          ${input.primary_advisor_firm ?? null},
          ${input.confidentiality_level ?? 'STANDARD'},
          ${input.notes ?? null},
          'PRE_IPO_DIAGNOSIS', 'active', NOW(), NOW()
        )
        RETURNING id, company_legal_name, target_market, industry, listing_structure, stage, created_at
      `;

      const plan = ipo_orchestration_service.build_project_plan({
        id: row.id,
        company_legal_name: row.company_legal_name,
        target_market: row.target_market as never,
        industry: row.industry as never,
        stage: row.stage as ProjectStage,
      });

      return c.json({
        project: row,
        plan: {
          plan_id: plan.plan_id,
          total_workstreams: plan.total_workstreams,
          total_active_agents: plan.total_active_agents,
          estimated_total_duration_weeks: plan.estimated_total_duration_weeks,
          stages: plan.stages.map(s => ({
            stage: s.stage,
            display_name: s.display_name,
            workstreams: s.workstreams.map(w => ({
              workstream_id: w.workstream_id,
              workstream_type: w.workstream_type,
              display_name: w.display_name,
              lead_agent_id: w.lead_agent_id,
              active_worker_count: w.active_worker_agent_ids.length,
              is_mandatory: w.is_mandatory,
              required_signoffs: w.required_signoffs,
            })),
          })),
        },
      }, 201);
    } catch (e) {
      console.error('[ipo/projects POST] error:', e);
      return c.json({ error: 'Failed to create IPO project' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/ipo/projects — list all projects for the tenant
  // ---------------------------------------------------------------------------
  app.get('/', async (c) => {
    const tenant_id = c.get('tenant_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const rows = await sql`
        SELECT id, company_legal_name, target_market, industry, listing_structure,
               stage, status, target_listing_date,
               created_at, updated_at
        FROM ipo_projects
        WHERE tenant_id = ${tenant_id}
        ORDER BY created_at DESC
        LIMIT 200
      `;
      return c.json({ projects: rows, count: rows.length });
    } catch (e) {
      console.error('[ipo/projects GET] error:', e);
      return c.json({ error: 'Failed to list IPO projects' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/ipo/projects/:id — single project detail
  // ---------------------------------------------------------------------------
  app.get('/:id', async (c) => {
    const tenant_id = c.get('tenant_id');
    const id = c.req.param('id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const rows = await sql`
        SELECT * FROM ipo_projects
        WHERE id = ${id} AND tenant_id = ${tenant_id}
        LIMIT 1
      `;
      if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
      return c.json({ project: rows[0] });
    } catch (e) {
      console.error('[ipo/projects/:id GET] error:', e);
      return c.json({ error: 'Failed to fetch project' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/ipo/projects/:id/dashboard — full dashboard payload
  // ---------------------------------------------------------------------------
  app.get('/:id/dashboard', async (c) => {
    const tenant_id = c.get('tenant_id');
    const id = c.req.param('id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    try {
      const project_rows = await sql<Array<{
        id: string; company_legal_name: string; target_market: string;
        industry: string; listing_structure: string; stage: string;
      }>>`
        SELECT id, company_legal_name, target_market, industry,
               listing_structure, stage
        FROM ipo_projects
        WHERE id = ${id} AND tenant_id = ${tenant_id}
        LIMIT 1
      `;
      if (project_rows.length === 0) return c.json({ error: 'Not found' }, 404);
      const project = project_rows[0];

      const [workstreams, findings_summary, documents_summary, signoffs_pending] = await Promise.all([
        // Real schema column names: owner_agent_id (not lead_agent_id), no
        // blocker_count column — derive blocker count via a correlated subquery
        // from ipo_findings (severity in CRITICAL/HIGH that are still open).
        // Aliased back to lead_agent_id so the API contract & frontend remain
        // unchanged.
        sql`
          SELECT
            w.id,
            w.workstream_type,
            w.status,
            w.owner_agent_id AS lead_agent_id,
            w.started_at,
            w.completed_at,
            w.risk_level,
            COALESCE((
              SELECT COUNT(*)::int
              FROM ipo_findings f
              WHERE f.workstream_id = w.id
                AND f.tenant_id    = w.tenant_id
                AND UPPER(f.status) IN ('OPEN','IN_PROGRESS')
                AND UPPER(f.severity) IN ('CRITICAL','HIGH')
            ), 0) AS blocker_count
          FROM ipo_workstreams w
          WHERE w.project_id = ${id} AND w.tenant_id = ${tenant_id}
        `,
        sql`
          SELECT UPPER(severity) AS severity, COUNT(*)::int AS n
          FROM ipo_findings
          WHERE project_id = ${id} AND tenant_id = ${tenant_id}
            AND UPPER(status) IN ('OPEN','IN_PROGRESS')
          GROUP BY UPPER(severity)
        `,
        sql`
          SELECT status, COUNT(*)::int AS n
          FROM ipo_filing_documents
          WHERE project_id = ${id} AND tenant_id = ${tenant_id}
          GROUP BY status
        `,
        // Real schema: artifact_id (not document_id), status default is
        // lowercase 'pending'. Alias artifact_id back to document_id so the
        // dashboard payload contract stays unchanged for the frontend.
        sql`
          SELECT id,
                 artifact_id AS document_id,
                 reviewer_role,
                 status,
                 requested_at
          FROM ipo_review_signoffs
          WHERE project_id = ${id} AND tenant_id = ${tenant_id}
            AND UPPER(status) = 'PENDING'
          ORDER BY requested_at ASC
          LIMIT 50
        `,
      ]);

      const plan = ipo_orchestration_service.build_project_plan({
        id: project.id,
        company_legal_name: project.company_legal_name,
        target_market: project.target_market as never,
        industry: project.industry as never,
        stage: project.stage as ProjectStage,
      });

      return c.json({
        project,
        current_stage: project.stage,
        plan_summary: {
          plan_id: plan.plan_id,
          total_workstreams: plan.total_workstreams,
          total_active_agents: plan.total_active_agents,
          estimated_total_duration_weeks: plan.estimated_total_duration_weeks,
          stages: plan.stages.map(s => ({
            stage: s.stage,
            display_name: s.display_name,
            workstreams: s.workstreams.length,
          })),
        },
        workstreams,
        findings_by_severity: findings_summary,
        documents_by_status: documents_summary,
        signoffs_pending,
      });
    } catch (e) {
      console.error('[ipo/projects/:id/dashboard GET] error:', e);
      return c.json({ error: 'Failed to build dashboard' }, 500);
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/ipo/projects/:id/transition — request a stage transition
  // ---------------------------------------------------------------------------
  app.post('/:id/transition', async (c) => {
    const tenant_id = c.get('tenant_id');
    const id = c.req.param('id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    let body: { target_stage?: string };
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const target_parsed = ProjectStageSchema.safeParse(body.target_stage);
    if (!target_parsed.success) {
      return c.json({ error: 'Invalid target_stage' }, 422);
    }
    try {
      const project_rows = await sql<Array<{ id: string; stage: string }>>`
        SELECT id, stage FROM ipo_projects
        WHERE id = ${id} AND tenant_id = ${tenant_id}
        LIMIT 1
      `;
      if (project_rows.length === 0) return c.json({ error: 'Not found' }, 404);

      // Aggregate workstream + signoff state for evaluation
      const ws_rows = await sql<Array<{ workstream_type: string; status: string }>>`
        SELECT workstream_type, status FROM ipo_workstreams
        WHERE project_id = ${id} AND tenant_id = ${tenant_id}
      `;
      const ws_state: Record<string, string> = {};
      for (const r of ws_rows) ws_state[r.workstream_type] = r.status;

      const so_rows = await sql<Array<{ reviewer_role: string; status: string }>>`
        SELECT reviewer_role, status FROM ipo_review_signoffs
        WHERE project_id = ${id} AND tenant_id = ${tenant_id}
      `;
      const so_state: Record<string, boolean> = {};
      for (const r of so_rows) so_state[r.reviewer_role] = r.status === 'APPROVED';

      const decision = ipo_orchestration_service.evaluate_stage_transition(
        project_rows[0].stage as ProjectStage,
        ws_state as never,
        so_state as never,
      );

      if (!decision.allowed || decision.target_stage !== target_parsed.data) {
        return c.json({
          allowed: false,
          target_stage: decision.target_stage,
          blockers: decision.blockers,
        }, 409);
      }

      await sql`
        UPDATE ipo_projects
        SET stage = ${target_parsed.data}, updated_at = NOW()
        WHERE id = ${id} AND tenant_id = ${tenant_id}
      `;
      return c.json({ allowed: true, target_stage: target_parsed.data, blockers: [] });
    } catch (e) {
      console.error('[ipo/projects/:id/transition POST] error:', e);
      return c.json({ error: 'Failed to evaluate transition' }, 500);
    }
  });

  return app;
}
