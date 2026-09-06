import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { strToU8, zipSync } from "fflate";
import * as XLSX from "xlsx";
import { extractZipBytes } from "./extract-zip.mjs";

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-extract-zip-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("cross-platform ZIP/XLSX extraction", () => {
  it("unpacks a generated XLSX without tar", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Redovisningsenhet", "Nätföretag"],
        ["REL001", "Acme Elnät"],
      ]),
      "Behovet av överföringskapacitet",
    );
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    withTempDir((dir) => {
      const previousPath = process.env.PATH;
      process.env.PATH = "";
      try {
        const count = extractZipBytes(bytes, dir);
        assert.ok(count > 0);
        const workbookXml = readFileSync(path.join(dir, "xl", "workbook.xml"), "utf8");
        assert.match(workbookXml, /Behovet av överföringskapacitet/);
        const sheet = readFileSync(path.join(dir, "xl", "worksheets", "sheet1.xml"), "utf8");
        assert.match(sheet, /REL001/);
        assert.match(sheet, /Acme Elnät/);
      } finally {
        process.env.PATH = previousPath;
      }
    });
  });

  it("rejects a corrupt ZIP/XLSX", () => {
    withTempDir((dir) => {
      assert.throws(() => extractZipBytes(Buffer.from("not-a-zip"), dir), /could not be unpacked/i);
    });
  });

  it("rejects zip-slip paths", () => {
    const evil = zipSync({ "../etc/passwd": strToU8("nope") });
    withTempDir((dir) => {
      assert.throws(() => extractZipBytes(evil, dir), /unsafe path/i);
    });
  });

  it("unpacks a nested ZIP without tar (shapefile-style)", () => {
    const bytes = zipSync({
      "lokalnat/areas.shp": strToU8("shp-bytes"),
      "lokalnat/areas.dbf": strToU8("dbf-bytes"),
      "lokalnat/areas.prj": strToU8("prj-bytes"),
    });
    withTempDir((dir) => {
      const previousPath = process.env.PATH;
      process.env.PATH = "";
      try {
        extractZipBytes(bytes, dir);
        assert.equal(readFileSync(path.join(dir, "lokalnat", "areas.shp"), "utf8"), "shp-bytes");
        assert.equal(readFileSync(path.join(dir, "lokalnat", "areas.dbf"), "utf8"), "dbf-bytes");
      } finally {
        process.env.PATH = previousPath;
      }
    });
  });
});
