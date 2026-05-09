# IPOPilot — AI Co-Pilot for Global IPO Readiness

> **Status**: Phase 1 scaffolding (framework, schema, agent registry, no LLM
> calls). Phase 2 wires the AI provider config (tokenhot.ai etc.) and turns
> the agents on.

IPOPilot is a multi-agent platform that helps audit firms, sponsors, securities
counsel, and issuer CFOs prepare a company for IPO across multiple jurisdictions
(SEC / HKEX in MVP) and industries (SaaS / BioPharma / Clean Energy in MVP).

It is built on top of the existing **ClawKeeper** runtime — reusing the
multi-tenant database, RLS, audit log, circuit breakers, and event-driven
orchestration. ClawKeeper now serves as the *underlying agent platform*; IPOPilot
is the IPO product layer on top.

---

## Core Principles

1. **AI Co-Pilot, not auto-pilot** — every artifact destined for a regulator,
   investor, or auditor must pass through `ipo_review_signoffs` (DB-enforced
   gate). Persons holding the relevant license sign; AI assists.
2. **Citation-grounded** — every regulation-related claim is recorded in
   `ipo_ai_citations` with a pointer to a `ipo_regulation_chunks` row and the
   exact quoted text. Un-cited claims are flagged.
3. **Stage-gated** — projects move through 7 sequential stages. A stage cannot
   be exited unless its required workstreams are completed and required
   signoff roles have approved. Enforced both in code and by trigger.
4. **Tenant-isolated** — every IPO table inherits ClawKeeper's RLS + audit
   trigger.

---

## The 7 Stage Lifecycle

| # | Stage | Typical Weeks | Required Workstreams | Required Signoffs |
|---|---|---|---|---|
| 1 | Pre-IPO Diagnosis | 4–8 | Financial / ICFR / Industry / Jurisdiction | CFO + Compliance |
| 2 | Readiness Remediation | 12–32 | ICFR / Financial | CFO + Auditor + Compliance |
| 3 | Restructuring | 8–24 | Legal / Tax | Lawyer + CFO |
| 4 | Audited Track Record | 16–36 | Audit / ICFR | Auditor + CFO |
| 5 | Filing Preparation | 8–16 | Prospectus / Valuation / Jurisdiction | Lawyer + Auditor + CFO + Sponsor |
| 6 | Regulator Review | 12–32 | Regulator Q&A / Prospectus | Lawyer + Auditor + CFO + Sponsor |
| 7 | Pricing & Roadshow | 2–4 | Roadshow / Valuation / Stock Sim | CFO + Sponsor |
| ∞ | Post-IPO Monitoring | ongoing | Quarterly Reporting / ICFR | CFO + Auditor |

---

## Agent Roster (Phase 1 catalog — `src/ipo/orchestration/agent_registry.ts`)

### Tier 1 — CEO (1)
- **IPO Director** — top-level conductor; reads the mandate, builds the project plan.

### Tier 2 — Leads (10)
- 1× Jurisdiction Lead (routes SEC vs HKEX work)
- 1× Industry Analysis Lead (routes SaaS / BioPharma / Clean Energy work)
- 8× Functional Leads — Financial Diagnosis, Audit, Internal Control, Legal,
  Tax, Disclosure & Drafting, Valuation, Post-IPO

### Tier 3 — Workers (~70)
- **SEC (7)**: S-1 Drafter, Reg S-K Checker, Comment Letter Responder,
  SOX 404 Advisor, Safe Harbor Checker, PCAOB Audit Advisor, Listing Standards Matcher
- **HKEX (7)**: A1 Drafter, Main Board Rules Checker, GEM Rules Checker,
  Sponsor Q&A Handler, Connected Tx Analyzer, ESG Disclosure Drafter, Track Record Validator
- **SaaS (3)**: Metrics Analyzer, RevRec Advisor, Cohort Analyzer
- **BioPharma (3)**: Pipeline Evaluator, IP Analyzer, Clinical Disclosure Drafter
- **Clean Energy (3)**: Capex Analyzer, Subsidy Tracker, Supply Chain Analyzer
- **Financial (8)**: Revenue Quality, Cash Flow, KPI, Variance, P&L,
  Balance Sheet, Capital Efficiency, Working Capital
- **Audit (5)**: Preparer, Workpaper Organizer, Materiality, Sampling, Deficiency
- **ICFR (6)**: Designer, Monitor, SoD, Fraud, ITGC, Walkthrough
- **Legal & Tax (7)**: Restructuring, Lockup, Related Party, Governance,
  Cross-Border Tax, Transfer Pricing, Treaty
- **Valuation (5)**: DCF, Comps, Precedent Tx, WACC, Sensitivity
- **Disclosure (7)**: Business, Risk Factors, Use of Proceeds, MD&A,
  Amendment Planner, Investor Narrative, ESG Metric
- **Post-IPO (4)**: Stock Price Sim, Roadshow Q&A Sim, Quarterly Filing, Lockup Tracker
- **Industry Support (2)**: Competitive Positioner, TAM/SAM/SOM Estimator
- **RAG (3)**: Regulation Retriever, Precedent Case Retriever, Industry Benchmark Retriever

**Total: ~80 agents** in MVP catalog (exact count exported from
`IPO_AGENT_COUNT` constant).

---

## Database Layer

All schema lives in `db/ipo_schema.sql`, RLS in `db/ipo_rls.sql`, seed in
`db/ipo_seed.sql`. Highlights:

- `ipo_projects`, `ipo_workstreams`, `ipo_findings` — project / work / observation hierarchy
- `ipo_filing_documents` + `ipo_review_signoffs` — versioned docs with **DB-enforced** signoff gate (trigger `enforce_signoff_gate`)
- `ipo_regulations` + `ipo_regulation_chunks` (pgvector 1536-dim) — RAG knowledge base
- `ipo_ai_citations` — every AI claim linked to a chunk
- `ipo_valuation_models`, `ipo_stock_simulations` — quantitative outputs
- `ipo_regulator_qa` — comment-letter / hearing tracker
- `ipo_industry_benchmarks` — public reference data (no tenant_id)
- `ipo_ai_providers` — Phase 2 LLM provider config

Seed data in Phase 1 includes **40+ regulation registry rows** (SEC, NASDAQ,
NYSE, HKEX, FASB, IASB, PCAOB) with section paths pre-populated, and
**~30 industry benchmark rows** for SaaS / BioPharma / Clean Energy.

---

## Phase 2 Roadmap (when AI is wired up)

1. **AI Provider config UI** (`/settings/ai-providers`) → write to `ipo_ai_providers`
2. **LLMProvider abstraction layer** (`src/ipo/llm/provider.ts`) → tokenhot, OpenAI, Anthropic, DeepSeek
3. **RAG ingestion pipeline** (`scripts/ingest-regulations.ts`) → fetch SEC EDGAR / HKEX disclosures, chunk, embed
4. **Agent activation** — wire each AGENT.md → real LLM call with skill template + RAG retrieval + citation enforcement
5. **Self-improvement loop** — capture human review feedback, distill into prompt revisions

---

## How to Run (current, Phase 1)

```bash
cd /home/user/webapp
bun install
bun run db:migrate         # ClawKeeper base schema
psql $DATABASE_URL -f db/ipo_schema.sql
psql $DATABASE_URL -f db/ipo_rls.sql
psql $DATABASE_URL -f db/ipo_seed.sql
bun run dev                # Backend on :9100
bun run dashboard:dev      # Frontend on :3000
```

The IPOPilot workspace lives under `/ipo` in the dashboard.
