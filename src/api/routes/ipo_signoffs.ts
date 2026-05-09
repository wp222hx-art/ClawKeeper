// file: src/api/routes/ipo_signoffs.ts
// description: IPOPilot signoff routes — request, approve, reject signoffs
//              that gate filing documents per the enforce_signoff_gate trigger.
// reference: db/ipo_schema.sql (ipo_review_signoffs, enforce_signoff_gate)

import { Hono } from 'hono';
import { z } from 'zod';
import type { Sql } from 'postgres';
import type { AppEnv } from '../../types/hono';
import {
  SignoffRole as SignoffRoleSchema,
  SignoffStatus as SignoffStatusSchema,
} from '../../ipo/types/index';

const RequestSignoffSchema = z.object({
  project_id: z.string().uuid(),
  document_id: z.string().uuid(),
  reviewer_role: SignoffRoleSchema,
  reviewer_user_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

const DecideSignoffSchema = z.object({
  status: SignoffStatusSchema,
  notes: z.string().max(2000).optional(),
});

export function create_ipo_signoff_routes(sql: Sql<Record<string, unknown>>) {
  const app = new Hono<AppEnv>();

  // POST /api/ipo/signoffs — request a new signoff for a document
  app.post('/', async (c) => {
    const tenant_id = c.get('tenant_id');
    const user_id = c.get('user_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = RequestSignoffSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 422);
    const input = parsed.data;

    try {
      const [row] = await sql`
        INSERT INTO ipo_review_signoffs (
          tenant_id, project_id, document_id, reviewer_role, reviewer_user_id,
          status, requested_at, requested_by_user_id, notes
        ) VALUES (
          ${tenant_id}, ${input.project_id}, ${input.document_id},
          ${input.reviewer_role}, ${input.reviewer_user_id ?? null},
          'PENDING', NOW(), ${user_id}, ${input.notes ?? null}
        )
        RETURNING id, project_id, document_id, reviewer_role, status, requested_at
      `;
      return c.json({ signoff: row }, 201);
    } catch (e) {
      console.error('[ipo/signoffs POST] error:', e);
      return c.json({ error: 'Failed to request signoff' }, 500);
    }
  });

  // GET /api/ipo/signoffs?project_id=...
  app.get('/', async (c) => {
    const tenant_id = c.get('tenant_id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);
    const project_id = c.req.query('project_id');
    const status_q = c.req.query('status');
    try {
      const rows = project_id
        ? (status_q
            ? await sql`SELECT * FROM ipo_review_signoffs
                        WHERE tenant_id = ${tenant_id} AND project_id = ${project_id} AND status = ${status_q}
                        ORDER BY requested_at DESC LIMIT 200`
            : await sql`SELECT * FROM ipo_review_signoffs
                        WHERE tenant_id = ${tenant_id} AND project_id = ${project_id}
                        ORDER BY requested_at DESC LIMIT 200`)
        : await sql`SELECT * FROM ipo_review_signoffs
                    WHERE tenant_id = ${tenant_id}
                    ORDER BY requested_at DESC LIMIT 200`;
      return c.json({ signoffs: rows, count: rows.length });
    } catch (e) {
      console.error('[ipo/signoffs GET] error:', e);
      return c.json({ error: 'Failed to list signoffs' }, 500);
    }
  });

  // POST /api/ipo/signoffs/:id/decide — approve or reject
  app.post('/:id/decide', async (c) => {
    const tenant_id = c.get('tenant_id');
    const user_id = c.get('user_id');
    const id = c.req.param('id');
    if (!tenant_id) return c.json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try { body = await c.req.json(); }
    catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    const parsed = DecideSignoffSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 422);

    try {
      const rows = await sql`
        UPDATE ipo_review_signoffs
        SET status = ${parsed.data.status},
            decided_at = NOW(),
            decided_by_user_id = ${user_id},
            notes = COALESCE(${parsed.data.notes ?? null}, notes)
        WHERE id = ${id} AND tenant_id = ${tenant_id}
        RETURNING id, project_id, document_id, reviewer_role, status, decided_at
      `;
      if (rows.length === 0) return c.json({ error: 'Not found' }, 404);
      return c.json({ signoff: rows[0] });
    } catch (e) {
      console.error('[ipo/signoffs/:id/decide POST] error:', e);
      return c.json({ error: 'Failed to decide signoff' }, 500);
    }
  });

  return app;
}
