/**
 * Portfolio attention — single product definition.
 *
 * Authoritative implementation: `deriveProjectAttention` in
 * `src/lib/intelligence/project-attention.ts`.
 *
 * Overview KPI "Workflow attention", Portfolio Attention, project Development Brief,
 * and Reports "projects needing workflow attention" all use that function. Open
 * alerts are a separate count. It is rule-based workflow hygiene, not grid
 * feasibility or connection probability.
 *
 * See `docs/attention-model.md`.
 */
export {
  countNeedsAttentionProjects,
  projectIdsNeedingAttention,
} from "@/lib/intelligence/portfolio-attention";
