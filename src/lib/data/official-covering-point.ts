import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emptyCovering, type OfficialCoveringEvidence } from "@/lib/opportunities/screening";

type CoveringRow = {
  queried?: boolean;
  localCovered?: boolean;
  nupCovered?: boolean;
  localName?: string | null;
  nupName?: string | null;
  retrievedAt?: string | null;
  sourceName?: string | null;
};

export const getOfficialCoveringSummaryForPoint = cache(
  async (latitude: number, longitude: number): Promise<OfficialCoveringEvidence> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_official_covering_summary_for_point", {
      p_latitude: latitude,
      p_longitude: longitude,
    });
    if (error || !data || typeof data !== "object") {
      if (error) {
        console.error("getOfficialCoveringSummaryForPoint failed", error.message);
      }
      return emptyCovering();
    }
    const row = data as CoveringRow;
    return {
      queried: row.queried === true,
      localCovered: row.localCovered === true,
      nupCovered: row.nupCovered === true,
      localName: typeof row.localName === "string" ? row.localName : null,
      nupName: typeof row.nupName === "string" ? row.nupName : null,
      retrievedAt: typeof row.retrievedAt === "string" ? row.retrievedAt : null,
      sourceName:
        typeof row.sourceName === "string" ? row.sourceName : "Energimarknadsinspektionen",
    };
  },
);
