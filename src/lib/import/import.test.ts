import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv } from "./csv";
import { suggestColumnMapping } from "./mapping";
import {
  normalizeImportConfidence,
  normalizeImportOutlook,
  normalizeImportStage,
  normalizeImportTargetCod,
  normalizeImportTechnology,
  parseImportMw,
} from "./normalize";
import {
  findDuplicate,
  summariseImportRows,
  validateImportRows,
} from "./validate";
import { parseXlsx } from "./xlsx";
import * as XLSX from "xlsx";
import { canDeleteProjects, canImportProjects } from "@/lib/projects/authorization";

describe("CSV parse", () => {
  it("reads headers and quoted cells", () => {
    const parsed = parseCsv('Project name,Latitude,Longitude\n"North, BESS",59.3,18.1\n');
    assert.deepEqual(parsed.headers, ["Project name", "Latitude", "Longitude"]);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0][0], "North, BESS");
    assert.equal(parsed.rows[0][1], "59.3");
  });
});

describe("XLSX parse", () => {
  it("reads the first sheet headers and rows", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Project name", "Latitude", "Longitude"],
      ["Gavle Battery", 60.67, 17.14],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Portfolio");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
    const parsed = parseXlsx(buffer);
    assert.equal(parsed.headers[0], "Project name");
    assert.equal(parsed.rows[0][0], "Gavle Battery");
  });
});

describe("header mapping", () => {
  it("maps template and alias headers", () => {
    const mapping = suggestColumnMapping([
      "Project name",
      "Lat",
      "Lng",
      "Technology",
      "Import MW",
    ]);
    assert.equal(mapping.name, 0);
    assert.equal(mapping.latitude, 1);
    assert.equal(mapping.longitude, 2);
    assert.equal(mapping.technology, 3);
    assert.equal(mapping.importMw, 4);
  });
});

describe("canonical enum normalisation", () => {
  it("maps BESS / Battery / Battery Storage onto battery_storage", () => {
    assert.equal(normalizeImportTechnology("BESS"), "battery_storage");
    assert.equal(normalizeImportTechnology("Battery"), "battery_storage");
    assert.equal(normalizeImportTechnology("Battery Storage"), "battery_storage");
  });

  it("rejects unknown technology", () => {
    assert.equal(normalizeImportTechnology("hydrogen"), null);
  });

  it("maps stage and outlook aliases onto canonical enums", () => {
    assert.equal(normalizeImportStage("Grid Study"), "grid_study");
    assert.equal(normalizeImportStage("inquiry"), "enquiry");
    assert.equal(normalizeImportOutlook("Favorable"), "favourable");
    assert.equal(normalizeImportOutlook("At Risk"), "at_risk");
  });

  it("rejects unsupported stage and outlook", () => {
    assert.equal(normalizeImportStage("idea"), null);
    assert.equal(normalizeImportOutlook("excellent"), null);
  });

  it("rejects impossible confidence and accepts labelled values", () => {
    assert.equal(normalizeImportConfidence("high"), "high");
    assert.equal(normalizeImportConfidence("150"), null);
    assert.equal(normalizeImportConfidence("80"), "high");
  });
});

describe("coordinate and MW validation", () => {
  it("flags missing name and invalid coordinates", () => {
    const mapping = suggestColumnMapping(["Project name", "Latitude", "Longitude"]);
    const rows = validateImportRows(
      [
        ["", "91", "18"],
        ["Valid", "59,3", "18.1"],
      ],
      mapping,
      [],
      [],
    );
    assert.ok(rows[0].issues.some((issue) => issue.includes("name")));
    assert.ok(rows[0].issues.some((issue) => issue.includes("latitude")));
    assert.equal(rows[1].issues.length, 0);
    assert.equal(rows[1].latitude, 59.3);
  });

  it("parses MW with comma decimals and rejects negatives", () => {
    assert.equal(parseImportMw("20,5 MW"), 20.5);
    assert.equal(parseImportMw("-1"), -1);
    const mapping = suggestColumnMapping(["Project name", "Latitude", "Longitude", "Import MW"]);
    const rows = validateImportRows([["A", "59", "18", "nope"]], mapping, [], []);
    assert.ok(rows[0].issues.some((issue) => issue.includes("import MW")));
  });

  it("rejects malformed ISO dates", () => {
    const result = normalizeImportTargetCod("2026-13-40");
    assert.equal(result.error, "Target COD is not a valid date.");
    assert.equal(normalizeImportTargetCod("2028").value, "2028");
  });
});

describe("duplicate handling", () => {
  it("detects same name and same coordinates against the organisation", () => {
    const existing = [{ id: "1", name: "North BESS", latitude: 59.12345, longitude: 18.12345 }];
    assert.equal(findDuplicate("north bess", 0, 0, existing)?.id, "1");
    assert.equal(findDuplicate("Other", 59.12345, 18.12345, existing)?.id, "1");
  });

  it("does not treat skip as ready to import", () => {
    const mapping = suggestColumnMapping(["Project name", "Latitude", "Longitude"]);
    const rows = validateImportRows(
      [["North BESS", "59.1", "18.1"]],
      mapping,
      [{ id: "1", name: "North BESS", latitude: 59.1, longitude: 18.1 }],
      [],
    );
    const skipped = summariseImportRows(rows, { [rows[0].rowNumber]: "skip" });
    const imported = summariseImportRows(rows, { [rows[0].rowNumber]: "import" });
    assert.equal(skipped.ready, 0);
    assert.equal(skipped.skippedDuplicates, 1);
    assert.equal(imported.ready, 1);
  });
});

describe("import permissions", () => {
  it("blocks viewer and allows member", () => {
    assert.equal(canImportProjects("viewer"), false);
    assert.equal(canImportProjects("member"), true);
    assert.equal(canDeleteProjects("member"), false);
    assert.equal(canDeleteProjects("admin"), true);
  });
});
