/**
 * Direct proof that NOXHEIM_NMD2023_URL window-reads a COG (no full-file download).
 * Does not mutate PostGIS.
 */
import { nmdDiscoverySummariesFromSource, resolveNmd2023Source } from "../src/lib/ingest/nmd";

async function main() {
  const source = resolveNmd2023Source();
  if (!source || source.kind !== "url") {
    throw new Error("Set NOXHEIM_NMD2023_URL first");
  }
  const extent = {
    xmin: 370674.303315585,
    ymin: 6157636.76509756,
    xmax: 380440.423128117,
    ymax: 6169032.24257688,
  };
  const t0 = Date.now();
  const rows = await nmdDiscoverySummariesFromSource(source, extent);
  const ms = Date.now() - t0;
  const groups = [...new Set(rows.map((r) => r.landCoverGroup))].sort();
  console.log(
    JSON.stringify({
      event: "smoke.nmd_url.window_read",
      sourceKind: source.kind,
      host: new URL(source.url).hostname,
      rowCount: rows.length,
      groups,
      ms,
      note: "Window read from COG via geotiff fromUrl; summaries only — no full national download.",
    }),
  );
  if (rows.length < 10) throw new Error("Expected land-cover summaries from Malmö COG window");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
