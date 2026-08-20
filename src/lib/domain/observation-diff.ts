import type {
  ObservationChangeKind,
  ObservationDiff,
  ObservationVersion,
} from "@/lib/domain/grid-intelligence";

const SEMANTIC_METADATA_KEYS = [
  "semantic",
  "planning_year",
  "horizon",
  "original_value",
  "representation",
] as const;

export function observationChangePayload(
  version: ObservationVersion | null,
): Record<string, unknown> | null {
  if (!version) {
    return null;
  }
  const year = asStringOrNull(version.rawMetadata.planning_year);
  const horizon = asStringOrNull(version.rawMetadata.horizon);
  const semantic = asStringOrNull(version.rawMetadata.semantic);
  const representation = asStringOrNull(version.rawMetadata.representation);
  const payload: Record<string, unknown> = {};
  if (version.valueNumeric != null) {
    payload.value = version.valueNumeric;
    payload.value_numeric = version.valueNumeric;
  } else if (version.valueText != null) {
    payload.value = version.valueText;
  }
  if (version.valueText != null) {
    payload.value_text = version.valueText;
  }
  if (version.unit != null) {
    payload.unit = version.unit;
  }
  if (year) {
    payload.year = year;
  }
  if (horizon) {
    payload.horizon = horizon;
  }
  if (semantic) {
    payload.semantic = semantic;
  }
  if (representation) {
    payload.representation = representation;
  }
  return payload;
}

export function canonicalizeObservationSemanticState(
  version: ObservationVersion,
): string {
  const metadata: Record<string, string> = {};
  for (const key of SEMANTIC_METADATA_KEYS) {
    const value = asStringOrNull(version.rawMetadata[key]);
    if (value != null) {
      metadata[key] = value;
    }
  }
  return JSON.stringify({
    observation_type: version.observationType,
    value_numeric: version.valueNumeric,
    value_text: version.valueText,
    unit: version.unit,
    effective_from: version.effectiveFrom,
    effective_to: version.effectiveTo,
    ...metadata,
  });
}

export function diffObservationSnapshots(
  previous: ObservationVersion[],
  current: ObservationVersion[],
): ObservationDiff[] {
  const previousById = new Map(previous.map((row) => [row.externalId, row]));
  const currentById = new Map(current.map((row) => [row.externalId, row]));
  const diffs: ObservationDiff[] = [];

  for (const row of current) {
    if (!previousById.has(row.externalId)) {
      diffs.push(toDiff("added", null, row));
    }
  }

  for (const row of previous) {
    if (!currentById.has(row.externalId)) {
      diffs.push(toDiff("removed", row, null));
    }
  }

  for (const row of current) {
    const prior = previousById.get(row.externalId);
    if (!prior) {
      continue;
    }
    if (canonicalizeObservationSemanticState(prior) !== canonicalizeObservationSemanticState(row)) {
      diffs.push(toDiff("changed", prior, row));
    }
  }

  return diffs;
}

function toDiff(
  kind: ObservationChangeKind,
  previous: ObservationVersion | null,
  current: ObservationVersion | null,
): ObservationDiff {
  const source = current ?? previous;
  return {
    kind,
    externalId: source?.externalId ?? "",
    sourceId: source?.sourceId ?? "",
    gridAreaId: current?.gridAreaId ?? previous?.gridAreaId ?? null,
    semantic: asStringOrNull(source?.rawMetadata.semantic ?? null),
    observationType: source?.observationType ?? null,
    previous,
    current,
    beforeValue: observationChangePayload(previous),
    afterValue: observationChangePayload(current),
  };
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return value == null ? null : String(value);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
