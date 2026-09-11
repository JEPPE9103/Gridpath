/**
 * Pure safety helpers for the sales-demo reset. No database I/O.
 */

export const FORBIDDEN_TABLE_TOKENS = [
  "grid_sources",
  "grid_areas",
  "grid_observations",
  "observation_versions",
  "source_snapshots",
  "external_changes",
  "change_impacts",
  "alerts",
  "official_geographic_features",
  "official_physical_summaries",
  "official_transport_features",
  "official_administrative_areas",
];

export const CUSTOMER_VISIBLE_FORBIDDEN = /\b(e2e|proof|fixture|seed|test)\b/i;

export const DEMO_RESET_CONFIRM_ENV = "NOXHEIM_CONFIRM_DEMO_RESET";

export function parseDemoSeedMode(argv = process.argv) {
  if (argv.includes("--plan")) return "plan";
  if (argv.includes("--preflight")) return "preflight";
  if (argv.includes("--validate")) return "validate";
  return "reset";
}

export function confirmationValueFromArgv(argv = process.argv) {
  const flag = argv.find((item) => item.startsWith("--confirm="));
  return flag ? flag.slice("--confirm=".length).trim() : "";
}

export function assertDemoResetConfirmed({
  mode,
  remote,
  slug,
  env = process.env,
  argv = process.argv,
}) {
  if (mode !== "reset" || !remote) return;
  const provided = (env[DEMO_RESET_CONFIRM_ENV] || confirmationValueFromArgv(argv) || "").trim();
  if (provided !== slug) {
    throw new Error(
      `Remote demo reset refused: set ${DEMO_RESET_CONFIRM_ENV}=${slug} (or --confirm=${slug}). ` +
        "This extra acknowledgement is required in addition to NOXHEIM_ALLOW_REMOTE_DEMO_SEED.",
    );
  }
}

export function assertSqlSafe(sql, { demoOrgId, forbiddenTokens = FORBIDDEN_TABLE_TOKENS } = {}) {
  const stripped = sql.replace(/--.*$/gm, "").toLowerCase();
  for (const token of forbiddenTokens) {
    if (stripped.includes(token)) {
      throw new Error(`Refusing to run: generated SQL mentions forbidden table ${token}.`);
    }
  }
  if (stripped.includes("drop schema") || stripped.includes("truncate public.organizations")) {
    throw new Error("Refusing to run: destructive SQL detected.");
  }
  if (stripped.includes("delete from public.organizations") || stripped.includes("delete from public.grid_operators")) {
    throw new Error("Refusing to run: generated SQL would delete organizations or grid operators.");
  }
  if (!demoOrgId) {
    throw new Error("Refusing to run: demo organization id is required for SQL safety checks.");
  }
  assertMutationsAreDemoScoped(sql, demoOrgId);
}

function statementKind(statement) {
  if (/^\s*delete\b/i.test(statement)) return "delete";
  if (/^\s*update\b/i.test(statement)) return "update";
  if (/^\s*insert\b/i.test(statement)) return "insert";
  return "other";
}

export function assertMutationsAreDemoScoped(sql, demoOrgId) {
  const statements = sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const statement of statements) {
    const kind = statementKind(statement);
    if (kind !== "delete" && kind !== "update") continue;
    if (!statement.includes(demoOrgId)) {
      throw new Error(
        `Refusing to run: ${kind} is not scoped to the demo organization id.\n${statement.slice(0, 240)}`,
      );
    }
  }
}

export function collectCustomerVisibleNames({ orgName, projects, searches }) {
  return [
    orgName,
    ...projects.map((project) => project.name),
    ...projects.map((project) => project.slug),
    ...projects.flatMap((project) => project.requirements.map((item) => item.label)),
    ...projects.flatMap((project) => project.documents.map((item) => item.name)),
    ...projects.flatMap((project) => (project.case ? [project.case.reference, project.case.nextMilestone] : [])),
    ...searches.map((search) => search.name),
  ].filter(Boolean);
}

export function assertCustomerVisibleNamesClean(names) {
  for (const name of names) {
    if (CUSTOMER_VISIBLE_FORBIDDEN.test(String(name))) {
      throw new Error(`Refusing to seed customer-visible name containing a forbidden token: ${name}`);
    }
  }
}

export function classifyDemoUser(member) {
  const role = String(member.role ?? "");
  const otherOrgs = Number(member.other_org_memberships ?? member.otherOrgMemberships ?? 0);
  const canWrite = role === "owner" || role === "admin" || role === "member";
  return {
    profileId: member.profile_id ?? member.profileId ?? null,
    role,
    otherOrgMemberships: otherOrgs,
    canWrite,
    demoOrgOnly: otherOrgs === 0,
    suitable: canWrite,
    preferred: canWrite && otherOrgs === 0,
  };
}

export function pickDemoActor(members) {
  const classified = members.map(classifyDemoUser);
  return classified.find((item) => item.preferred) ?? classified.find((item) => item.suitable) ?? null;
}
