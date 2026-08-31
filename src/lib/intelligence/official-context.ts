import type { OfficialContextSummary } from "@/lib/intelligence/types";
import type {
  OfficialGridAreaContext,
  OfficialNupContext,
} from "@/lib/domain/grid-intelligence";

export function pickLatestRetrievedDate(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null {
  if (!left) {
    return right ?? null;
  }
  if (!right) {
    return left;
  }
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

export function summarizeOfficialContext(
  localNetwork: OfficialGridAreaContext | null | undefined,
  nup: OfficialNupContext | null | undefined,
): OfficialContextSummary {
  const localProvenance = localNetwork?.provenance ?? null;
  const nupProvenance = nup?.provenance ?? null;

  return {
    localNetworkAvailable: Boolean(localNetwork?.areas?.length),
    nupAvailable: Boolean(nup?.planningAreas?.length),
    latestRetrievedAt: pickLatestRetrievedDate(
      localProvenance?.retrievedAt ?? null,
      nupProvenance?.retrievedAt ?? null,
    ),
  };
}
