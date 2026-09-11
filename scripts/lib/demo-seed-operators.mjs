/**
 * Resolve demo portfolio operators by official catalog name.
 * Never creates operators. Never falls back to local seed.sql UUIDs.
 */

export const REQUIRED_OPERATORS = [
  {
    key: "vattenfall",
    names: ["Vattenfall Eldistribution"],
  },
  {
    key: "ellevio",
    names: ["Ellevio"],
  },
  {
    key: "eon",
    names: ["E.ON Energidistribution", "E.ON"],
  },
  {
    key: "goteborg",
    names: ["Göteborg Energi", "Goteborg Energi"],
  },
];

export function operatorLookupSql() {
  return `select id::text as id, name
from public.grid_operators
order by name;`;
}

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function resolveRequiredOperators(rows) {
  const catalog = (rows ?? []).map((row) => ({
    id: String(row.id ?? "").trim(),
    name: String(row.name ?? "").trim(),
  }));
  const resolved = {};
  const missing = [];

  for (const required of REQUIRED_OPERATORS) {
    let match = null;
    for (const candidateName of required.names) {
      match = catalog.find((row) => row.name === candidateName) ?? null;
      if (match) break;
    }
    if (!match) {
      match =
        catalog.find((row) => required.names.some((name) => normalizeName(row.name) === normalizeName(name))) ??
        null;
    }
    if (!match?.id) {
      missing.push(required.names[0]);
      continue;
    }
    resolved[required.key] = { id: match.id, name: match.name, key: required.key };
  }

  if (missing.length > 0) {
    throw new Error(
      `Demo reset refused: required grid operators were not found in the catalog (${missing.join(", ")}). ` +
        "Will not invent or insert fake operators.",
    );
  }

  return resolved;
}
