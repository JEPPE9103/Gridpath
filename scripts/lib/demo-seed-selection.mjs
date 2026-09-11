/**
 * Deterministic Opportunity selection from a real screening run.
 * Does not invent evidence, ranks, or geometry.
 */

export const OPPORTUNITY_ROLES = ["promoted", "shortlisted", "under_review", "saved", "rejected"];

function num(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sortSiteCandidates(rows) {
  return [...rows].sort((left, right) => {
    const leftRank = num(left.rank) ?? Number.POSITIVE_INFINITY;
    const rightRank = num(right.rank) ?? Number.POSITIVE_INFINITY;
    if (leftRank !== rightRank) return leftRank - rightRank;
    const leftHa = num(left.contiguous_area_ha) ?? num(left.usable_area_ha) ?? 0;
    const rightHa = num(right.contiguous_area_ha) ?? num(right.usable_area_ha) ?? 0;
    if (rightHa !== leftHa) return rightHa - leftHa;
    return String(left.id).localeCompare(String(right.id));
  });
}

function evidenceKey(row) {
  return [
    row.recommendation ?? "",
    row.data_confidence ?? "",
    row.local_covering_name ? "covered" : "uncovered",
    row.geometry_quality ?? "",
  ].join("|");
}

export function selectDemoOpportunityCandidates(rows, { count = 5 } = {}) {
  const sites = sortSiteCandidates(
    (rows ?? []).filter((row) => (row.candidate_kind ?? "site") === "site" && row.excluded !== true),
  );
  if (sites.length < count) {
    throw new Error(
      `Demo discovery refused: screening produced ${sites.length} eligible Candidate Sites; need at least ${count}.`,
    );
  }

  const picked = [];
  const used = new Set();
  const take = (row) => {
    if (!row || used.has(row.id)) return null;
    used.add(row.id);
    picked.push(row);
    return row;
  };

  take(sites[0]);
  const diverse = sites.find((row) => !used.has(row.id) && evidenceKey(row) !== evidenceKey(sites[0]));
  take(diverse ?? sites[1]);
  for (const row of sites) {
    if (picked.length >= count) break;
    take(row);
  }

  return OPPORTUNITY_ROLES.slice(0, count).map((role, index) => ({
    role,
    candidate: picked[index],
  }));
}

export function customerFacingOpportunityName(role, candidate, { promotedName }) {
  if (role === "promoted") return promotedName;
  const raw = String(candidate?.name ?? "").trim();
  if (raw && !/\b(e2e|proof|fixture|seed|test)\b/i.test(raw)) {
    return raw;
  }
  const municipality = String(candidate?.municipality ?? candidate?.region ?? "Örebro").trim();
  const rank = num(candidate?.rank) ?? indexFallback(role);
  return `${municipality} site ${rank}`;
}

function indexFallback(role) {
  return OPPORTUNITY_ROLES.indexOf(role) + 1;
}

export function describeCompareSet(assignments) {
  const compareRoles = ["shortlisted", "under_review", "saved"];
  const selected = assignments.filter((item) => compareRoles.includes(item.role)).slice(0, 3);
  const keys = new Set(selected.map((item) => evidenceKey(item.candidate)));
  return {
    candidateIds: selected.map((item) => item.candidate.id),
    meaningfulDifference: keys.size > 1,
    note:
      keys.size > 1
        ? "Compare uses real Candidate differences already present in the run."
        : "Compare candidates are real but similar; do not falsify Evidence Coverage.",
  };
}
