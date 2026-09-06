/**
 * Cross-platform ZIP/XLSX extraction for official ingest.
 * XLSX is a ZIP container. Do not use OS tar: Windows bsdtar accepts ZIP,
 * GitHub ubuntu-latest GNU tar does not.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";

function asUint8Array(bytes) {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }
  return Uint8Array.from(bytes);
}

function assertSafeEntryPath(destDir, entryName) {
  const normalized = String(entryName).replaceAll("\\", "/");
  if (!normalized || normalized.endsWith("/")) {
    return null;
  }
  if (
    path.isAbsolute(normalized) ||
    normalized.includes("..") ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new Error("Official ZIP/XLSX contained an unsafe path.");
  }
  const destRoot = path.resolve(destDir);
  const target = path.resolve(destRoot, normalized);
  const prefix = destRoot.endsWith(path.sep) ? destRoot : destRoot + path.sep;
  if (target !== destRoot && !target.startsWith(prefix)) {
    throw new Error("Official ZIP/XLSX contained an unsafe path.");
  }
  return target;
}

export function extractZipBytes(zipBytes, destDir) {
  let files;
  try {
    files = unzipSync(asUint8Array(zipBytes));
  } catch (error) {
    throw new Error(
      `Official ZIP/XLSX could not be unpacked: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const names = Object.keys(files).filter((name) => name && !name.endsWith("/"));
  if (names.length === 0) {
    throw new Error("Official ZIP/XLSX contained no files.");
  }
  for (const name of names) {
    const target = assertSafeEntryPath(destDir, name);
    if (!target) {
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(files[name]));
  }
  return names.length;
}
