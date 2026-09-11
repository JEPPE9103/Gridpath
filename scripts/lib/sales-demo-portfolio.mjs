/**
 * Canonical sales-demo portfolio (SAMPLE CUSTOMER DATA only).
 * Official Grid Intelligence is never written here.
 * Örebro East Storage is created later by promote_opportunity_to_project.
 */

export const DEMO_ORG_ID = "ea5096a9-8da3-42e6-9dbd-64097414cb03";
export const DEMO_ORG_SLUG = "noxheim-demo-development";
export const DEMO_ORG_NAME = "Northfield Energy Development AB";
export const DEMO_ALLOWED_SLUGS = ["jeppebattery", "noxheim-demo-development"];

export const SAMPLE_NOTE =
  "SAMPLE CUSTOMER DATA. Fictional development project for internal NOXHEIM sales demonstration. Not a real customer site. Not Official Source.";

export const STANDALONE_PROJECT_COUNT = 6;
export const PROMOTED_PROJECT_COUNT = 1;
export const FINAL_PROJECT_COUNT = STANDALONE_PROJECT_COUNT + PROMOTED_PROJECT_COUNT;
export const TARGET_CONNECTION_CASES = 4;
export const TARGET_SAVED_OPPORTUNITIES = 5;
export const TARGET_DOCUMENTS = 4;

export const PROMOTED_PROJECT = {
  name: "Örebro East Storage",
  slug: "orebro-east-storage",
  mw: 25,
};

export const PRIMARY_SEARCH = {
  key: "orebro-east-bess",
  name: "Örebro East BESS",
  technology: "battery_storage",
  country: "SE",
  region: "Örebro",
  municipality: null,
  enabled: true,
  bbox: { west: 14.9, south: 59.1, east: 15.4, north: 59.4 },
  minSiteAreaHa: 8,
  targetSiteAreaHa: 15,
  maxCandidateAreaHa: 30,
  maxReturnedCandidates: 25,
  excludeProtected: true,
  excludeNatura: true,
  maxSlopeDegrees: 5,
  slopeMode: "preference",
  maxRoadDistanceM: 1000,
  roadMode: "preference",
  rankingVersion: "suitability-v4",
  methodologyVersion: "site-generation-v2.1",
};

export const SECONDARY_SEARCH = {
  key: "vasteras-storage",
  name: "Västerås Storage screening",
  technology: "battery_storage",
  country: "SE",
  region: "Västmanland",
  municipality: "Västerås",
  enabled: false,
  bbox: null,
  status: "SECONDARY_SEARCH_NEEDS_VERIFIED_BBOX",
  reason:
    "No proven Västerås screening bbox exists in repo tooling. Only a project coordinate (16.5448, 59.6099) is available. Honesty wins: do not guess a search envelope.",
};

export const ENABLED_SEARCHES = [PRIMARY_SEARCH];

export const LAND_COVER_RULES = {
  water: "excluded",
  wetland: "excluded",
  forest: "neutral",
  agriculture: "deprioritised",
  open: "preferred",
  developed: "deprioritised",
  unclassified: "neutral",
};

export const PROJECTS = [
  {
    id: "d0e00000-0000-4000-8000-000000000101",
    siteId: "d0e00000-0000-4000-8000-000000000201",
    caseId: "d0e00000-0000-4000-8000-000000000301",
    slug: "stockholm-north-bess",
    name: "Stockholm North BESS",
    location: "Stockholm",
    region: "Stockholm",
    latitude: 59.3293,
    longitude: 18.0686,
    mw: 40,
    technology: "battery_storage",
    stage: "grid_study",
    outlook: "at_risk",
    confidence: "high",
    targetCod: "Q3 2028",
    voltageLevel: "20 kV",
    operatorKey: "ellevio",
    description: `${SAMPLE_NOTE} Connection-workflow hero beside official Ei context.`,
    story: "hero-advanced-at-risk",
    updatedOffsetDays: -1,
    createdOffsetDays: -40,
    case: {
      reference: "NF-STO-001",
      stage: "grid_study",
      status: "at_risk",
      submittedOffsetDays: -120,
      nextMilestone: "Study workshop / signed study agreement",
      deadlineOffsetDays: 6,
      notes:
        "SAMPLE CUSTOMER-ENTERED case. Fictional reference only. Not an operator filing or official status.",
    },
    requirements: [
      { id: "d0e00000-0000-4000-8000-000000000401", label: "Land control confirmed", status: "complete", required: true, category: "land" },
      { id: "d0e00000-0000-4000-8000-000000000402", label: "Site layout completed", status: "complete", required: true, category: "technical" },
      { id: "d0e00000-0000-4000-8000-000000000403", label: "Connection enquiry prepared", status: "complete", required: true, category: "grid" },
      { id: "d0e00000-0000-4000-8000-000000000404", label: "Connection application submitted", status: "complete", required: true, category: "grid" },
      { id: "d0e00000-0000-4000-8000-000000000405", label: "Single-line diagram available", status: "in_progress", required: true, category: "technical", dueOffsetDays: 6 },
      { id: "d0e00000-0000-4000-8000-000000000407", label: "Grid study response reviewed", status: "incomplete", required: true, category: "grid" },
    ],
    documents: [
      { id: "d0e00000-0000-4000-8000-000000000601", name: "Connection enquiry", category: "grid", status: "complete" },
      { id: "d0e00000-0000-4000-8000-000000000602", name: "Site layout", category: "technical", status: "complete" },
    ],
  },
  {
    id: "d0e00000-0000-4000-8000-000000000102",
    siteId: "d0e00000-0000-4000-8000-000000000202",
    caseId: "d0e00000-0000-4000-8000-000000000302",
    slug: "uppsala-storage",
    name: "Uppsala Storage",
    location: "Uppsala",
    region: "Uppsala",
    latitude: 59.8586,
    longitude: 17.6389,
    mw: 30,
    technology: "battery_storage",
    stage: "application",
    outlook: "favourable",
    confidence: "high",
    targetCod: "Q2 2028",
    voltageLevel: "20 kV",
    operatorKey: "vattenfall",
    description: `${SAMPLE_NOTE} Stronger workflow profile for comparison.`,
    story: "strong-high-readiness",
    updatedOffsetDays: -2,
    createdOffsetDays: -55,
    case: {
      reference: "NF-UPP-002",
      stage: "application",
      status: "on_track",
      submittedOffsetDays: -90,
      nextMilestone: "Completeness confirmation",
      deadlineOffsetDays: 45,
      notes: "SAMPLE CUSTOMER-ENTERED case. Fictional reference only.",
    },
    requirements: [
      { id: "d0e00000-0000-4000-8000-000000000410", label: "Land control confirmed", status: "complete", required: true, category: "land" },
      { id: "d0e00000-0000-4000-8000-000000000411", label: "Site layout completed", status: "complete", required: true, category: "technical" },
      { id: "d0e00000-0000-4000-8000-000000000412", label: "Single-line diagram available", status: "complete", required: true, category: "technical" },
      { id: "d0e00000-0000-4000-8000-000000000413", label: "Internal investment review", status: "complete", required: true, category: "commercial" },
    ],
    documents: [
      { id: "d0e00000-0000-4000-8000-000000000604", name: "Internal investment memo", category: "commercial", status: "complete" },
    ],
  },
  {
    id: "d0e00000-0000-4000-8000-000000000103",
    siteId: "d0e00000-0000-4000-8000-000000000203",
    caseId: null,
    slug: "vasteras-bess",
    name: "Västerås BESS",
    location: "Västerås",
    region: "Västmanland",
    latitude: 59.6099,
    longitude: 16.5448,
    mw: 35,
    technology: "battery_storage",
    stage: "enquiry",
    outlook: "possible",
    confidence: "medium",
    targetCod: "Q4 2029",
    voltageLevel: "20 kV",
    operatorKey: "ellevio",
    description: `${SAMPLE_NOTE} Early enquiry. No connection case opened yet.`,
    story: "enquiry",
    updatedOffsetDays: -3,
    createdOffsetDays: -30,
    case: null,
    requirements: [
      { id: "d0e00000-0000-4000-8000-000000000414", label: "Land control confirmed", status: "complete", required: true, category: "land" },
      { id: "d0e00000-0000-4000-8000-000000000415", label: "Connection enquiry prepared", status: "in_progress", required: true, category: "grid" },
    ],
    documents: [],
  },
  {
    id: "d0e00000-0000-4000-8000-000000000105",
    siteId: "d0e00000-0000-4000-8000-000000000205",
    caseId: "d0e00000-0000-4000-8000-000000000305",
    slug: "gavle-bess",
    name: "Gävle BESS",
    location: "Gävle",
    region: "Gävleborg",
    latitude: 60.6749,
    longitude: 17.1413,
    mw: 20,
    technology: "battery_storage",
    stage: "application",
    outlook: "possible",
    confidence: "medium",
    targetCod: "Q3 2029",
    voltageLevel: "20 kV",
    operatorKey: "vattenfall",
    description: `${SAMPLE_NOTE} Application-stage site with outstanding customer attachments.`,
    story: "application-attention",
    updatedOffsetDays: -1,
    createdOffsetDays: -50,
    case: {
      reference: "NF-GAV-004",
      stage: "application",
      status: "waiting",
      submittedOffsetDays: -60,
      nextMilestone: "Outstanding customer attachments",
      deadlineOffsetDays: 21,
      notes: "SAMPLE CUSTOMER-ENTERED case. Fictional reference only.",
    },
    requirements: [
      { id: "d0e00000-0000-4000-8000-000000000418", label: "Land control confirmed", status: "complete", required: true, category: "land" },
      { id: "d0e00000-0000-4000-8000-000000000419", label: "Connection enquiry prepared", status: "incomplete", required: true, category: "grid" },
      { id: "d0e00000-0000-4000-8000-000000000420", label: "Site layout completed", status: "not_started", required: true, category: "technical" },
      { id: "d0e00000-0000-4000-8000-000000000421", label: "Single-line diagram available", status: "missing", required: true, category: "technical", dueOffsetDays: -3 },
      { id: "d0e00000-0000-4000-8000-000000000442", label: "Internal investment review", status: "not_started", required: true, category: "commercial" },
    ],
    documents: [],
  },
  {
    id: "d0e00000-0000-4000-8000-000000000109",
    siteId: "d0e00000-0000-4000-8000-000000000209",
    caseId: "d0e00000-0000-4000-8000-000000000309",
    slug: "goteborg-west-bess",
    name: "Göteborg West BESS",
    location: "Göteborg",
    region: "Västra Götaland",
    latitude: 57.7089,
    longitude: 11.9746,
    mw: 50,
    technology: "battery_storage",
    stage: "application",
    outlook: "favourable",
    confidence: "high",
    targetCod: "Q2 2029",
    voltageLevel: "130 kV",
    operatorKey: "goteborg",
    description: `${SAMPLE_NOTE} Larger west-coast application with complete required workflow.`,
    story: "application-complete",
    updatedOffsetDays: -4,
    createdOffsetDays: -80,
    case: {
      reference: "NF-GOT-007",
      stage: "application",
      status: "on_track",
      submittedOffsetDays: -90,
      nextMilestone: "Application review meeting",
      deadlineOffsetDays: 60,
      notes: "SAMPLE CUSTOMER-ENTERED case. Fictional reference only.",
    },
    requirements: [
      { id: "d0e00000-0000-4000-8000-000000000434", label: "Land control confirmed", status: "complete", required: true, category: "land" },
      { id: "d0e00000-0000-4000-8000-000000000435", label: "Site layout completed", status: "complete", required: true, category: "technical" },
      { id: "d0e00000-0000-4000-8000-000000000436", label: "Single-line diagram available", status: "complete", required: true, category: "technical" },
      { id: "d0e00000-0000-4000-8000-000000000437", label: "Internal investment review", status: "complete", required: true, category: "commercial" },
    ],
    documents: [
      { id: "d0e00000-0000-4000-8000-000000000605", name: "Connection application", category: "grid", status: "in_progress" },
    ],
  },
  {
    id: "d0e00000-0000-4000-8000-000000000111",
    siteId: "d0e00000-0000-4000-8000-000000000211",
    caseId: null,
    slug: "kalmar-south-solar",
    name: "Kalmar South Solar",
    location: "Kalmar",
    region: "Kalmar",
    latitude: 56.6634,
    longitude: 16.3567,
    mw: 40,
    technology: "solar",
    stage: "prospect",
    outlook: "possible",
    confidence: "medium",
    targetCod: "Q2 2031",
    voltageLevel: null,
    operatorKey: "eon",
    description: `${SAMPLE_NOTE} Early solar prospect. No connection case opened yet.`,
    story: "prospect-solar",
    updatedOffsetDays: -5,
    createdOffsetDays: -20,
    case: null,
    requirements: [],
    documents: [],
  },
];

export function countSeededRequirements(projects = PROJECTS) {
  return projects.reduce((sum, project) => sum + project.requirements.length, 0);
}

export function countSeededDocuments(projects = PROJECTS) {
  return projects.reduce((sum, project) => sum + project.documents.length, 0);
}

export function countSeededCases(projects = PROJECTS) {
  return projects.filter((project) => project.case && project.caseId).length;
}
