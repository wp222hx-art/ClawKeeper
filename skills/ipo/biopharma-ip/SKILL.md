# SKILL — biopharma-ip

> Bound to agent: `biopharma_ip_analyzer` (BioPharma IP Analyzer)

## When to use

Invoked by `biopharma_ip_analyzer` whenever its capabilities are routed:
- `ip_analysis`

## Inputs (schema)

```ts
// TODO: tighten this contract per skill
interface BiopharmaIpInput {
  project_id: string;
  tenant_id: string;
  target_market: 'US_NASDAQ' | 'US_NYSE' | 'HK_MAIN' | 'HK_GEM';
  industry: 'SAAS' | 'BIOPHARMA' | 'CLEAN_ENERGY' | 'OTHER';
  payload: unknown; // skill-specific
}
```

## Procedure

1. **Retrieve context** — call `ipo_regulation_retriever` /
   `ipo_industry_benchmark_retriever` as needed.
2. **Reason** — apply the rule(s) below to the payload, producing draft
   findings or draft text.
3. **Cite** — every regulatory or accounting claim MUST be linked to a `ipo_regulation_chunks.id`. Outputs without citations are rejected by the orchestration service.
4. **Hand off** — return the standard envelope; do NOT mark the
   document as final — that is the human signer's exclusive right.

## Outputs (schema)

```ts
interface BiopharmaIpOutput {
  summary: string;
  findings: Array<{
    category: string;
    severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    recommended_action: string | null;
    citations: string[]; // ipo_regulation_chunks.id
  }>;
  recommended_actions: string[];
  confidence: number; // 0..1
}
```

## Authoritative Sources

- Markets: SEC (Reg S-K, Reg S-X, S-1, F-1, SOX, JOBS Act),
  Nasdaq / NYSE Listing Rules, HKEX Main Board Rules, GEM Rules,
  HKEX Guidance Letters, Appendix 27 ESG Reporting Guide.
- Accounting: US GAAP (ASC 606, 718, 842), IFRS (15, 16),
  PCAOB AS 2201, AS 1105, AS 1215, AS 2401, AS 2315.
- Industry-specific authorities are listed in the corresponding
  industry agent's AGENT.md.

## Acceptance Tests

- [ ] Returns valid envelope conforming to the output schema.
- [ ] Every regulatory claim contains at least one valid citation.
- [ ] Confidence is calibrated against historical comment-letter outcomes (Phase 2).

---
*Auto-generated skeleton — replace placeholders with the canonical
prompt, examples, and golden-test cases for this skill.*
