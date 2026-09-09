/**
 * Portfolio attention — single product definition.
 *
 * Authoritative implementation: `deriveProjectAttention` in
 * `src/lib/intelligence/project-attention.ts`.
 *
 * Overview "Do next", Portfolio Attention, project Development Brief,
 * Connection Application next action, and Reports "Action required"
 * all use that function. Open alerts are a separate count. It is rule-based workflow
 * hygiene, not grid feasibility, connection probability, or a numeric risk score.
 *
 * See `docs/attention-model.md`.
 */
export {
  countNeedsAttentionProjects,
  projectIdsNeedingAttention,
} from "@/lib/intelligence/portfolio-attention";
