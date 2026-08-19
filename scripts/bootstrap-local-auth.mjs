import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EMAIL = "anna@noxheim-demo.local";
const PASSWORD = "NoxheimDemo2026!";
const FULL_NAME = "Anna Hellström";
const JOB_TITLE = "Portfolio Manager";
const ORG_NAME = "NorthGrid Development AB";
const ORG_SLUG = "northgrid-development-ab";
const ROLE = "owner";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseCli = path.join(repoRoot, "node_modules", "supabase", "dist", "supabase.js");

function isLocalHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function assertLocalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Supabase URL: ${rawUrl}`);
  }

  if (!isLocalHostname(parsed.hostname)) {
    throw new Error(
      `Refusing to run: this bootstrap is local-only. URL must be localhost or 127.0.0.1, got ${parsed.hostname}.`,
    );
  }

  return parsed.origin;
}

function parseEnvOutput(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function runSupabase(args) {
  if (!existsSync(supabaseCli)) {
    throw new Error("Local supabase CLI is missing. Run npm install first.");
  }

  try {
    return execFileSync(process.execPath, [supabaseCli, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(detail || "supabase CLI command failed");
  }
}

function localStatusEnv() {
  try {
    return parseEnvOutput(runSupabase(["status", "-o", "env"]));
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    throw new Error(
      `Could not read local Supabase status. Start it with \`npx supabase start\`.\n${detail}`,
    );
  }
}

function loadLocalConfig() {
  const status = localStatusEnv();
  const envUrl = process.env.SUPABASE_URL?.trim();
  const url = assertLocalUrl(envUrl || status.API_URL || "http://127.0.0.1:54321");

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    status.SERVICE_ROLE_KEY ||
    status.SECRET_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing local service role key. Set SUPABASE_SERVICE_ROLE_KEY or start local Supabase so `npx supabase status` can provide it.",
    );
  }

  const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;

  if (envUrl) {
    assertLocalUrl(envUrl);
  }

  return { url, serviceRoleKey, publishableKey };
}

function assertUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Expected a UUID, got ${value}`);
  }
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryLocal(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-bootstrap-auth-"));
  const file = path.join(dir, "query.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const raw = runSupabase([
      "--output-format",
      "json",
      "db",
      "query",
      "--local",
      "-f",
      file,
    ]);
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) {
      return [];
    }
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed.rows ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function findUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Auth Admin listUsers failed: ${error.message}`);
    }

    const users = data.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      return match;
    }
    if (users.length < perPage) {
      return null;
    }
    page += 1;
    if (page > 20) {
      return null;
    }
  }
}

async function ensureAuthUser(supabase) {
  const existing = await findUserByEmail(supabase, EMAIL);
  const attributes = {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  };

  if (!existing) {
    const { data, error } = await supabase.auth.admin.createUser(attributes);
    if (error) {
      throw new Error(`Auth Admin createUser failed: ${error.message}`);
    }
    return { user: data.user, created: true };
  }

  const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });
  if (error) {
    throw new Error(`Auth Admin updateUserById failed: ${error.message}`);
  }
  return { user: data.user, created: false };
}

function ensureProfileAndMembership(userId) {
  assertUuid(userId);

  queryLocal(`
insert into public.profiles (id, full_name, job_title)
values (${quoteSql(userId)}::uuid, ${quoteSql(FULL_NAME)}, ${quoteSql(JOB_TITLE)})
on conflict (id) do update
set
  full_name = excluded.full_name,
  job_title = excluded.job_title;
`);

  queryLocal(`
insert into public.organization_members (organization_id, profile_id, role)
select org.id, ${quoteSql(userId)}::uuid, ${quoteSql(ROLE)}
from public.organizations as org
where org.slug = ${quoteSql(ORG_SLUG)}
   or org.name = ${quoteSql(ORG_NAME)}
order by case when org.slug = ${quoteSql(ORG_SLUG)} then 0 else 1 end
limit 1
on conflict (organization_id, profile_id)
do update set role = excluded.role;
`);

  const rows = queryLocal(`
select
  p.id as profile_id,
  p.full_name,
  p.job_title,
  o.id as organization_id,
  o.name as organization_name,
  o.slug as organization_slug,
  m.role
from public.profiles as p
join public.organization_members as m
  on m.profile_id = p.id
join public.organizations as o
  on o.id = m.organization_id
where p.id = ${quoteSql(userId)}::uuid
  and (o.slug = ${quoteSql(ORG_SLUG)} or o.name = ${quoteSql(ORG_NAME)});
`);

  const row = rows[0];
  if (!row) {
    throw new Error(
      `Could not find seeded organization ${ORG_NAME} (${ORG_SLUG}) or membership was not created.`,
    );
  }
  return row;
}

async function verifyPasswordLogin(url, publishableKey) {
  if (!publishableKey) {
    console.log("Skipped password check: local publishable key not available.");
    return;
  }

  const client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (error || !data.user) {
    throw new Error(`Password login check failed: ${error?.message ?? "no user returned"}`);
  }

  await client.auth.signOut();
  console.log("Password login check succeeded.");
}

async function main() {
  const { url, serviceRoleKey, publishableKey } = loadLocalConfig();
  console.log(`Bootstrapping local auth against ${url}`);

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { user, created } = await ensureAuthUser(supabase);
  if (!user?.id) {
    throw new Error("Auth Admin did not return a user id.");
  }

  const membership = ensureProfileAndMembership(user.id);

  console.log(created ? "Created auth user." : "Updated existing auth user.");
  console.log(`  email: ${EMAIL}`);
  console.log(`  user id: ${user.id}`);
  console.log(`  profile: ${membership.full_name} / ${membership.job_title}`);
  console.log(`  organization: ${membership.organization_name} (${membership.organization_slug})`);
  console.log(`  role: ${membership.role}`);
  await verifyPasswordLogin(url, publishableKey);
  console.log("Local login is ready.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
