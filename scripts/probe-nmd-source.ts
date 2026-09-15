/**
 * Probe NMD source for production COG readiness. Never prints secrets or full paths.
 */
import { fromFile, fromUrl } from "geotiff";
import { resolveNmd2023Tif } from "../src/lib/ingest/nmd";

async function main() {
  const path = resolveNmd2023Tif();
  const url = process.env.NOXHEIM_NMD2023_URL?.trim() || "";
  if (!path && !url) {
    console.log(JSON.stringify({ event: "nmd.probe", localTif: "MISSING", url: "MISSING" }));
    process.exit(1);
  }
  const tiff = url ? await fromUrl(url) : await fromFile(path);
  const image = await tiff.getImage();
  const fileDir = image.fileDirectory as Record<string, unknown>;
  const tileWidth = Number(fileDir.TileWidth ?? 0);
  const tileHeight = Number(fileDir.TileHeight ?? 0);
  const isTiled = tileWidth > 0 && tileHeight > 0;
  const overviews = typeof (tiff as { getImageCount?: () => Promise<number> }).getImageCount === "function"
    ? await (tiff as { getImageCount: () => Promise<number> }).getImageCount()
    : 1;
  console.log(
    JSON.stringify({
      event: "nmd.probe",
      sourceKind: url ? "url" : "file",
      width: image.getWidth(),
      height: image.getHeight(),
      tiled: isTiled,
      tileWidth: isTiled ? tileWidth : null,
      tileHeight: isTiled ? tileHeight : null,
      imageCount: overviews,
      cogLikely: isTiled && overviews >= 1,
      note: isTiled
        ? "Tiled GeoTIFF can support HTTP range window reads via geotiff fromUrl."
        : "Striped GeoTIFF is not production-safe over HTTP; convert once to COG.",
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
