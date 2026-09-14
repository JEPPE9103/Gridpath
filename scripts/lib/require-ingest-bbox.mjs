/**
 * Production ingest CLIs must receive an explicit bbox.
 * Örebro is never an implicit default.
 */
export function requireIngestBbox(argv = process.argv.slice(2), env = process.env) {
  const raw =
    argv.find((item) => item.startsWith("--bbox="))?.slice("--bbox=".length) ||
    env.NOXHEIM_SCREENING_INGEST_BBOX;
  if (!raw) {
    throw new Error(
      "Provide --bbox=west,south,east,north. Production ingest does not default to a municipality.",
    );
  }
  const [west, south, east, north] = raw.split(",").map(Number);
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
    throw new Error("Provide --bbox=west,south,east,north with west<east and south<north.");
  }
  return { west, south, east, north };
}
