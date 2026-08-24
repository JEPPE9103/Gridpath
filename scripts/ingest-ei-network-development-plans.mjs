/**
 * Ingest Energimarknadsinspektionen (Ei) official Nätutvecklingsplaner (NUP)
 * structured Excel + official planning-area FeatureServer polygons.
 *
 * Discovers the current Excel from Ei's landing page (no hardcoded download
 * timestamp). Stores a hashed source snapshot, planning_area polygons
 * (EPSG:3006 → EPSG:4326), and grid_observations.
 *
 * Forecast MW is FORECAST TRANSFER-CAPACITY NEED, never available capacity.
 * First successful import is a BASELINE: copies observation versions, creates
 * no external_changes, and does not generate alerts.
 *
 * A later NEW workbook hash stores versions, diffs against the previous
 * snapshot, and may create external_changes + geographic change_impacts.
 * It still does not create customer alerts.
 *
 * Refuses any non-localhost Supabase target.
 *
 * Usage:
 *   npm run dev:ingest-ei-nup
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANDING_URL =
  "https://ei.se/bransch/natutvecklingsplaner/karttjanst-natutvecklingsplaner";
const SOURCE_NAME = "Energimarknadsinspektionen — Nätutvecklingsplaner";
const SOURCE_SLUG = "ei-network-development-plans";
const SOURCE_PUBLISHER = "Energimarknadsinspektionen";
const SOURCE_CRS = "EPSG:3006";
const SOURCE_CRS_LABEL = "SWEREF 99 TM / EPSG:3006";
const TARGET_CRS = "EPSG:4326";
const AREA_TYPE = "planning_area";
const PLANNING_PERIOD = "2025–2034";
const WHOLE_UNIT = "whole-unit";
const OFFICIAL_PROGNOS_FEATURE_SERVER =
  "https://services5.arcgis.com/Ffl7K2y4MZ3it6C6/arcgis/rest/services/Prognos_2025_03_18/FeatureServer/0";
const FORECAST_YEARS = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];
const FLEX_HORIZONS = [
  { key: "0-2", pattern: /0\s*[–-]\s*2/ },
  { key: "3-5", pattern: /3\s*[–-]\s*5/ },
  { key: "6-10", pattern: /6\s*[–-]\s*10/ },
];
const SEMANTIC_FORECAST = "forecast_transfer_capacity_need";
const SEMANTIC_INVESTMENT = "planned_investments_reported";
const SEMANTIC_FLEX = "flexibility_need";
const SEMANTIC_MEETS = "planned_measures_meet_own_network_need";
const SEMANTIC_OVERLYING = "overlying_network_limitation";
const NUP_IMPACT_REASON =
  "Project site's primary coordinate intersects the NUP planning area associated with this published change.";
const USER_AGENT = "NOXHEIM-local-ingest/1.0 (official public NUP retrieval)";

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
      `Refusing to run: this ingest is local-only. URL must be localhost or 127.0.0.1, got ${parsed.hostname}.`,
    );
  }
  return parsed.origin;
}

function parseEnvOutput(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
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
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(detail || "supabase CLI command failed");
  }
}

function loadLocalConfig() {
  let status = {};
  try {
    status = parseEnvOutput(runSupabase(["status", "-o", "env"]));
  } catch (error) {
    throw new Error(
      `Could not read local Supabase status. Start it with \`npx supabase start\`.\n${error.message}`,
    );
  }
  const envUrl = process.env.SUPABASE_URL?.trim();
  const url = assertLocalUrl(envUrl || status.API_URL || "http://127.0.0.1:54321");
  if (envUrl) {
    assertLocalUrl(envUrl);
  }
  return { url };
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function queryLocal(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-ei-nup-"));
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

function requireRow(rows, label) {
  const row = rows[0];
  if (!row) {
    throw new Error(`Expected a row for ${label}.`);
  }
  return row;
}

function digestExternalIds(ids) {
  return createHash("md5")
    .update(
      [...ids]
        .map((id) => String(id))
        .sort()
        .join("\n"),
    )
    .digest("hex");
}

function isTransientDbError(error) {
  const message = String(error?.message ?? error);
  return /connection terminated|econnreset|failed to connect to postgres|LegacyDbConnectError|the database system is|timeout expired|could not connect/i.test(
    message,
  );
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Bound busy-wait for CLI retry only.
  }
}

function queryLocalRetry(sql, { attempts = 4, label = "query" } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return queryLocal(sql);
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts) {
        throw error;
      }
      console.warn(
        `Transient database error during ${label} (attempt ${attempt}/${attempts}); retrying.`,
      );
      sleepSync(400 * attempt);
    }
  }
  throw lastError;
}

function snapshotCompleteness(snapshotId, sourceId, expected) {
  const observationIds = queryLocalRetry(
    `
select external_id
from public.grid_observations
where source_id = ${quoteSql(sourceId)}::uuid;
`,
    { label: "observation ids" },
  ).map((row) => row.external_id);
  const versionIds = queryLocalRetry(
    `
select external_id
from public.grid_observation_versions
where source_snapshot_id = ${quoteSql(snapshotId)}::uuid;
`,
    { label: "observation version ids" },
  ).map((row) => row.external_id);
  const areaRow = requireRow(
    queryLocalRetry(
      `
select count(*)::int as area_count
from public.grid_areas
where source_id = ${quoteSql(sourceId)}::uuid
  and area_type = ${quoteSql(AREA_TYPE)};
`,
      { label: "planning area count" },
    ),
    "planning area count",
  );

  const observationCount = observationIds.length;
  const versionCount = versionIds.length;
  const areaCount = Number(areaRow.area_count ?? 0);
  const observationDigest = digestExternalIds(observationIds);
  const versionDigest = digestExternalIds(versionIds);
  const complete =
    observationCount === expected.expected_observation_count &&
    versionCount === expected.expected_observation_version_count &&
    areaCount === expected.expected_planning_area_count &&
    observationDigest === expected.observation_id_digest &&
    versionDigest === expected.observation_id_digest;

  return {
    complete,
    observationCount,
    versionCount,
    areaCount,
    missingObservations: Math.max(0, expected.expected_observation_count - observationCount),
    missingVersions: Math.max(0, expected.expected_observation_version_count - versionCount),
    observationDigest,
    versionDigest,
  };
}

function mergeSnapshotMetadata(snapshotId, patch, status = null) {
  const statusSql = status == null ? "" : `, status = ${quoteSql(status)}`;
  queryLocalRetry(
    `
update public.source_snapshots
set metadata = coalesce(metadata, '{}'::jsonb) || ${quoteSql(JSON.stringify(patch))}::jsonb
    ${statusSql}
where id = ${quoteSql(snapshotId)}::uuid;
`,
    { label: "source_snapshots metadata" },
  );
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&aring;/gi, "å")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(text) {
  return String(text ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#10;", "\n")
    .replaceAll("&#13;", "\r")
    .replaceAll("&apos;", "'");
}

function collapseWs(value) {
  return String(value ?? "")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAccountingUnit(raw) {
  return collapseWs(raw);
}

function isLeakedObjectId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 100000) {
    return true;
  }
  const text = collapseWs(value);
  return /^\d{1,6}$/.test(text);
}

function normalizeDelomrade(raw, { treatNumericAsWholeUnit = false } = {}) {
  if (raw == null || raw === "") {
    return WHOLE_UNIT;
  }
  if (treatNumericAsWholeUnit && isLeakedObjectId(raw)) {
    return WHOLE_UNIT;
  }
  const text = collapseWs(raw);
  return text || WHOLE_UNIT;
}

function gisDelomrade(company, natfor) {
  const label = collapseWs(natfor);
  const officialCompany = collapseWs(company);
  if (!label) {
    return WHOLE_UNIT;
  }
  if (officialCompany && label === officialCompany) {
    return WHOLE_UNIT;
  }
  if (!label.includes(",")) {
    return WHOLE_UNIT;
  }
  return label;
}

function planningIdentity(accountingUnit, delomrade) {
  return `${accountingUnit}|${delomrade}`;
}

function observationIdentity(planningId, kind, extra) {
  return extra == null ? `${planningId}|${kind}` : `${planningId}|${kind}|${extra}`;
}

function cellAsText(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value);
}

function parseCleanNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = collapseWs(value);
  if (!text) {
    return null;
  }
  if (!/^-?(?:\d{1,3}(?:[ \u00A0]\d{3})+|\d+)(?:[.,]\d+)?$/.test(text)) {
    return null;
  }
  const compact = text.replace(/[ \u00A0]/g, "").replace(",", ".");
  const parsed = Number(compact);
  return Number.isFinite(parsed) ? parsed : null;
}

function pad(value, width) {
  const text = value == null || value === "" ? "—" : String(value);
  if (text.length >= width) {
    return text;
  }
  return text + " ".repeat(width - text.length);
}

function clip(value, width) {
  const text = value == null || value === "" ? "—" : String(value).replaceAll("\n", " / ");
  if (text.length <= width) {
    return text;
  }
  return `${text.slice(0, width - 1)}…`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }
  return { text: await response.text(), finalUrl: response.url || url };
}

async function downloadBuffer(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const filename = decodeURIComponent(
    new URL(url).pathname.split("/").filter(Boolean).pop() || "download.xlsx",
  );
  return { bytes, filename, finalUrl: response.url || url };
}

function discoverNupXlsxUrl(html, landingUrl) {
  const candidates = [];
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]+)"/i);
    if (!hrefMatch) {
      continue;
    }
    const href = hrefMatch[1];
    let decoded = href;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      decoded = href;
    }
    if (!/\.xlsx(?:$|[?#])/i.test(href) && !/\.xlsx(?:$|[?#])/i.test(decoded)) {
      continue;
    }
    const text = stripTags(match[2] ?? "").toLowerCase();
    const hrefLower = decoded.toLowerCase();
    const score =
      (text.includes("nätutveckling") ||
      hrefLower.includes("nätutveckling") ||
      hrefLower.includes("natutveckling")
        ? 2
        : 0) +
      (text.includes("karttjänst") ||
      hrefLower.includes("karttjanst") ||
      hrefLower.includes("karttjänst")
        ? 2
        : 0) +
      1;
    candidates.push({ url: new URL(href, landingUrl).href, score, text });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates[0]) {
    throw new Error(
      "Could not discover the official Ei NUP Excel on the landing page. Refusing to use a hardcoded stale URL.",
    );
  }
  return candidates[0].url;
}

function collectArcgisPageUrls(html) {
  const urls = new Set();
  const patterns = [
    /https?:\/\/(?:www\.)?storymaps\.arcgis\.com\/stories\/[a-z0-9]+/gi,
    /https?:\/\/experience\.arcgis\.com\/experience\/[a-z0-9]+/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      urls.add(match[0]);
    }
  }
  return [...urls];
}

function unescapeJsonUrl(url) {
  return url.replaceAll("\\u002f", "/").replaceAll("\\/", "/");
}

function extractFeatureServers(text) {
  const found = [];
  const patterns = [
    /https:\\?\/\\?\/services5\.arcgis\.com\/[^"'\\\s<>]+FeatureServer\/\d+/gi,
    /https:\/\/services5\.arcgis\.com\/[^"'\\\s<>]+FeatureServer\/\d+/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      found.push(unescapeJsonUrl(match[0]));
    }
  }
  return [...new Set(found)];
}

async function discoverPrognosFeatureServer(pageUrls) {
  for (const pageUrl of pageUrls) {
    try {
      const { text } = await fetchText(pageUrl);
      const servers = extractFeatureServers(text);
      const prognos = servers.find((url) => /Prognos/i.test(url));
      if (prognos) {
        return { url: prognos, discovered: true, from: pageUrl };
      }
      const itemId =
        pageUrl.match(/stories\/([a-z0-9]+)/i)?.[1] ??
        pageUrl.match(/experience\/([a-z0-9]+)/i)?.[1];
      if (itemId) {
        const { text: itemText } = await fetchText(
          `https://www.arcgis.com/sharing/rest/content/items/${itemId}/data?f=json`,
        );
        const itemServers = extractFeatureServers(itemText);
        const itemPrognos = itemServers.find((url) => /Prognos/i.test(url));
        if (itemPrognos) {
          return { url: itemPrognos, discovered: true, from: pageUrl };
        }
      }
    } catch {
      // Keep trying other official ArcGIS pages, then fall back.
    }
  }
  return {
    url: OFFICIAL_PROGNOS_FEATURE_SERVER,
    discovered: false,
    from: "reconnaissance official FeatureServer fallback",
  };
}

function extractZip(zipBytes, destDir) {
  const zipPath = path.join(destDir, "source.xlsx");
  writeFileSync(zipPath, zipBytes);
  execFileSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "ignore" });
}

function parseSharedStrings(xml) {
  const strings = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = re.exec(xml))) {
    const texts = [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((item) =>
      decodeXml(item[1]),
    );
    strings.push(texts.join(""));
  }
  return strings;
}

function colToIndex(col) {
  let n = 0;
  for (const ch of col) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function parseSheetXml(xml, strings) {
  const rows = new Map();
  const cellRe = /<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>|<c r="([A-Z]+)(\d+)"([^>]*)\/>/g;
  let match;
  while ((match = cellRe.exec(xml))) {
    const col = match[1] || match[5];
    const row = Number(match[2] || match[6]);
    const attrs = match[3] || match[7] || "";
    const inner = match[4] || "";
    const t = /t="([^"]+)"/.exec(attrs)?.[1] || "";
    let value = null;
    if (t === "s") {
      const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
      value = v != null ? strings[Number(v)] : "";
    } else if (t === "inlineStr") {
      value = decodeXml(/<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1] || "");
    } else if (t === "b") {
      value = /<v>([^<]*)<\/v>/.exec(inner)?.[1] === "1";
    } else if (t === "str") {
      value = decodeXml(/<v>([^<]*)<\/v>/.exec(inner)?.[1] ?? "");
    } else {
      const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
      if (v == null || v === "") {
        value = "";
      } else if (/^-?\d+(\.\d+)?(E[+-]?\d+)?$/i.test(v)) {
        value = Number(v);
      } else {
        value = v;
      }
    }
    if (!rows.has(row)) {
      rows.set(row, []);
    }
    rows.get(row)[colToIndex(col)] = value;
  }
  const maxRow = Math.max(...rows.keys(), 0);
  const table = [];
  for (let i = 1; i <= maxRow; i += 1) {
    table.push(rows.get(i) ?? []);
  }
  return table;
}

function parseWorkbook(xlsxDir) {
  const stringsPath = path.join(xlsxDir, "xl", "sharedStrings.xml");
  const strings = existsSync(stringsPath) ? parseSharedStrings(readFileSync(stringsPath, "utf8")) : [];
  const workbookXml = readFileSync(path.join(xlsxDir, "xl", "workbook.xml"), "utf8");
  const relsXml = readFileSync(path.join(xlsxDir, "xl", "_rels", "workbook.xml.rels"), "utf8");
  const rels = new Map();
  for (const match of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    rels.set(match[1], match[2].replace(/^\//, "").replace(/^\.\.\//, ""));
  }
  const sheets = [];
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const attrs = match[1];
    const name = decodeXml(/name="([^"]+)"/.exec(attrs)?.[1] ?? "");
    const rId = /r:id="([^"]+)"/.exec(attrs)?.[1];
    const target = rId ? rels.get(rId) : null;
    if (!name || !target) {
      continue;
    }
    const sheetPath = path.join(xlsxDir, "xl", target.replace(/^xl\//, ""));
    const table = parseSheetXml(readFileSync(sheetPath, "utf8"), strings);
    const headers = (table[0] || []).map((header) => collapseWs(header));
    const dataRows = table
      .slice(1)
      .filter((row) => row.some((cell) => cell != null && String(cell).trim() !== ""));
    sheets.push({ name, headers, dataRows });
  }
  const corePath = path.join(xlsxDir, "docProps", "core.xml");
  let modified = null;
  let created = null;
  if (existsSync(corePath)) {
    const core = readFileSync(corePath, "utf8");
    modified = /<(?:dcterms:)?modified[^>]*>([^<]+)</.exec(core)?.[1] ?? null;
    created = /<(?:dcterms:)?created[^>]*>([^<]+)</.exec(core)?.[1] ?? null;
  }
  return { sheets, modified, created };
}

function findSheet(sheets, pattern) {
  const sheet = sheets.find((item) => pattern.test(item.name));
  if (!sheet) {
    throw new Error(`Official workbook is missing expected sheet matching ${pattern}`);
  }
  return sheet;
}

function colIndex(headers, pred) {
  return headers.findIndex((header) => pred(header));
}

function requireCol(headers, label, pred) {
  const index = colIndex(headers, pred);
  if (index === -1) {
    throw new Error(`Sheet is missing column ${label}. Headers: ${headers.join(" | ")}`);
  }
  return index;
}

function rowObject(headers, row) {
  const object = {};
  headers.forEach((header, index) => {
    object[header] = row[index];
  });
  return object;
}

function ringToWkt(points) {
  if (points.length === 0) {
    return null;
  }
  const closed = [...points];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closed.push(first);
  }
  if (closed.length < 4) {
    return null;
  }
  return `(${closed.map(([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`).join(",")})`;
}

function esriPolygonToWkt(geometry) {
  const rings = geometry?.rings;
  if (!Array.isArray(rings) || rings.length === 0) {
    return null;
  }
  const parts = [];
  for (const ring of rings) {
    if (!Array.isArray(ring)) {
      continue;
    }
    const points = ring
      .filter((pair) => Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
      .map((pair) => [pair[0], pair[1]]);
    const wkt = ringToWkt(points);
    if (wkt) {
      parts.push(wkt);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  return `MULTIPOLYGON(${parts.map((ring) => `(${ring})`).join(",")})`;
}

function attr(attributes, names) {
  if (!attributes) {
    return null;
  }
  for (const name of names) {
    if (attributes[name] != null && String(attributes[name]).trim() !== "") {
      return attributes[name];
    }
  }
  const keys = Object.keys(attributes);
  const lower = names.map((name) => name.toLowerCase());
  for (const key of keys) {
    if (lower.includes(key.toLowerCase()) && attributes[key] != null && String(attributes[key]).trim() !== "") {
      return attributes[key];
    }
  }
  return null;
}

async function fetchFeaturePage(layerUrl, offset, pageSize) {
  const url = `${layerUrl}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=3006&f=json&resultOffset=${offset}&resultRecordCount=${pageSize}`;
  const { text } = await fetchText(url);
  return JSON.parse(text);
}

async function fetchAllFeatures(layerUrl) {
  const features = [];
  const pageSize = 50;
  let exceeded = true;
  for (let offset = 0; exceeded; offset += pageSize) {
    const page = await fetchFeaturePage(layerUrl, offset, pageSize);
    if (page.error) {
      throw new Error(`FeatureServer query failed: ${JSON.stringify(page.error)}`);
    }
    const batch = page.features ?? [];
    features.push(...batch);
    exceeded = Boolean(page.exceededTransferLimit) && batch.length > 0;
    if (batch.length === 0) {
      break;
    }
  }
  return features;
}

function applyUpsertStats(target, stats) {
  target.inserted += Number(stats.inserted ?? 0);
  target.updated += Number(stats.updated ?? 0);
  target.unchanged += Number(stats.unchanged ?? 0);
  target.invalid += Number(stats.invalid ?? 0);
}

async function main() {
  const { url } = loadLocalConfig();
  console.log(`Ei NUP ingest against ${url}`);
  console.log("Source class: official regulator NUP (not a NOXHEIM fixture)");
  console.log("Semantics: forecast MW = forecast transfer-capacity NEED, not available capacity.");

  const projectFingerprintBefore = requireRow(
    queryLocal(`
select
  count(*)::int as project_count,
  md5(string_agg(
    p.id::text || '|' ||
    coalesce(p.grid_operator_id::text, '') || '|' ||
    coalesce(p.connection_outlook, '') || '|' ||
    coalesce(p.confidence, '') || '|' ||
    coalesce(p.connection_stage, '') || '|' ||
    coalesce(p.import_mw::text, '') || '|' ||
    coalesce(p.export_mw::text, ''),
    ',' order by p.id
  )) as fingerprint
from public.projects as p;
`),
    "project fingerprint before",
  );

  console.log(`\nDiscovering current Excel from:\n  ${LANDING_URL}`);
  const landing = await fetchText(LANDING_URL);
  const downloadUrl = discoverNupXlsxUrl(landing.text, LANDING_URL);
  console.log(`Official NUP Excel discovered:\n  ${downloadUrl}`);

  const downloaded = await downloadBuffer(downloadUrl);
  const contentHash = createHash("sha256").update(downloaded.bytes).digest("hex");
  console.log(`Downloaded ${downloaded.filename} (${downloaded.bytes.length} bytes)`);
  console.log(`Content hash (SHA-256): ${contentHash}`);

  const workDir = mkdtempSync(path.join(tmpdir(), "noxheim-ei-nup-xlsx-"));
  let workbook;
  try {
    extractZip(downloaded.bytes, workDir);
    workbook = parseWorkbook(workDir);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  const forecastSheet = findSheet(workbook.sheets, /behovet av överföringskapacitet/i);
  const investmentSheet = findSheet(workbook.sheets, /planerade investeringar/i);
  const flexSheet = findSheet(workbook.sheets, /flexibilitet/i);
  const meetsSheet = findSheet(workbook.sheets, /möter åtgärderna/i);

  const warnings = [];
  let leakedObjectIdRows = 0;
  function warn(message) {
    warnings.push(message);
    console.warn(`WARNING: ${message}`);
  }

  const fHeaders = forecastSheet.headers;
  const fRel = requireCol(fHeaders, "Redovisningsenhet", (h) => /redovisningsenhet/i.test(h));
  const fCompany = requireCol(
    fHeaders,
    "Nätföretag",
    (h) => /^nätföretag$/i.test(h) && !/delområde/i.test(h),
  );
  const fDel = requireCol(fHeaders, "Nätföretag och delområde", (h) => /delområde/i.test(h));
  const fLink = requireCol(fHeaders, "e-diarium link", (h) => /e-diarium|länk till/i.test(h));
  const yearCols = new Map();
  for (const year of FORECAST_YEARS) {
    const index = fHeaders.findIndex((header) => {
      const match = header.match(/prognos\s+(\d{4})/i);
      return match && Number(match[1]) === year;
    });
    if (index === -1) {
      throw new Error(`Forecast sheet is missing Prognos ${year} column`);
    }
    yearCols.set(year, index);
  }

  const identities = new Map();
  let numericForecastCount = 0;
  let textForecastCount = 0;
  let emptyForecastCount = 0;

  for (const [rowIndex, row] of forecastSheet.dataRows.entries()) {
    const accountingUnit = normalizeAccountingUnit(row[fRel]);
    if (!accountingUnit) {
      warn(`Forecast row ${rowIndex + 2} missing Redovisningsenhet; skipped.`);
      continue;
    }
    const company = collapseWs(row[fCompany]);
    const delomradeSource = row[fDel];
    const delomrade = normalizeDelomrade(delomradeSource);
    const identity = planningIdentity(accountingUnit, delomrade);
    if (identities.has(identity)) {
      warn(`Duplicate forecast identity ${identity}; later row skipped.`);
      continue;
    }
    const forecasts = [];
    for (const year of FORECAST_YEARS) {
      const raw = row[yearCols.get(year)];
      const original = cellAsText(raw);
      const numeric = parseCleanNumeric(raw);
      const empty = original.trim() === "";
      if (empty) {
        emptyForecastCount += 1;
      } else if (numeric == null) {
        textForecastCount += 1;
      } else {
        numericForecastCount += 1;
      }
      forecasts.push({
        year,
        column: forecastSheet.headers[yearCols.get(year)],
        original,
        numeric,
        representation: numeric == null ? "source_text" : "numeric_mw",
      });
    }
    identities.set(identity, {
      identity,
      accountingUnit,
      delomrade,
      delomradeSource: collapseWs(delomradeSource) || null,
      company,
      sourceUrl: collapseWs(row[fLink]) || null,
      sourceFields: rowObject(fHeaders, row),
      forecasts,
      investmentText: null,
      flexibility: [],
      meetsText: null,
      overlyingText: null,
    });
  }

  function attachByIdentity(sheet, treatNumericAsWholeUnit, apply) {
    const headers = sheet.headers;
    const relIdx = requireCol(headers, "Redovisningsenhet", (h) => /redovisningsenhet/i.test(h));
    const delIdx = colIndex(headers, (h) => /delområde/i.test(h));
    for (const [rowIndex, row] of sheet.dataRows.entries()) {
      const accountingUnit = normalizeAccountingUnit(row[relIdx]);
      if (!accountingUnit) {
        warn(`${sheet.name} row ${rowIndex + 2} missing Redovisningsenhet; skipped.`);
        continue;
      }
      const delomrade = normalizeDelomrade(delIdx === -1 ? "" : row[delIdx], {
        treatNumericAsWholeUnit,
      });
      if (treatNumericAsWholeUnit && delIdx !== -1 && isLeakedObjectId(row[delIdx])) {
        leakedObjectIdRows += 1;
      }
      const identity = planningIdentity(accountingUnit, delomrade);
      const record = identities.get(identity);
      if (!record) {
        warn(`${sheet.name} row ${rowIndex + 2} identity ${identity} has no forecast-sheet counterpart.`);
        continue;
      }
      apply(record, row, headers);
    }
  }

  const iHeaders = investmentSheet.headers;
  const iValue = requireCol(iHeaders, "planned investments", (h) => /planerade investeringar/i.test(h));
  attachByIdentity(investmentSheet, false, (record, row) => {
    record.investmentText = cellAsText(row[iValue]);
  });

  const xHeaders = flexSheet.headers;
  const flexCols = FLEX_HORIZONS.map((horizon) => {
    const index = xHeaders.findIndex(
      (header) => /flexibilitet/i.test(header) && horizon.pattern.test(header),
    );
    if (index === -1) {
      throw new Error(`Flexibility sheet is missing ${horizon.key} column`);
    }
    return { ...horizon, index, column: xHeaders[index] };
  });
  attachByIdentity(flexSheet, true, (record, row) => {
    record.flexibility = flexCols.map((col) => {
      const raw = row[col.index];
      return {
        horizon: col.key,
        column: col.column,
        original: cellAsText(raw),
        numeric: parseCleanNumeric(raw),
      };
    });
  });

  const mHeaders = meetsSheet.headers;
  const mMeets = requireCol(mHeaders, "meets need", (h) => /möter de planerade åtgärderna/i.test(h));
  const mOver = requireCol(mHeaders, "overlying network", (h) => /överliggande/i.test(h));
  attachByIdentity(meetsSheet, false, (record, row) => {
    record.meetsText = cellAsText(row[mMeets]);
    record.overlyingText = cellAsText(row[mOver]);
  });

  if (leakedObjectIdRows > 0) {
    warn(
      `Flexibility sheet: ${leakedObjectIdRows} rows had a numeric delområde cell (likely leaked ObjectID); treated as ${WHOLE_UNIT}. Original cell preserved in metadata.`,
    );
  }

  const arcgisPages = collectArcgisPageUrls(landing.text);
  const featureServer = await discoverPrognosFeatureServer(arcgisPages);
  console.log(
    `Planning-area FeatureServer (${featureServer.discovered ? "discovered" : "official fallback"}):\n  ${featureServer.url}`,
  );
  const gisFeatures = await fetchAllFeatures(featureServer.url);
  console.log(`Planning polygons retrieved: ${gisFeatures.length}`);

  const gisByIdentity = new Map();
  let skippedGis = 0;
  const skipReasons = {};
  function skipGis(reason) {
    skippedGis += 1;
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
  }

  for (const feature of gisFeatures) {
    const attributes = feature.attributes ?? {};
    const accountingUnit = normalizeAccountingUnit(
      attr(attributes, ["Redovisnin", "Redovisningsenhet"]),
    );
    if (!accountingUnit) {
      skipGis("missing_accounting_unit");
      continue;
    }
    const company = collapseWs(attr(attributes, ["FöretagNa", "ForetagNa"]));
    const natfor = attr(attributes, ["Nätför_1", "Natfor_1", "Nätföretag, delområde"]);
    const delomrade = gisDelomrade(company, natfor);
    const identity = planningIdentity(accountingUnit, delomrade);
    const wkt = esriPolygonToWkt(feature.geometry);
    if (!wkt) {
      skipGis("missing_or_invalid_geometry");
      continue;
    }
    const existing = gisByIdentity.get(identity);
    if (existing) {
      existing.wkts.push(wkt);
      continue;
    }
    gisByIdentity.set(identity, {
      identity,
      accountingUnit,
      delomrade,
      company,
      organizationNumber: collapseWs(attr(attributes, ["Orgnr"])) || null,
      sourceUrl: collapseWs(attr(attributes, ["Länk_till", "Lank_till"])) || null,
      sourceFeatureId: attr(attributes, ["FID", "ObjectID_1", "Objectid"]),
      sourceFields: attributes,
      wkts: [wkt],
    });
  }

  const retrievedAt = new Date().toISOString();
  const publishedAt = workbook.modified ?? null;

  queryLocal(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency
) values (
  ${quoteSql(SOURCE_NAME)},
  ${quoteSql(SOURCE_SLUG)},
  'excel',
  ${quoteSql(SOURCE_PUBLISHER)},
  ${quoteSql(LANDING_URL)},
  'SE',
  true,
  'official',
  'as_published'
)
on conflict (slug) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  publisher = excluded.publisher,
  base_url = excluded.base_url,
  country_code = excluded.country_code,
  authority_level = excluded.authority_level,
  active = true,
  update_frequency = excluded.update_frequency;
`);

  const source = requireRow(
    queryLocal(`
select id, name, slug, source_type, publisher, base_url, authority_level, country_code
from public.grid_sources
where slug = ${quoteSql(SOURCE_SLUG)};
`),
    "grid_sources",
  );

  const existingSnapshot = queryLocal(`
select id, retrieved_at, published_at, content_hash, status
from public.source_snapshots
where source_id = ${quoteSql(source.id)}::uuid
  and content_hash = ${quoteSql(contentHash)};
`);

  let snapshotId;
  let snapshotStatus;
  let reusedExistingHash = false;
  const sheetCounts = Object.fromEntries(
    workbook.sheets.map((sheet) => [sheet.name, sheet.dataRows.length]),
  );
  const snapshotMeta = {
    original_filename: downloaded.filename,
    content_length: downloaded.bytes.length,
    workbook_modified: workbook.modified,
    workbook_created: workbook.created,
    planning_period: PLANNING_PERIOD,
    reporting_vintage: "2024 first statutory cycle",
    sheet_names: workbook.sheets.map((sheet) => sheet.name),
    row_counts: sheetCounts,
    landing_page_url: LANDING_URL,
    download_url: downloadUrl,
    distribution: "official_xlsx",
    geography_source: "official_arcgis_featureserver",
    feature_server_url: featureServer.url,
    feature_server_discovery: featureServer.discovered ? "runtime" : "official_fallback",
    source_crs: SOURCE_CRS_LABEL,
    source_crs_epsg: SOURCE_CRS,
    target_crs: TARGET_CRS,
    excel_identity_count: identities.size,
    planning_polygon_count: gisByIdentity.size,
    content_hash_means: "source_bytes_unchanged",
  };
  if (existingSnapshot[0]) {
    snapshotId = existingSnapshot[0].id;
    reusedExistingHash = true;
    snapshotStatus = existingSnapshot[0].status || "partial";
    mergeSnapshotMetadata(snapshotId, snapshotMeta);
  } else {
    const inserted = requireRow(
      queryLocalRetry(
        `
insert into public.source_snapshots (
  source_id, retrieved_at, published_at, content_hash, raw_content, storage_path, status, metadata
) values (
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(retrievedAt)}::timestamptz,
  ${quoteSqlNullable(publishedAt)}::timestamptz,
  ${quoteSql(contentHash)},
  null,
  null,
  'partial',
  ${quoteSql(JSON.stringify(snapshotMeta))}::jsonb
)
returning id, status;
`,
        { label: "source_snapshots insert" },
      ),
      "source_snapshots insert",
    );
    snapshotId = inserted.id;
    snapshotStatus = "partial";
  }

  const operators = queryLocal(`select id, name from public.grid_operators;`);
  const operatorByName = new Map(operators.map((row) => [row.name, row.id]));
  const effectiveRetrievedAt = existingSnapshot[0]?.retrieved_at ?? retrievedAt;

  const areaStats = { inserted: 0, updated: 0, unchanged: 0, invalid: 0 };
  const areas = [...gisByIdentity.values()];
  const AREA_BATCH = 5;

  function upsertAreaSql(batch) {
    const valuesSql = batch
      .map((area) => {
        const operatorId = area.company ? operatorByName.get(area.company) ?? null : null;
        const metadata = {
          official_operator_name: area.company || null,
          organization_number: area.organizationNumber,
          accounting_unit: area.accountingUnit,
          delomrade: area.delomrade,
          planning_identity: area.identity,
          source_feature_id: area.sourceFeatureId ?? null,
          source_fields: area.sourceFields,
          feature_server_url: featureServer.url,
          source_crs: SOURCE_CRS_LABEL,
          planning_period: PLANNING_PERIOD,
          merged_polygon_parts: area.wkts.length,
          area_concept: "nup_planning_area_not_concession",
        };
        const name =
          area.delomrade && area.delomrade !== WHOLE_UNIT
            ? area.delomrade
            : area.company || area.identity;
        const wktArray = `ARRAY[${area.wkts.map((wkt) => quoteSql(wkt)).join(", ")}]::text[]`;
        return `(
          ${quoteSql(source.id)}::uuid,
          ${operatorId ? `${quoteSql(operatorId)}::uuid` : "null::uuid"},
          ${quoteSql(area.identity)},
          ${quoteSql(name)},
          ${quoteSql(AREA_TYPE)},
          'SE',
          private.normalize_sweref99tm_multipolygons(${wktArray}),
          ${quoteSqlNullable(publishedAt)}::timestamptz,
          ${quoteSql(effectiveRetrievedAt)}::timestamptz,
          'high',
          ${quoteSql(JSON.stringify(metadata))}::jsonb
        )`;
      })
      .join(",\n");

    return `
with incoming as (
  select
    v.source_id::uuid,
    v.operator_id::uuid,
    v.external_id::text,
    v.name::text,
    v.area_type::text,
    v.country_code::text,
    v.geometry::extensions.geometry as geometry,
    v.published_at::timestamptz,
    v.retrieved_at::timestamptz,
    v.confidence::text,
    v.metadata::jsonb
  from (
    values
    ${valuesSql}
  ) as v(
    source_id, operator_id, external_id, name, area_type, country_code,
    geometry, published_at, retrieved_at, confidence, metadata
  )
),
classified as (
  select
    i.*,
    e.id as existing_id,
    case
      when i.geometry is null or extensions.st_isempty(i.geometry) then 'invalid'
      when e.id is null then 'insert'
      when e.name is not distinct from i.name
       and e.operator_id is not distinct from i.operator_id
       and e.metadata is not distinct from i.metadata
       and e.published_at is not distinct from i.published_at
       and e.geometry is not null
       and extensions.st_equals(e.geometry, i.geometry) then 'unchanged'
      else 'update'
    end as action
  from incoming as i
  left join public.grid_areas as e
    on e.source_id = i.source_id
   and e.external_id = i.external_id
)
, inserted as (
  insert into public.grid_areas (
    source_id, operator_id, external_id, name, area_type, country_code,
    geometry, published_at, retrieved_at, confidence, metadata
  )
  select
    source_id, operator_id, external_id, name, area_type, country_code,
    geometry::extensions.geometry(MultiPolygon, 4326),
    published_at, retrieved_at, confidence, metadata
  from classified
  where action = 'insert'
  returning id
)
, updated as (
  update public.grid_areas as ga
  set
    operator_id = c.operator_id,
    name = c.name,
    area_type = c.area_type,
    country_code = c.country_code,
    geometry = c.geometry::extensions.geometry(MultiPolygon, 4326),
    published_at = c.published_at,
    retrieved_at = c.retrieved_at,
    confidence = c.confidence,
    metadata = c.metadata
  from classified as c
  where c.action = 'update'
    and ga.id = c.existing_id
  returning ga.id
)
select
  (select count(*)::int from classified where action = 'insert') as inserted,
  (select count(*)::int from classified where action = 'update') as updated,
  (select count(*)::int from classified where action = 'unchanged') as unchanged,
  (select count(*)::int from classified where action = 'invalid') as invalid;
`;
  }

  function upsertAreaBatch(batch) {
    try {
      const rows = queryLocal(upsertAreaSql(batch));
      applyUpsertStats(areaStats, rows[0] ?? {});
    } catch (error) {
      if (batch.length === 1) {
        areaStats.invalid += 1;
        skipReasons.transform_or_insert_failed = (skipReasons.transform_or_insert_failed ?? 0) + 1;
        console.warn(
          `  skipped planning area ${batch[0].identity}: ${error.message.replace(/\s+/g, " ").slice(0, 400)}`,
        );
        return;
      }
      for (const area of batch) {
        upsertAreaBatch([area]);
      }
    }
  }

  for (let i = 0; i < areas.length; i += AREA_BATCH) {
    upsertAreaBatch(areas.slice(i, i + AREA_BATCH));
    process.stdout.write(`  planning areas ${Math.min(i + AREA_BATCH, areas.length)}/${areas.length}\r`);
  }
  process.stdout.write("\n");

  const storedAreas = queryLocal(`
select id, external_id
from public.grid_areas
where source_id = ${quoteSql(source.id)}::uuid
  and area_type = ${quoteSql(AREA_TYPE)};
`);
  const areaIdByIdentity = new Map(storedAreas.map((row) => [row.external_id, row.id]));

  const excelWithoutGeometry = [];
  for (const record of identities.values()) {
    if (!areaIdByIdentity.has(record.identity)) {
      excelWithoutGeometry.push(record.identity);
    }
  }

  const observations = [];
  for (const record of identities.values()) {
    const gridAreaId = areaIdByIdentity.get(record.identity) ?? null;
    const operatorId = record.company ? operatorByName.get(record.company) ?? null : null;
    const baseMeta = {
      accounting_unit: record.accountingUnit,
      delomrade: record.delomrade,
      delomrade_source: record.delomradeSource,
      company: record.company,
      source_row_identity: record.identity,
      planning_period: PLANNING_PERIOD,
      not_available_capacity: true,
    };

    for (const forecast of record.forecasts) {
      observations.push({
        externalId: observationIdentity(record.identity, "forecast_transfer_need", String(forecast.year)),
        gridAreaId,
        operatorId,
        observationType: "capacity_signal",
        valueNumeric: forecast.numeric,
        valueText: forecast.numeric == null ? forecast.original || null : null,
        unit: forecast.numeric == null ? null : "MW",
        sourceUrl: record.sourceUrl,
        rawMetadata: {
          ...baseMeta,
          semantic: SEMANTIC_FORECAST,
          planning_year: forecast.year,
          source_column: forecast.column,
          original_value: forecast.original,
          representation: forecast.representation,
          meaning: "Forecast need for transfer capacity. Not available MW, headroom, or connection capacity.",
        },
      });
    }

    observations.push({
      externalId: observationIdentity(record.identity, "planned_investment"),
      gridAreaId,
      operatorId,
      observationType: "reinforcement",
      valueNumeric: null,
      valueText: record.investmentText,
      unit: null,
      sourceUrl: record.sourceUrl,
      rawMetadata: {
        ...baseMeta,
        semantic: SEMANTIC_INVESTMENT,
        source_column: "Har nätföretaget planerade investeringar?",
        original_value: record.investmentText,
        meaning: "Whether the network company reports planned investments. Not an investment-project register.",
        not_an_investment_project_register: true,
      },
    });

    for (const flex of record.flexibility) {
      observations.push({
        externalId: observationIdentity(record.identity, "flexibility", flex.horizon),
        gridAreaId,
        operatorId,
        observationType: "other",
        valueNumeric: flex.numeric,
        valueText: flex.original,
        unit: null,
        sourceUrl: record.sourceUrl,
        rawMetadata: {
          ...baseMeta,
          semantic: SEMANTIC_FLEX,
          horizon: flex.horizon,
          source_column: flex.column,
          original_value: flex.original,
          source_column_unit_label: "MW",
          meaning: "Stated flexibility-service need. Heterogeneous units; original source value preserved. Not normalized to MW.",
        },
      });
    }

    observations.push({
      externalId: observationIdentity(record.identity, "planned_measures_meet_own_network_need"),
      gridAreaId,
      operatorId,
      observationType: "constraint",
      valueNumeric: null,
      valueText: record.meetsText,
      unit: null,
      sourceUrl: record.sourceUrl,
      rawMetadata: {
        ...baseMeta,
        semantic: SEMANTIC_MEETS,
        source_column: "Möter de planerade åtgärderna behovet i eget nät?",
        original_value: record.meetsText,
        meaning: "Qualitative source answer. Not converted to MW.",
      },
    });

    observations.push({
      externalId: observationIdentity(record.identity, "overlying_network_limitation"),
      gridAreaId,
      operatorId,
      observationType: "constraint",
      valueNumeric: null,
      valueText: record.overlyingText,
      unit: null,
      sourceUrl: record.sourceUrl,
      rawMetadata: {
        ...baseMeta,
        semantic: SEMANTIC_OVERLYING,
        source_column: "Finns det begränsningar i överliggande nät?",
        original_value: record.overlyingText,
        meaning: "Qualitative source answer. Not converted to MW.",
      },
    });
  }

  const obsStats = { inserted: 0, updated: 0, unchanged: 0, invalid: 0 };
  const OBS_BATCH = 40;

  function upsertObservationSql(batch) {
    const valuesSql = batch
      .map((obs) => {
        const numericSql =
          obs.valueNumeric == null ? "null::numeric" : `${quoteSql(String(obs.valueNumeric))}::numeric`;
        return `(
          ${quoteSql(source.id)}::uuid,
          ${obs.gridAreaId ? `${quoteSql(obs.gridAreaId)}::uuid` : "null::uuid"},
          ${obs.operatorId ? `${quoteSql(obs.operatorId)}::uuid` : "null::uuid"},
          ${quoteSql(obs.externalId)},
          ${quoteSql(obs.observationType)},
          ${numericSql},
          ${quoteSqlNullable(obs.valueText)},
          ${quoteSqlNullable(obs.unit)},
          ${quoteSqlNullable(publishedAt)}::timestamptz,
          ${quoteSql(effectiveRetrievedAt)}::timestamptz,
          'high',
          'official',
          ${quoteSqlNullable(obs.sourceUrl && obs.sourceUrl !== "N/A" ? obs.sourceUrl : null)},
          ${quoteSql(JSON.stringify(obs.rawMetadata))}::jsonb
        )`;
      })
      .join(",\n");

    return `
with incoming as (
  select
    v.source_id::uuid,
    v.grid_area_id::uuid,
    v.operator_id::uuid,
    v.external_id::text,
    v.observation_type::text,
    v.value_numeric::numeric,
    v.value_text::text,
    v.unit::text,
    v.published_at::timestamptz,
    v.retrieved_at::timestamptz,
    v.confidence::text,
    v.authority_level::text,
    v.source_url::text,
    v.raw_metadata::jsonb
  from (
    values
    ${valuesSql}
  ) as v(
    source_id, grid_area_id, operator_id, external_id, observation_type,
    value_numeric, value_text, unit, published_at, retrieved_at,
    confidence, authority_level, source_url, raw_metadata
  )
),
classified as (
  select
    i.*,
    e.id as existing_id,
    case
      when e.id is null then 'insert'
      when e.observation_type is not distinct from i.observation_type
       and e.value_numeric is not distinct from i.value_numeric
       and e.value_text is not distinct from i.value_text
       and e.unit is not distinct from i.unit
       and e.grid_area_id is not distinct from i.grid_area_id
       and e.operator_id is not distinct from i.operator_id
       and e.source_url is not distinct from i.source_url
       and e.raw_metadata is not distinct from i.raw_metadata
       and e.published_at is not distinct from i.published_at
       and e.authority_level is not distinct from i.authority_level
       and e.confidence is not distinct from i.confidence then 'unchanged'
      else 'update'
    end as action
  from incoming as i
  left join public.grid_observations as e
    on e.source_id = i.source_id
   and e.external_id = i.external_id
)
, inserted as (
  insert into public.grid_observations (
    source_id, grid_area_id, operator_id, external_id, observation_type,
    value_numeric, value_text, unit, published_at, retrieved_at,
    confidence, authority_level, source_url, raw_metadata
  )
  select
    source_id, grid_area_id, operator_id, external_id, observation_type,
    value_numeric, value_text, unit, published_at, retrieved_at,
    confidence, authority_level, source_url, raw_metadata
  from classified
  where action = 'insert'
  returning id
)
, updated as (
  update public.grid_observations as go
  set
    grid_area_id = c.grid_area_id,
    operator_id = c.operator_id,
    observation_type = c.observation_type,
    value_numeric = c.value_numeric,
    value_text = c.value_text,
    unit = c.unit,
    published_at = c.published_at,
    retrieved_at = c.retrieved_at,
    confidence = c.confidence,
    authority_level = c.authority_level,
    source_url = c.source_url,
    raw_metadata = c.raw_metadata
  from classified as c
  where c.action = 'update'
    and go.id = c.existing_id
  returning go.id
)
select
  (select count(*)::int from classified where action = 'insert') as inserted,
  (select count(*)::int from classified where action = 'update') as updated,
  (select count(*)::int from classified where action = 'unchanged') as unchanged,
  0 as invalid;
`;
  }

  function upsertObservationBatch(batch) {
    try {
      const rows = queryLocalRetry(upsertObservationSql(batch), {
        label: `observation batch (${batch.length})`,
      });
      applyUpsertStats(obsStats, rows[0] ?? {});
    } catch (error) {
      if (isTransientDbError(error)) {
        throw error;
      }
      if (batch.length === 1) {
        obsStats.invalid += 1;
        console.warn(
          `  skipped observation ${batch[0].externalId}: ${error.message.replace(/\s+/g, " ").slice(0, 400)}`,
        );
        return;
      }
      for (const obs of batch) {
        upsertObservationBatch([obs]);
      }
    }
  }

  const expectedManifest = {
    excel_identity_count: identities.size,
    expected_planning_area_count: areas.length,
    expected_observation_count: observations.length,
    expected_observation_version_count: observations.length,
    parse_warning_count: warnings.length,
    invalid_observation_count: 0,
    observation_id_digest: digestExternalIds(observations.map((obs) => obs.externalId)),
    row_counts: sheetCounts,
    content_hash_means: "source_bytes_unchanged",
  };
  mergeSnapshotMetadata(snapshotId, { normalization_manifest: expectedManifest });

  let completeness = snapshotCompleteness(snapshotId, source.id, expectedManifest);
  const alreadyComplete = completeness.complete && reusedExistingHash;
  let versionsInserted = 0;

  if (alreadyComplete) {
    snapshotStatus = ["success", "unchanged"].includes(String(existingSnapshot[0]?.status ?? ""))
      ? "unchanged"
      : "success";
    mergeSnapshotMetadata(
      snapshotId,
      {
        normalization_complete: true,
        last_run: snapshotStatus === "unchanged" ? "unchanged_complete" : "reconciled_status_only",
      },
      snapshotStatus,
    );
    console.log(
      snapshotStatus === "unchanged"
        ? "Source bytes unchanged and normalized snapshot is complete; skipping observation writes and change detection."
        : "Normalized rows already match the workbook; marking snapshot complete without rewriting rows.",
    );
  } else {
    mergeSnapshotMetadata(
      snapshotId,
      {
        normalization_complete: false,
        last_run: reusedExistingHash ? "reconcile_incomplete_hash" : "new_hash",
      },
      "partial",
    );
    snapshotStatus = "partial";
    for (let i = 0; i < observations.length; i += OBS_BATCH) {
      upsertObservationBatch(observations.slice(i, i + OBS_BATCH));
      process.stdout.write(
        `  observations ${Math.min(i + OBS_BATCH, observations.length)}/${observations.length}\r`,
      );
    }
    process.stdout.write("\n");
    expectedManifest.invalid_observation_count = obsStats.invalid;
    mergeSnapshotMetadata(snapshotId, { normalization_manifest: expectedManifest });

    const copied = requireRow(
      queryLocalRetry(
        `
select private.copy_grid_observations_to_versions(${quoteSql(snapshotId)}::uuid) as inserted;
`,
        { label: "copy observation versions" },
      ),
      "copy observation versions",
    );
    versionsInserted = Number(copied.inserted ?? 0);

    completeness = snapshotCompleteness(snapshotId, source.id, expectedManifest);
    if (completeness.complete && obsStats.invalid === 0) {
      snapshotStatus = "success";
      mergeSnapshotMetadata(
        snapshotId,
        { normalization_complete: true, last_run: reusedExistingHash ? "reconciled" : "normalized" },
        "success",
      );
    } else {
      snapshotStatus = completeness.observationCount === 0 ? "failed" : "partial";
      mergeSnapshotMetadata(
        snapshotId,
        {
          normalization_complete: false,
          missing_observations: completeness.missingObservations,
          missing_versions: completeness.missingVersions,
        },
        snapshotStatus,
      );
    }
  }

  const versionTotal = requireRow(
    queryLocalRetry(
      `
select count(*)::int as count
from public.grid_observation_versions
where source_snapshot_id = ${quoteSql(snapshotId)}::uuid;
`,
      { label: "observation version total" },
    ),
    "observation version total",
  );

  let changeDetection = {
    skipped: true,
    reason: reusedExistingHash
      ? completeness.complete
        ? "identical complete content hash"
        : "refusing change detection from incomplete snapshot"
      : "not eligible",
    previousSnapshotId: null,
    added: 0,
    removed: 0,
    changed: 0,
    insertedChanges: 0,
    impactRows: 0,
  };

  if (snapshotStatus === "success" && completeness.complete && !reusedExistingHash) {
    const previous = queryLocalRetry(
      `
select id, status
from public.source_snapshots
where source_id = ${quoteSql(source.id)}::uuid
  and id <> ${quoteSql(snapshotId)}::uuid
  and status in ('success', 'unchanged')
order by retrieved_at desc
limit 1;
`,
      { label: "previous complete snapshot" },
    );
    if (!previous[0]) {
      changeDetection = {
        skipped: true,
        reason: "baseline snapshot; no previous successful snapshot",
        previousSnapshotId: null,
        added: 0,
        removed: 0,
        changed: 0,
        insertedChanges: 0,
        impactRows: 0,
      };
    } else {
      const applied = queryLocalRetry(
        `
select
  change_kind,
  inserted,
  impact_count
from private.apply_observation_snapshot_changes(
  ${quoteSql(previous[0].id)}::uuid,
  ${quoteSql(snapshotId)}::uuid,
  false,
  ${quoteSql(NUP_IMPACT_REASON)},
  'high'
);
`,
        { label: "apply observation snapshot changes" },
      );
      changeDetection = {
        skipped: false,
        reason: null,
        previousSnapshotId: previous[0].id,
        added: applied.filter((row) => row.change_kind === "added").length,
        removed: applied.filter((row) => row.change_kind === "removed").length,
        changed: applied.filter((row) => row.change_kind === "changed").length,
        insertedChanges: applied.filter((row) => row.inserted === true || row.inserted === "t").length,
        impactRows: applied.reduce((sum, row) => sum + Number(row.impact_count ?? 0), 0),
      };
    }
  } else if (!completeness.complete) {
    changeDetection = {
      skipped: true,
      reason: "normalized snapshot is incomplete",
      previousSnapshotId: null,
      added: 0,
      removed: 0,
      changed: 0,
      insertedChanges: 0,
      impactRows: 0,
    };
  }

  const semanticCounts = requireRow(
    queryLocal(`
select
  count(*) filter (where raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_FORECAST)})::int as forecast,
  count(*) filter (where raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_INVESTMENT)})::int as investment,
  count(*) filter (where raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_FLEX)})::int as flexibility,
  count(*) filter (where raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_MEETS)})::int as meets,
  count(*) filter (where raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_OVERLYING)})::int as overlying,
  count(*)::int as total
from public.grid_observations
where source_id = ${quoteSql(source.id)}::uuid;
`),
    "observation semantic counts",
  );

  const changeCount = requireRow(
    queryLocal(`
select count(*)::int as count
from public.external_changes
where source_id = ${quoteSql(source.id)}::uuid;
`),
    "external_changes count",
  );

  const alertCount = requireRow(
    queryLocal(`
select count(*)::int as count
from public.alerts as a
inner join public.external_changes as ec
  on a.metadata ->> 'external_change_id' = ec.id::text
where ec.source_id = ${quoteSql(source.id)}::uuid;
`),
    "NUP alert count",
  );

  const relJoin = requireRow(
    queryLocal(`
with nup_rel as (
  select distinct trim(both from unnest(string_to_array(ga.metadata ->> 'accounting_unit', ','))) as rel
  from public.grid_areas as ga
  where ga.source_id = ${quoteSql(source.id)}::uuid
    and ga.area_type = ${quoteSql(AREA_TYPE)}
),
concession as (
  select distinct ga.metadata ->> 'unit_id' as unit_id
  from public.grid_areas as ga
  inner join public.grid_sources as gs on gs.id = ga.source_id
  where gs.slug = 'ei-network-area-concessions'
    and ga.area_type = 'local_network'
)
select
  (select count(*)::int from nup_rel) as nup_rel_tokens,
  (select count(*)::int from nup_rel n inner join concession c on c.unit_id = n.rel) as rel_also_in_concessions;
`),
    "REL supporting join",
  );

  const matches = queryLocal(`
select
  p.name as project,
  round(extensions.st_y(ps.geom)::numeric, 4) as latitude,
  round(extensions.st_x(ps.geom)::numeric, 4) as longitude,
  concession.name as ei_local_network,
  concession.metadata ->> 'official_operator_name' as ei_local_operator,
  concession.external_id as concession_id,
  nup.name as nup_area,
  nup.metadata ->> 'official_operator_name' as nup_company,
  nup.metadata ->> 'accounting_unit' as nup_rel,
  nup.metadata ->> 'delomrade' as nup_delomrade,
  nup.external_id as nup_identity,
  (
    select string_agg(
      (obs.raw_metadata ->> 'planning_year') || ':' || coalesce(obs.raw_metadata ->> 'representation', '?'),
      ',' order by obs.raw_metadata ->> 'planning_year'
    )
    from public.grid_observations as obs
    where obs.grid_area_id = nup.id
      and obs.raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_FORECAST)}
  ) as forecast_types,
  (
    select obs.value_text
    from public.grid_observations as obs
    where obs.grid_area_id = nup.id
      and obs.raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_INVESTMENT)}
    limit 1
  ) as planned_investments,
  (
    select obs.value_text
    from public.grid_observations as obs
    where obs.grid_area_id = nup.id
      and obs.raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_MEETS)}
    limit 1
  ) as meets_need,
  (
    select obs.value_text
    from public.grid_observations as obs
    where obs.grid_area_id = nup.id
      and obs.raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_OVERLYING)}
    limit 1
  ) as overlying
from public.projects as p
inner join public.project_sites as ps
  on ps.project_id = p.id
 and ps.is_primary
left join lateral (
  select area.*
  from private.ei_local_network_areas_covering_geom(ps.geom) as area
  limit 1
) as concession on true
left join lateral (
  select area.*
  from private.ei_nup_planning_areas_covering_geom(ps.geom) as area
  limit 1
) as nup on true
order by p.name;
`);

  const gavleObs = queryLocal(`
select
  go.external_id,
  go.observation_type,
  go.value_numeric,
  go.value_text,
  go.unit,
  go.raw_metadata ->> 'semantic' as semantic,
  go.raw_metadata ->> 'representation' as representation,
  go.raw_metadata ->> 'meaning' as meaning,
  go.raw_metadata ->> 'planning_year' as planning_year
from public.grid_observations as go
inner join public.grid_areas as ga
  on ga.id = go.grid_area_id
where go.source_id = ${quoteSql(source.id)}::uuid
  and ga.metadata ->> 'official_operator_name' ilike '%Gävle Energi%'
  and go.raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_FORECAST)}
order by go.raw_metadata ->> 'planning_year';
`);

  const messyExamples = queryLocal(`
select
  go.raw_metadata ->> 'company' as company,
  go.raw_metadata ->> 'source_row_identity' as identity,
  go.raw_metadata ->> 'semantic' as semantic,
  left(coalesce(go.value_text, go.raw_metadata ->> 'original_value'), 180) as original_value
from public.grid_observations as go
where go.source_id = ${quoteSql(source.id)}::uuid
  and (
    (go.raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_FORECAST)} and go.raw_metadata ->> 'representation' = 'source_text')
    or (go.raw_metadata ->> 'semantic' = ${quoteSql(SEMANTIC_FLEX)} and coalesce(go.value_text, '') ~* 'mwh|delområde|-')
  )
order by go.raw_metadata ->> 'semantic', go.raw_metadata ->> 'company'
limit 8;
`);

  const projectFingerprintAfter = requireRow(
    queryLocal(`
select
  count(*)::int as project_count,
  md5(string_agg(
    p.id::text || '|' ||
    coalesce(p.grid_operator_id::text, '') || '|' ||
    coalesce(p.connection_outlook, '') || '|' ||
    coalesce(p.confidence, '') || '|' ||
    coalesce(p.connection_stage, '') || '|' ||
    coalesce(p.import_mw::text, '') || '|' ||
    coalesce(p.export_mw::text, ''),
    ',' order by p.id
  )) as fingerprint
from public.projects as p;
`),
    "project fingerprint after",
  );

  const snapshotCount = requireRow(
    queryLocal(`
select count(*)::int as count
from public.source_snapshots
where source_id = ${quoteSql(source.id)}::uuid
  and content_hash = ${quoteSql(contentHash)};
`),
    "snapshot hash count",
  );

  console.log("\n========== Ei NUP ingest ==========");
  console.log(`Official landing page: ${LANDING_URL}`);
  console.log(`Excel distribution discovered: ${downloaded.filename}`);
  console.log(`Download URL: ${downloadUrl}`);
  console.log(`Content hash: ${contentHash}`);
  console.log(`Planning period: ${PLANNING_PERIOD}`);
  console.log(`Workbook modified: ${workbook.modified ?? "(not exposed)"}`);
  console.log(`Snapshot ID: ${snapshotId}`);
  console.log(`Snapshot status: ${snapshotStatus}`);
  console.log(
    `Normalization completeness: ${completeness.complete ? "COMPLETE" : "INCOMPLETE"}`,
  );
  if (snapshotStatus === "unchanged" && completeness.complete) {
    console.log("Result: UNCHANGED / COMPLETE");
  } else if (reusedExistingHash && completeness.complete) {
    console.log("Result: RECONCILED / COMPLETE");
  } else if (completeness.complete) {
    console.log("Result: SUCCESS / COMPLETE");
  } else {
    console.log(
      `Result: ${String(snapshotStatus).toUpperCase()} / INCOMPLETE (missing observations=${completeness.missingObservations}, missing versions=${completeness.missingVersions})`,
    );
  }
  console.log(`Expected observations from workbook: ${expectedManifest.expected_observation_count}`);
  console.log(`Expected observation versions from workbook: ${expectedManifest.expected_observation_version_count}`);
  console.log(`Expected planning areas from workbook: ${expectedManifest.expected_planning_area_count}`);
  console.log(`Stored observations: ${completeness.observationCount}`);
  console.log(`Stored observation versions: ${completeness.versionCount}`);
  console.log(`Stored planning areas: ${completeness.areaCount}`);
  console.log(`Snapshots with this hash: ${snapshotCount.count}`);
  for (const [name, count] of Object.entries(sheetCounts)) {
    console.log(`Excel rows (${name}): ${count}`);
  }
  console.log(`Excel identities (REL + delområde): ${identities.size}`);
  console.log(`Planning polygons retrieved: ${gisFeatures.length}`);
  console.log(`Planning polygons prepared: ${areas.length}`);
  console.log(`Planning polygons inserted: ${areaStats.inserted}`);
  console.log(`Planning polygons updated: ${areaStats.updated}`);
  console.log(`Planning polygons unchanged: ${areaStats.unchanged}`);
  console.log(`Planning polygons invalid: ${areaStats.invalid}`);
  console.log(`Features skipped / invalid: ${skippedGis + areaStats.invalid}`);
  if (Object.keys(skipReasons).length > 0) {
    for (const [reason, count] of Object.entries(skipReasons)) {
      console.log(`  - ${reason}: ${count}`);
    }
  }
  console.log(`Observations inserted: ${obsStats.inserted}`);
  console.log(`Observations updated: ${obsStats.updated}`);
  console.log(`Observations unchanged: ${obsStats.unchanged}`);
  console.log(`Observations invalid: ${obsStats.invalid}`);
  console.log(`Observation versions inserted this run: ${versionsInserted}`);
  console.log(`Observation versions for this snapshot: ${versionTotal.count}`);
  if (changeDetection.skipped) {
    console.log(`Change detection: skipped (${changeDetection.reason})`);
  } else {
    console.log(`Change detection previous snapshot: ${changeDetection.previousSnapshotId}`);
    console.log(`Change detection added: ${changeDetection.added}`);
    console.log(`Change detection removed: ${changeDetection.removed}`);
    console.log(`Change detection changed: ${changeDetection.changed}`);
    console.log(`external_changes inserted this run: ${changeDetection.insertedChanges}`);
    console.log(`change_impacts returned this run: ${changeDetection.impactRows}`);
  }
  console.log(`Observation counts by semantic:`);
  console.log(`  forecast_transfer_capacity_need: ${semanticCounts.forecast}`);
  console.log(`  planned_investments_reported: ${semanticCounts.investment}`);
  console.log(`  flexibility_need: ${semanticCounts.flexibility}`);
  console.log(`  planned_measures_meet_own_network_need: ${semanticCounts.meets}`);
  console.log(`  overlying_network_limitation: ${semanticCounts.overlying}`);
  console.log(`  total: ${semanticCounts.total}`);
  console.log(`Forecast cells numeric MW: ${numericForecastCount}`);
  console.log(`Forecast cells free-text: ${textForecastCount}`);
  console.log(`Forecast cells empty: ${emptyForecastCount}`);
  console.log(`Excel identities with no geometry: ${excelWithoutGeometry.length}`);
  if (excelWithoutGeometry.length > 0) {
    for (const identity of excelWithoutGeometry.slice(0, 20)) {
      console.log(`  - ${identity}`);
    }
    if (excelWithoutGeometry.length > 20) {
      console.log(`  … ${excelWithoutGeometry.length - 20} more`);
    }
  }
  console.log(`Source parsing warnings: ${warnings.length}`);
  console.log(`CRS transformation: ${SOURCE_CRS_LABEL} → ${TARGET_CRS} via PostGIS ST_Transform`);
  console.log(`FeatureServer: ${featureServer.url}`);
  console.log(`external_changes for this source: ${changeCount.count}`);
  console.log(`alerts for this source: ${alertCount.count} (official NUP ingest does not create alerts)`);
  console.log(
    `Supporting REL overlap with Ei concession unit_id: ${relJoin.rel_also_in_concessions} of ${relJoin.nup_rel_tokens} NUP REL tokens (identity context only; not used for site matching)`,
  );
  console.log(
    `Customer project fingerprint unchanged: ${
      projectFingerprintBefore.fingerprint === projectFingerprintAfter.fingerprint &&
      projectFingerprintBefore.project_count === projectFingerprintAfter.project_count
        ? "yes"
        : "NO — unexpected project mutation"
    }`,
  );

  console.log("\n========== Project → Ei local network + NUP planning area ==========");
  console.log(
    `${pad("Project", 22)}${pad("Lat", 9)}${pad("Lng", 9)}${pad("Ei local-network", 28)}${pad("NUP company", 28)}${pad("REL", 22)}${pad("Delområde", 18)}Forecast / investments / meets / overlying`,
  );
  for (const row of matches) {
    const nupArea = row.nup_area
      ? `${row.nup_company ?? "—"} | ${row.nup_rel ?? "—"} | ${row.nup_delomrade ?? "—"}`
      : "No official NUP planning-area match";
    const forecastSummary = row.forecast_types
      ? [...new Set(String(row.forecast_types).split(",").map((part) => part.split(":")[1]))].join("+")
      : "—";
    console.log(
      `${pad(row.project, 22)}${pad(row.latitude, 9)}${pad(row.longitude, 9)}${pad(clip(row.ei_local_network, 27), 28)}${pad(clip(row.nup_company, 27), 28)}${pad(clip(row.nup_rel, 21), 22)}${pad(clip(row.nup_delomrade, 17), 18)}${forecastSummary} / ${clip(row.planned_investments, 18)} / ${clip(row.meets_need, 24)} / ${clip(row.overlying, 28)}`,
    );
    if (!row.nup_area) {
      console.log(`  ${nupArea}`);
    }
  }

  console.log("\n========== Gävle forecast semantics ==========");
  if (gavleObs.length === 0) {
    console.log("No Gävle Energi forecast observations linked to a planning polygon.");
  } else {
    const semantics = [...new Set(gavleObs.map((row) => row.semantic))];
    const types = [...new Set(gavleObs.map((row) => row.observation_type))];
    const availableLeak = gavleObs.some(
      (row) =>
        row.semantic === "available_capacity" ||
        row.unit === "available_MW" ||
        /available_capacity/.test(String(row.semantic ?? "")),
    );
    console.log(`Gävle forecast rows: ${gavleObs.length}`);
    console.log(`observation_type: ${types.join(", ")}`);
    console.log(`semantic: ${semantics.join(", ")}`);
    console.log(`Labeled as available capacity: ${availableLeak ? "YES (unexpected)" : "no"}`);
    for (const row of gavleObs) {
      const stored =
        row.representation === "numeric_mw"
          ? `numeric ${row.value_numeric} ${row.unit ?? ""}`.trim()
          : `text ${JSON.stringify(row.value_text)}`;
      console.log(
        `  ${row.planning_year}: ${stored} | representation=${row.representation} | semantic=${row.semantic}`,
      );
    }
    if (gavleObs[0]?.meaning) {
      console.log(`Meaning: ${gavleObs[0].meaning}`);
    }
  }

  console.log("\n========== Messy source values preserved ==========");
  for (const row of messyExamples) {
    console.log(`- [${row.semantic}] ${row.company} (${row.identity}): ${JSON.stringify(row.original_value)}`);
  }

  console.log("\nSemantics: this is official network-development-plan context.");
  console.log("It does not prove available MW, connection capacity, headroom, or time-to-power.");
  console.log("Customer project rows were not modified.");

  if (!completeness.complete) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
