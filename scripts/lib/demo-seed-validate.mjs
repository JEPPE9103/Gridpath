import {
  CUSTOMER_VISIBLE_FORBIDDEN,
} from "./demo-seed-safety.mjs";
import {
  DEMO_ORG_ID,
  DEMO_ORG_SLUG,
  FINAL_PROJECT_COUNT,
  PROMOTED_PROJECT,
  TARGET_CONNECTION_CASES,
  TARGET_DOCUMENTS,
  TARGET_SAVED_OPPORTUNITIES,
  PRIMARY_SEARCH,
} from "./sales-demo-portfolio.mjs";

export function evaluateDemoState({
  org,
  inventory,
  beforeInventory,
  projects,
  opportunities,
  searches,
}) {
  const failures = [];
  const notes = [];

  if (!org || org.id !== DEMO_ORG_ID) {
    failures.push("Demo organization id mismatch.");
  }
  if (!org || org.slug !== DEMO_ORG_SLUG) {
    failures.push(`Demo organization slug is ${org?.slug ?? "(missing)"}; expected ${DEMO_ORG_SLUG}.`);
  }

  if (inventory.projects !== FINAL_PROJECT_COUNT) {
    failures.push(`Expected ${FINAL_PROJECT_COUNT} projects; found ${inventory.projects}.`);
  }
  if (inventory.connection_cases !== TARGET_CONNECTION_CASES) {
    failures.push(`Expected ${TARGET_CONNECTION_CASES} connection cases; found ${inventory.connection_cases}.`);
  }
  if (inventory.documents !== TARGET_DOCUMENTS) {
    failures.push(`Expected ${TARGET_DOCUMENTS} document metadata rows; found ${inventory.documents}.`);
  }
  if (inventory.opportunities !== TARGET_SAVED_OPPORTUNITIES) {
    failures.push(`Expected ${TARGET_SAVED_OPPORTUNITIES} Opportunities; found ${inventory.opportunities}.`);
  }
  if (inventory.searches < 1) {
    failures.push("Expected at least one Discovery search.");
  }
  if (inventory.runs < 1) {
    failures.push("Expected at least one completed screening run.");
  }
  if (inventory.candidates < 1) {
    failures.push("Expected Candidate Sites from the real screening run.");
  }

  if (beforeInventory && inventory.other_org_projects !== beforeInventory.other_org_projects) {
    failures.push("Other-organization project count changed.");
  }
  if (beforeInventory && inventory.demo_alerts !== beforeInventory.demo_alerts) {
    failures.push("Demo-org alerts count changed; reset must not write alerts.");
  }
  if (beforeInventory && inventory.external_changes !== beforeInventory.external_changes) {
    failures.push("external_changes count changed; reset must not write official changes.");
  }

  const visible = [
    ...(projects ?? []).map((row) => row.name),
    ...(opportunities ?? []).map((row) => row.name),
    ...(searches ?? []).map((row) => row.name),
  ];
  for (const name of visible) {
    if (CUSTOMER_VISIBLE_FORBIDDEN.test(String(name ?? ""))) {
      failures.push(`Forbidden customer-visible name remains: ${name}`);
    }
  }

  const statusCounts = { shortlisted: 0, rejected: 0, promoted: 0 };
  for (const row of opportunities ?? []) {
    if (row.status === "shortlisted") statusCounts.shortlisted += 1;
    if (row.status === "rejected") statusCounts.rejected += 1;
    if (row.status === "promoted") statusCounts.promoted += 1;
  }
  if (statusCounts.shortlisted !== 1) failures.push(`Expected 1 shortlisted Opportunity; found ${statusCounts.shortlisted}.`);
  if (statusCounts.rejected !== 1) failures.push(`Expected 1 rejected Opportunity; found ${statusCounts.rejected}.`);
  if (statusCounts.promoted !== 1) failures.push(`Expected 1 promoted Opportunity; found ${statusCounts.promoted}.`);

  const promoted = (opportunities ?? []).find((row) => row.status === "promoted");
  const promotedProject = (projects ?? []).find((row) => row.slug === PROMOTED_PROJECT.slug);
  if (!promotedProject) {
    failures.push(`Missing promoted project ${PROMOTED_PROJECT.name}.`);
  } else if (!promotedProject.originating_opportunity_id) {
    failures.push("Promoted project is missing originating_opportunity_id.");
  }
  if (promoted && !promoted.promoted_project_id) {
    failures.push("Promoted Opportunity is missing promoted_project_id.");
  }
  if (
    promoted &&
    promotedProject &&
    promoted.promoted_project_id &&
    promotedProject.originating_opportunity_id &&
    (promoted.promoted_project_id !== promotedProject.id ||
      promotedProject.originating_opportunity_id !== promoted.id)
  ) {
    failures.push("Opportunity → Project continuity ids do not match.");
  }

  const primarySearch = (searches ?? []).find((row) => row.name === PRIMARY_SEARCH.name);
  if (!primarySearch) {
    failures.push(`Missing primary search ${PRIMARY_SEARCH.name}.`);
  }

  const duplicatePromotedMarker =
    promoted &&
    promotedProject &&
    promoted.status === "promoted" &&
    promoted.promoted_project_id === promotedProject.id;
  if (duplicatePromotedMarker) {
    notes.push("Map product hides promoted Opportunity markers; Project point remains.");
  }

  return {
    ok: failures.length === 0,
    failures,
    notes,
    statusCounts,
  };
}
