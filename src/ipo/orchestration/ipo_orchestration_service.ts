// file: src/ipo/orchestration/ipo_orchestration_service.ts
// description: IPOOrchestrationService — orchestrates a project across the
//              7-stage IPO lifecycle. Each stage activates a set of workstreams
//              owned by Lead agents, which in turn dispatch to Worker agents
//              filtered by jurisdiction + industry.
//
//              This service does NOT call LLMs in Phase 1. It only plans
//              workstream graphs, persists them, and emits orchestration
//              events. LLM execution is wired up in Phase 2 once AI provider
//              configuration is enabled.
// reference: src/ipo/types, src/ipo/orchestration/stages, agent_registry,
//            workstream_blueprint

import { v4 as uuid } from 'uuid';
import {
  IPO_STAGE_DEFINITIONS,
  validate_stage_transition,
  type StageDefinition,
} from './stages';
import {
  WORKSTREAM_BLUEPRINTS,
  resolve_active_workers,
  is_workstream_mandatory,
} from './workstream_blueprint';
import { get_ipo_agent, ALL_IPO_AGENTS } from './agent_registry';
import {
  load_agent_skill_bundle,
  compute_skill_coverage,
  type AgentSkillBundle,
  type SkillCoverageReport,
} from './skill_loader';
import type {
  IpoProject,
  ProjectStage,
  WorkstreamType,
  TargetMarket,
  Industry,
  SignoffRole,
} from '../types/index';

// ============================================================================
// Plan structures
// ============================================================================

export interface WorkstreamPlanItem {
  workstream_id: string;
  workstream_type: WorkstreamType;
  display_name: string;
  description: string;
  lead_agent_id: string;
  active_worker_agent_ids: string[];
  output_artifacts: string[];
  required_signoffs: SignoffRole[];
  is_mandatory: boolean;
  blocking_stage: ProjectStage | null;
  estimated_duration_weeks: [number, number];
}

export interface StagePlan {
  stage: ProjectStage;
  display_name: string;
  description: string;
  typical_duration_weeks: [number, number];
  workstreams: WorkstreamPlanItem[];
  exit_criteria: string[];
  required_signoff_roles: SignoffRole[];
  next_stages: ProjectStage[];
}

export interface ProjectPlan {
  plan_id: string;
  project_id: string;
  company_legal_name: string;
  target_market: TargetMarket;
  industry: Industry;
  generated_at: string;
  stages: StagePlan[];
  total_active_agents: number;
  total_workstreams: number;
  estimated_total_duration_weeks: [number, number];
}

// ============================================================================
// Events emitted to dashboard
// ============================================================================

export type IpoOrchestrationEvent =
  | { type: 'project_planned'; project_id: string; plan_id: string; total_workstreams: number; total_active_agents: number; timestamp: string }
  | { type: 'stage_entered'; project_id: string; stage: ProjectStage; timestamp: string }
  | { type: 'stage_exited'; project_id: string; from_stage: ProjectStage; to_stage: ProjectStage; timestamp: string }
  | { type: 'stage_blocked'; project_id: string; stage: ProjectStage; blockers: string[]; timestamp: string }
  | { type: 'workstream_started'; project_id: string; workstream_id: string; workstream_type: WorkstreamType; lead_agent_id: string; timestamp: string }
  | { type: 'workstream_completed'; project_id: string; workstream_id: string; workstream_type: WorkstreamType; risk_level: string | null; timestamp: string }
  | { type: 'workstream_blocked'; project_id: string; workstream_id: string; reason: string; timestamp: string }
  | { type: 'finding_emitted'; project_id: string; workstream_id: string; severity: string; title: string; timestamp: string }
  | { type: 'signoff_requested'; project_id: string; artifact_id: string; reviewer_role: SignoffRole; timestamp: string }
  | { type: 'signoff_completed'; project_id: string; artifact_id: string; reviewer_role: SignoffRole; status: string; timestamp: string };

export type IpoEventCallback = (event: IpoOrchestrationEvent) => void;

// ============================================================================
// Service
// ============================================================================

export class IpoOrchestrationService {
  private plans: Map<string, ProjectPlan> = new Map();

  /**
   * Build a complete project plan covering every stage from current stage
   * forward. For each stage, instantiate the applicable workstreams,
   * filtering worker agents by jurisdiction + industry.
   */
  build_project_plan(project: Pick<IpoProject,
    'id' | 'company_legal_name' | 'target_market' | 'industry' | 'stage'
  >): ProjectPlan {
    const plan_id = uuid();
    const stages: StagePlan[] = [];

    // Walk forward from current stage
    const order: ProjectStage[] = [];
    let cursor: ProjectStage | undefined = project.stage;
    const seen = new Set<ProjectStage>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      order.push(cursor);
      const next: ProjectStage[] = IPO_STAGE_DEFINITIONS[cursor].next_stages;
      // Choose primary forward path (skip WITHDRAWN branch)
      cursor = next.find(s => s !== 'WITHDRAWN');
    }

    let total_workstreams = 0;
    const active_agents = new Set<string>();
    let total_min_weeks = 0;
    let total_max_weeks = 0;

    for (const stage of order) {
      const def: StageDefinition = IPO_STAGE_DEFINITIONS[stage];
      const ws_items: WorkstreamPlanItem[] = [];

      const all_ws_for_stage: WorkstreamType[] = [
        ...def.required_workstreams,
        ...def.optional_workstreams,
      ];

      for (const ws_type of all_ws_for_stage) {
        const bp = WORKSTREAM_BLUEPRINTS[ws_type];
        const mandatory = is_workstream_mandatory(ws_type, project.target_market)
                          && def.required_workstreams.includes(ws_type);

        const active_workers = resolve_active_workers(
          ws_type, project.target_market, project.industry
        );

        // Track active agents for telemetry
        active_agents.add(bp.lead_agent_id);
        active_workers.forEach(w => active_agents.add(w));

        ws_items.push({
          workstream_id: uuid(),
          workstream_type: ws_type,
          display_name: bp.display_name,
          description: bp.description,
          lead_agent_id: bp.lead_agent_id,
          active_worker_agent_ids: active_workers,
          output_artifacts: bp.output_artifacts,
          required_signoffs: bp.required_signoffs,
          is_mandatory: mandatory,
          blocking_stage: def.required_workstreams.includes(ws_type) ? stage : null,
          estimated_duration_weeks: def.typical_duration_weeks,
        });
      }

      total_workstreams += ws_items.length;
      total_min_weeks += def.typical_duration_weeks[0];
      total_max_weeks += def.typical_duration_weeks[1];

      stages.push({
        stage,
        display_name: def.display_name,
        description: def.description,
        typical_duration_weeks: def.typical_duration_weeks,
        workstreams: ws_items,
        exit_criteria: def.exit_criteria,
        required_signoff_roles: def.required_signoff_roles,
        next_stages: def.next_stages,
      });
    }

    const plan: ProjectPlan = {
      plan_id,
      project_id: project.id,
      company_legal_name: project.company_legal_name,
      target_market: project.target_market,
      industry: project.industry,
      generated_at: new Date().toISOString(),
      stages,
      total_active_agents: active_agents.size,
      total_workstreams,
      estimated_total_duration_weeks: [total_min_weeks, total_max_weeks],
    };

    this.plans.set(plan_id, plan);
    return plan;
  }

  get_plan(plan_id: string): ProjectPlan | null {
    return this.plans.get(plan_id) || null;
  }

  list_plans_for_project(project_id: string): ProjectPlan[] {
    return Array.from(this.plans.values()).filter(p => p.project_id === project_id);
  }

  /**
   * Determine which stage a project should advance to, given current
   * workstream completion and signoff state.
   */
  evaluate_stage_transition(
    current_stage: ProjectStage,
    workstream_statuses: Record<WorkstreamType, string>,
    signoff_approvals: Record<SignoffRole, boolean>
  ): { allowed: boolean; target_stage: ProjectStage | null; blockers: string[] } {
    const def = IPO_STAGE_DEFINITIONS[current_stage];
    const target = def.next_stages.find(s => s !== 'WITHDRAWN' && s !== 'COMPLETED') ?? null;
    if (!target) return { allowed: false, target_stage: null, blockers: ['No forward stage'] };

    const result = validate_stage_transition({
      current_stage,
      target_stage: target,
      workstream_statuses,
      signoff_approvals,
    });
    return { allowed: result.allowed, target_stage: target, blockers: result.blockers };
  }

  /**
   * Emit an event to a callback if provided. Errors swallowed.
   */
  static emit(callback: IpoEventCallback | undefined, event: IpoOrchestrationEvent): void {
    if (!callback) return;
    try { callback(event); } catch (e) {
      console.error('[IpoOrchestration] event callback error:', e);
    }
  }

  /**
   * Returns the catalog of all known IPO agents — used by the dashboard's
   * agent directory and the Settings > Agents page.
   */
  get_agent_catalog() {
    return ALL_IPO_AGENTS.map(a => ({
      id: a.id,
      display_name: a.display_name,
      tier: a.tier,
      category: a.category,
      description: a.description,
      capabilities: a.capabilities,
      citation_required: a.citation_required,
      required_signoff_for_outputs: a.required_signoff_for_outputs ?? [],
      has_skill_files: a.skill_files.length > 0,
    }));
  }

  /**
   * Resolve a single agent profile by id (returns undefined if unknown).
   */
  get_agent_profile(agent_id: string) {
    return get_ipo_agent(agent_id);
  }

  // -------------------------------------------------------------------------
  // Skill / AGENT.md bundle access — lazy-loaded with mtime invalidation.
  // The dashboard's "Agent Inspector" panel and (Phase 2) the LLM provider
  // execution path both consume bundles via these methods.
  // -------------------------------------------------------------------------

  /**
   * Load the AGENT.md + SKILL.md bundle for a single agent.
   * Returns null when the agent id is unknown.
   */
  load_agent_bundle(agent_id: string): AgentSkillBundle | null {
    return load_agent_skill_bundle(agent_id);
  }

  /**
   * Compute coverage stats over all registered agents — how many have
   * AGENT.md / SKILL.md files actually present on disk. Useful for the
   * Settings > Agent Catalog page and CI gating.
   */
  get_skill_coverage(): SkillCoverageReport {
    return compute_skill_coverage();
  }
}

// Singleton
export const ipo_orchestration_service = new IpoOrchestrationService();
