import { assertSqlSafe } from "./demo-seed-safety.mjs";
import {
  DEMO_ALLOWED_SLUGS,
  DEMO_ORG_ID,
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG,
  LAND_COVER_RULES,
  PROJECTS,
} from "./sales-demo-portfolio.mjs";

export function lit(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlIntervalDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return "null";
  if (n === 0) return "current_date";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  return `(current_date ${sign} ${abs})`;
}

function sqlTimestamptzDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return "now()";
  if (n === 0) return "now()";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  return `(now() ${sign} interval '${abs} days')`;
}

function operatorIdSql(project, operators) {
  const resolved = operators[project.operatorKey];
  if (!resolved?.id) {
    throw new Error(`Demo reset refused: operator ${project.operatorKey} was not resolved for ${project.name}.`);
  }
  return lit(resolved.id);
}

export function buildDiscoveryCleanupSql() {
  return `
-- Demo-org Discovery / Opportunity graph only. Official GI tables are never referenced.

update public.opportunity_searches
set latest_run_id = null
where organization_id = ${lit(DEMO_ORG_ID)};

update public.opportunity_run_candidates
set saved_opportunity_id = null
where organization_id = ${lit(DEMO_ORG_ID)};

update public.development_opportunities
set
  originating_candidate_id = null,
  originating_run_id = null,
  screening_search_id = null,
  promoted_project_id = null
where organization_id = ${lit(DEMO_ORG_ID)};

update public.projects
set originating_opportunity_id = null
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.portfolio_comparison_projects
where comparison_id in (
  select id from public.portfolio_comparisons
  where organization_id = ${lit(DEMO_ORG_ID)}
);

delete from public.portfolio_comparisons
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_reassessment_notices
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_assessment_versions
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_assessments
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_events
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.development_opportunities
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_run_zones
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_run_candidates
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_search_runs
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_searches
where organization_id = ${lit(DEMO_ORG_ID)};

delete from public.opportunity_screening_profiles
where organization_id = ${lit(DEMO_ORG_ID)};
`.trim();
}

export function buildPortfolioInsertSql(operators) {
  const projectInserts = PROJECTS.map((project) => {
    return `insert into public.projects (
  id, organization_id, grid_operator_id, name, slug, location, region, technology,
  import_mw, export_mw, voltage_level, connection_stage, connection_outlook,
  confidence, target_cod, description, created_at, updated_at
) values (
  ${lit(project.id)},
  ${lit(DEMO_ORG_ID)},
  ${operatorIdSql(project, operators)},
  ${lit(project.name)},
  ${lit(project.slug)},
  ${lit(project.location)},
  ${lit(project.region)},
  ${lit(project.technology)},
  ${project.mw},
  ${project.mw},
  ${lit(project.voltageLevel)},
  ${lit(project.stage)},
  ${lit(project.outlook)},
  ${lit(project.confidence)},
  ${lit(project.targetCod)},
  ${lit(project.description)},
  ${sqlTimestamptzDays(project.createdOffsetDays)},
  ${sqlTimestamptzDays(project.updatedOffsetDays)}
);`;
  }).join("\n\n");

  const siteInserts = PROJECTS.map((project) => {
    return `insert into public.project_sites (
  id, project_id, name, location, geom, is_primary
) values (
  ${lit(project.siteId)},
  ${lit(project.id)},
  ${lit(`${project.name} site`)},
  ${lit(project.location)},
  extensions.st_setsrid(extensions.st_makepoint(${project.longitude}, ${project.latitude}), 4326),
  true
);`;
  }).join("\n\n");

  const caseInserts = PROJECTS.filter((project) => project.case && project.caseId)
    .map((project) => {
      const item = project.case;
      return `insert into public.connection_cases (
  id, project_id, grid_operator_id, case_id, stage, status,
  submitted_at, next_milestone, deadline, notes, created_at, updated_at
) values (
  ${lit(project.caseId)},
  ${lit(project.id)},
  ${operatorIdSql(project, operators)},
  ${lit(item.reference)},
  ${lit(item.stage)},
  ${lit(item.status)},
  ${sqlIntervalDays(item.submittedOffsetDays)},
  ${lit(item.nextMilestone)},
  ${sqlIntervalDays(item.deadlineOffsetDays)},
  ${lit(item.notes)},
  ${sqlTimestamptzDays(project.createdOffsetDays)},
  ${sqlTimestamptzDays(project.updatedOffsetDays)}
);`;
    })
    .join("\n\n");

  const requirementInserts = PROJECTS.flatMap((project) =>
    project.requirements.map((item) => {
      const due = item.dueOffsetDays == null ? "null" : sqlIntervalDays(item.dueOffsetDays);
      return `insert into public.project_requirements (
  id, project_id, connection_case_id, label, status, required, category, due_date
) values (
  ${lit(item.id)},
  ${lit(project.id)},
  ${lit(project.caseId)},
  ${lit(item.label)},
  ${lit(item.status)},
  ${item.required ? "true" : "false"},
  ${lit(item.category)},
  ${due}
);`;
    }),
  ).join("\n");

  const documentInserts = PROJECTS.flatMap((project) =>
    project.documents.map((item) => {
      return `insert into public.documents (
  id, project_id, name, category, status
) values (
  ${lit(item.id)},
  ${lit(project.id)},
  ${lit(item.name)},
  ${lit(item.category)},
  ${lit(item.status)}
);`;
    }),
  ).join("\n");

  return [projectInserts, siteInserts, caseInserts, requirementInserts, documentInserts]
    .filter(Boolean)
    .join("\n\n");
}

export function buildTransactionalResetSql(operators) {
  const sql = `-- SAMPLE CUSTOMER DATA ONLY for the dedicated sales-demo organization.
-- TRANSACTIONAL PHASE. Does not modify official Grid Intelligence or notification tables.
-- Discovery execution happens after this transaction commits.

begin;

update public.organizations
set
  name = ${lit(DEMO_ORG_NAME)},
  slug = ${lit(DEMO_ORG_SLUG)}
where id = ${lit(DEMO_ORG_ID)}
  and slug in (${DEMO_ALLOWED_SLUGS.map(lit).join(", ")});

${buildDiscoveryCleanupSql()}

delete from public.projects
where organization_id = ${lit(DEMO_ORG_ID)};

${buildPortfolioInsertSql(operators)}

commit;
`;
  assertSqlSafe(sql, { demoOrgId: DEMO_ORG_ID });
  return sql;
}

export function landCoverRulesJson() {
  return JSON.stringify(LAND_COVER_RULES);
}
