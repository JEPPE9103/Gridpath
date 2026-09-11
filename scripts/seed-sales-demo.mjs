import {
  DESIGN_PARTNER_CLOUD_PROJECT_REF,
  queryIngestSql,
  resolveDemoSeedTarget,
  runDemoSeedSql,
} from "./lib/demo-seed-target.mjs";
import {
  assertCustomerVisibleNamesClean,
  assertDemoResetConfirmed,
  collectCustomerVisibleNames,
  parseDemoSeedMode,
  pickDemoActor,
} from "./lib/demo-seed-safety.mjs";
import { operatorLookupSql, resolveRequiredOperators } from "./lib/demo-seed-operators.mjs";
import { buildTransactionalResetSql } from "./lib/demo-seed-sql.mjs";
import {
  DEMO_ALLOWED_SLUGS,
  DEMO_ORG_ID,
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG,
  ENABLED_SEARCHES,
  FINAL_PROJECT_COUNT,
  PRIMARY_SEARCH,
  PROJECTS,
  PROMOTED_PROJECT,
  SECONDARY_SEARCH,
  STANDALONE_PROJECT_COUNT,
  TARGET_CONNECTION_CASES,
  TARGET_DOCUMENTS,
  TARGET_SAVED_OPPORTUNITIES,
  countSeededCases,
  countSeededDocuments,
  countSeededRequirements,
} from "./lib/sales-demo-portfolio.mjs";
import {
  demoInventorySql,
  demoMembersSql,
  normalizeInventory,
  orebroScreeningPrereqSql,
} from "./lib/demo-seed-counts.mjs";
import { evaluateDemoState } from "./lib/demo-seed-validate.mjs";
import { executeDemoDiscovery } from "./lib/demo-seed-discovery.mjs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

assertCustomerVisibleNamesClean(
  collectCustomerVisibleNames({
    orgName: DEMO_ORG_NAME,
    projects: PROJECTS,
    searches: [...ENABLED_SEARCHES, SECONDARY_SEARCH],
  }),
);

const mode = parseDemoSeedMode();

function printPlan() {
  console.log("NOXHEIM sales demo plan (non-destructive)");
  console.log("----------------------------------------");
  console.log("TRANSACTIONAL PHASE");
  console.log("  cleanup demo-org Discovery graph + projects/cases/requirements/documents");
  console.log("  never touches official GI, external_changes, alerts, or other orgs");
  console.log(`  organisation: ${DEMO_ORG_NAME} (${DEMO_ORG_SLUG} / ${DEMO_ORG_ID})`);
  console.log(`  standalone projects: ${STANDALONE_PROJECT_COUNT}`);
  for (const project of PROJECTS) {
    console.log(`    - ${project.name} (${project.slug}) ${project.technology} ${project.mw} MW ${project.stage}`);
  }
  console.log(`  connection cases: ${countSeededCases()} (target ${TARGET_CONNECTION_CASES})`);
  console.log(`  requirements: ${countSeededRequirements()}`);
  console.log(`  documents: ${countSeededDocuments()} metadata-only (target ${TARGET_DOCUMENTS})`);
  console.log(`  Örebro East Storage: NOT seeded here — created by promote_opportunity_to_project`);
  console.log("POST-TRANSACTION SCREENING PHASE");
  console.log(`  primary search: ${PRIMARY_SEARCH.name} bbox ${PRIMARY_SEARCH.bbox.west},${PRIMARY_SEARCH.bbox.south},${PRIMARY_SEARCH.bbox.east},${PRIMARY_SEARCH.bbox.north}`);
  console.log(`  secondary search: ${SECONDARY_SEARCH.name} — ${SECONDARY_SEARCH.status}`);
  console.log(`  ${SECONDARY_SEARCH.reason}`);
  console.log(`  save ${TARGET_SAVED_OPPORTUNITIES} real Candidate Sites; shortlist 1; reject 1; promote 1 → ${PROMOTED_PROJECT.name}`);
  console.log(`  final project count: ${FINAL_PROJECT_COUNT}`);
  console.log("Remote reset also requires:");
  console.log("  NOXHEIM_ALLOW_REMOTE_DEMO_SEED=true");
  console.log(`  NOXHEIM_REMOTE_PROJECT_REF=${DESIGN_PARTNER_CLOUD_PROJECT_REF}`);
  console.log(`  NOXHEIM_CONFIRM_DEMO_RESET=${DEMO_ORG_SLUG}`);
}

if (mode === "plan") {
  printPlan();
  process.exit(0);
}

const target = resolveDemoSeedTarget();

if (target.mode === "remote" && target.projectRef !== DESIGN_PARTNER_CLOUD_PROJECT_REF) {
  throw new Error("Remote demo seed refused: project ref is not allowlisted.");
}

assertDemoResetConfirmed({
  mode,
  remote: target.mode === "remote",
  slug: DEMO_ORG_SLUG,
});

const orgRows = queryIngestSql(
  target,
  `select id, name, slug from public.organizations where id = '${DEMO_ORG_ID}';`,
);
const org = orgRows[0];
if (!org) {
  throw new Error(
    `Refusing to run: dedicated demo organization ${DEMO_ORG_ID} was not found. Will not create a new organization or seed another tenant.`,
  );
}
if (!DEMO_ALLOWED_SLUGS.includes(org.slug)) {
  throw new Error(
    `Refusing to run: organization ${org.id} has slug "${org.slug}", which is not the allowlisted demo workspace.`,
  );
}

function loadInventory() {
  return normalizeInventory(queryIngestSql(target, demoInventorySql())[0] ?? {});
}

function loadMembers() {
  return queryIngestSql(target, demoMembersSql());
}

function loadOperators() {
  return resolveRequiredOperators(queryIngestSql(target, operatorLookupSql()));
}

function screeningPrereqStatus() {
  try {
    const row = queryIngestSql(target, orebroScreeningPrereqSql(PRIMARY_SEARCH.bbox))[0] ?? {};
    const landCover = row.land_cover_in_bbox === true || row.land_cover_in_bbox === "t";
    const protectedCatalog = row.protected_catalog === true || row.protected_catalog === "t";
    if (landCover) return { status: "PASS", row };
    if (protectedCatalog) return { status: "FAIL", row, detail: "Protected catalog exists but land-cover summaries do not intersect the Örebro East bbox." };
    return { status: "FAIL", row, detail: "Official screening layers were not found for the Örebro East bbox." };
  } catch (error) {
    return { status: "UNKNOWN", detail: error.message };
  }
}

const inventory = loadInventory();
const members = loadMembers();
const actor = pickDemoActor(members);
const operators = loadOperators();
const screening = screeningPrereqStatus();

function printCounts(label, counts) {
  console.log(`${label}:`);
  console.log(`  Searches: ${counts.searches}`);
  console.log(`  Runs: ${counts.runs}`);
  console.log(`  Candidates: ${counts.candidates}`);
  console.log(`  Zones: ${counts.zones}`);
  console.log(`  Opportunities: ${counts.opportunities}`);
  console.log(`  Comparisons: ${counts.comparisons}`);
  console.log(`  Projects: ${counts.projects}`);
  console.log(`  Connection cases: ${counts.connection_cases}`);
  console.log(`  Requirements: ${counts.requirements}`);
  console.log(`  Documents: ${counts.documents}`);
  console.log(`  Other-org projects: ${counts.other_org_projects}`);
}

function printPreflight() {
  console.log("NOXHEIM sales demo preflight (read-only)");
  console.log("----------------------------------------");
  console.log(`DEMO TARGET VERIFIED`);
  console.log(`Project: ${target.projectRef ?? "(local)"}`);
  console.log(`Organisation: ${org.id}`);
  console.log(`Slug: ${org.slug}`);
  console.log(`Name: ${org.name}`);
  console.log("Official protected tables: SAFE (reset SQL forbids GI / changes / alerts)");
  printCounts("Existing demo data", inventory);
  console.log("Operator resolution: PASS");
  for (const value of Object.values(operators)) {
    console.log(`  ${value.key}: ${value.name}`);
  }
  if (!actor) {
    console.log("Demo user: MISSING");
    console.log("DEMO USER REQUIRED");
  } else {
    console.log(`Demo user: ${actor.preferred ? "PASS" : "PASS WITH CONDITIONS"}`);
    console.log(`  role: ${actor.role}`);
    console.log(`  demo-org-only: ${actor.demoOrgOnly ? "yes" : "no"}`);
    console.log(`  profile: ${String(actor.profileId).slice(0, 8)}…`);
    if (!actor.demoOrgOnly) {
      console.log("  warning: this member also belongs to other organisations");
    }
  }
  console.log(`Örebro screening prerequisites: ${screening.status}`);
  if (screening.detail) console.log(`  ${screening.detail}`);
  console.log(`Västerås secondary search: ${SECONDARY_SEARCH.status}`);
  const ready =
    Boolean(actor) &&
    screening.status === "PASS" &&
    DEMO_ALLOWED_SLUGS.includes(org.slug);
  console.log(`READY TO RESET: ${ready ? "YES" : "NO"}`);
  console.log("This command did not delete or insert anything.");
  return ready;
}

if (mode === "preflight") {
  const ready = printPreflight();
  process.exit(ready ? 0 : 1);
}

function loadWorkspaceRows() {
  const projects = queryIngestSql(
    target,
    `select id::text as id, name, slug, originating_opportunity_id::text as originating_opportunity_id
from public.projects
where organization_id = '${DEMO_ORG_ID}'
order by name;`,
  );
  const opportunities = queryIngestSql(
    target,
    `select id::text as id, name, slug, status, promoted_project_id::text as promoted_project_id
from public.development_opportunities
where organization_id = '${DEMO_ORG_ID}'
order by name;`,
  );
  const searches = queryIngestSql(
    target,
    `select id::text as id, name
from public.opportunity_searches
where organization_id = '${DEMO_ORG_ID}'
order by created_at;`,
  );
  return { projects, opportunities, searches };
}

if (mode === "validate") {
  const after = loadInventory();
  const rows = loadWorkspaceRows();
  const result = evaluateDemoState({
    org: queryIngestSql(target, `select id, name, slug from public.organizations where id = '${DEMO_ORG_ID}';`)[0],
    inventory: after,
    beforeInventory: null,
    ...rows,
  });
  console.log(result.ok ? "Demo validation: PASS" : "Demo validation: FAIL");
  for (const failure of result.failures) console.log(`  - ${failure}`);
  for (const note of result.notes) console.log(`  note: ${note}`);
  process.exit(result.ok ? 0 : 1);
}

console.log("NOXHEIM sales demo reset");
console.log("------------------------");
console.log(`mode: ${target.mode}`);
console.log(`project_ref: ${target.projectRef ?? "(local)"}`);
console.log(`organization_id: ${org.id}`);
console.log(`organization_name: ${org.name} → ${DEMO_ORG_NAME}`);
console.log(`organization_slug: ${org.slug} → ${DEMO_ORG_SLUG}`);
printCounts("BEFORE", inventory);
console.log(`other organizations (untouched): ${inventory.other_organizations}`);
console.log("official grid tables: not modified");
console.log("external_changes / alerts: not created");
console.log(`TRANSACTIONAL PHASE will insert ${PROJECTS.length} standalone projects belonging ONLY to ${DEMO_ORG_ID}`);
console.log(`POST-TRANSACTION SCREENING PHASE will run ${PRIMARY_SEARCH.name} as the demo org`);
if (!actor) {
  throw new Error("DEMO USER REQUIRED: cannot execute product screening RPCs without an existing demo-org owner/admin/member.");
}
if (screening.status !== "PASS") {
  throw new Error(
    `Örebro screening prerequisites ${screening.status}${screening.detail ? `: ${screening.detail}` : ""}. Will not fabricate Candidate Sites.`,
  );
}

const sql = buildTransactionalResetSql(operators);
const dir = mkdtempSync(path.join(tmpdir(), "noxheim-demo-seed-"));
const file = path.join(dir, "reset.sql");
try {
  writeFileSync(file, sql, "utf8");
  runDemoSeedSql(target, file);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const afterOrg = queryIngestSql(
  target,
  `select id, name, slug from public.organizations where id = '${DEMO_ORG_ID}';`,
)[0];
const afterStandalone = queryIngestSql(
  target,
  `select name, slug from public.projects where organization_id = '${DEMO_ORG_ID}' order by name;`,
);
const afterOther = queryIngestSql(
  target,
  `select count(*)::int as count from public.projects where organization_id <> '${DEMO_ORG_ID}';`,
);

if (!afterOrg || afterOrg.slug !== DEMO_ORG_SLUG) {
  throw new Error("Demo reset finished but organization slug did not match the dedicated demo slug.");
}
if (afterStandalone.length !== STANDALONE_PROJECT_COUNT) {
  throw new Error(
    `Transactional phase finished with ${afterStandalone.length} projects; expected ${STANDALONE_PROJECT_COUNT} standalone projects.`,
  );
}
if ((afterOther[0]?.count ?? 0) !== inventory.other_org_projects) {
  throw new Error("Refusing to continue: project count outside the demo organization changed.");
}

console.log("TRANSACTIONAL PHASE: SUCCESS");
console.log("POST-TRANSACTION SCREENING PHASE: starting");

const discovery = await executeDemoDiscovery({
  target,
  actorId: actor.profileId,
});

const finalInventory = loadInventory();
if (finalInventory.other_org_projects !== inventory.other_org_projects) {
  throw new Error("Screening phase changed project count outside the demo organization.");
}

const rows = loadWorkspaceRows();
const validation = evaluateDemoState({
  org: afterOrg,
  inventory: finalInventory,
  beforeInventory: inventory,
  ...rows,
});

printCounts("AFTER", finalInventory);
console.log(`Primary search: ${PRIMARY_SEARCH.name} (${discovery.searchId})`);
console.log(`Run: ${discovery.runId}`);
console.log(`Candidate Sites: ${discovery.candidateCount}`);
console.log(`Compare: ${discovery.compare.note}`);
if (!discovery.compare.meaningfulDifference) {
  console.log("  Compare sites are real but similar — differences were not falsified.");
}
console.log(`Hero connection: /projects/stockholm-north-bess`);
console.log(`Promoted project: /projects/${PROMOTED_PROJECT.slug}`);

if (!validation.ok) {
  for (const failure of validation.failures) console.log(`  - ${failure}`);
  throw new Error("Demo reset finished but post-reset validation failed.");
}

console.log("Result: SUCCESS");
console.log(`canonical projects: ${finalInventory.projects}`);
for (const row of rows.projects) {
  console.log(`  - ${row.name} (${row.slug})`);
}
