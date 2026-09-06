import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDocumentStoragePath,
  parseDocumentStoragePath,
  sanitizeOriginalFilename,
  storagePathBelongsToTenant,
} from "@/lib/documents/storage-path";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const PROJECT_A = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_A = "44444444-4444-4444-8444-444444444444";

describe("document storage path", () => {
  it("builds a tenant/project/document path", () => {
    const path = buildDocumentStoragePath({
      organizationId: ORG_A,
      projectId: PROJECT_A,
      documentId: DOCUMENT_A,
      originalFilename: "Q4 memo.pdf",
    });
    assert.equal(path, `${ORG_A}/${PROJECT_A}/${DOCUMENT_A}/Q4 memo.pdf`);
  });

  it("rejects path separators in filenames", () => {
    assert.equal(sanitizeOriginalFilename("../secret.pdf"), "secret.pdf");
    assert.equal(sanitizeOriginalFilename("folder\\nested.docx"), "nested.docx");
  });

  it("rejects another organisation's path", () => {
    const path = buildDocumentStoragePath({
      organizationId: ORG_B,
      projectId: PROJECT_A,
      documentId: DOCUMENT_A,
      originalFilename: "file.pdf",
    });
    assert.equal(storagePathBelongsToTenant(path, ORG_A, PROJECT_A), false);
    assert.equal(storagePathBelongsToTenant(path, ORG_B, PROJECT_A), true);
  });

  it("parses only the expected four-segment shape", () => {
    assert.equal(parseDocumentStoragePath("not-a-path"), null);
    const parsed = parseDocumentStoragePath(
      `${ORG_A}/${PROJECT_A}/${DOCUMENT_A}/grid-study.pdf`,
    );
    assert.deepEqual(parsed, {
      organizationId: ORG_A,
      projectId: PROJECT_A,
      documentId: DOCUMENT_A,
      originalFilename: "grid-study.pdf",
    });
  });
});
