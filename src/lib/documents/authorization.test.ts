import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canChangeDocumentStatus,
  canDeleteDocuments,
  canUploadDocuments,
  documentHasStoredFile,
  nextDocumentDeletionStep,
  assertProjectBelongsToOrganization,
} from "@/lib/documents/authorization";
import { validateDocumentUploadFile } from "@/lib/documents/file-types";

describe("document role matrix", () => {
  it("blocks viewer upload, status change, and delete", () => {
    assert.equal(canUploadDocuments("viewer"), false);
    assert.equal(canDeleteDocuments("viewer"), false);
    assert.equal(canChangeDocumentStatus("viewer"), false);
  });

  it("allows owner, admin, and member write actions", () => {
    for (const role of ["owner", "admin", "member"]) {
      assert.equal(canUploadDocuments(role), true);
      assert.equal(canDeleteDocuments(role), true);
      assert.equal(canChangeDocumentStatus(role), true);
    }
  });
});

describe("document tenant authorization", () => {
  it("rejects a project from another organisation", () => {
    assert.equal(
      assertProjectBelongsToOrganization({
        projectOrganizationId: "org-b",
        activeOrganizationId: "org-a",
      }),
      false,
    );
  });
});

describe("legacy metadata-only documents", () => {
  it("does not treat empty storage_path as a stored file", () => {
    assert.equal(documentHasStoredFile(null), false);
    assert.equal(documentHasStoredFile(""), false);
    assert.equal(documentHasStoredFile("org/project/doc/file.pdf"), true);
  });
});

describe("document deletion order", () => {
  it("removes the storage object before the database record when a file exists", () => {
    assert.equal(
      nextDocumentDeletionStep({ hasStoredFile: true, storageRemoved: false }),
      "storage",
    );
    assert.equal(
      nextDocumentDeletionStep({ hasStoredFile: true, storageRemoved: true }),
      "record",
    );
  });

  it("deletes metadata-only rows without a storage step", () => {
    assert.equal(
      nextDocumentDeletionStep({ hasStoredFile: false, storageRemoved: false }),
      "record",
    );
  });
});

describe("document upload validation", () => {
  it("accepts a pdf under the size limit", () => {
    const result = validateDocumentUploadFile({
      filename: "study.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    assert.equal(result.ok, true);
  });

  it("rejects oversized files", () => {
    const result = validateDocumentUploadFile({
      filename: "study.pdf",
      mimeType: "application/pdf",
      sizeBytes: 21 * 1024 * 1024,
    });
    assert.equal(result.ok, false);
  });

  it("rejects disallowed types", () => {
    const result = validateDocumentUploadFile({
      filename: "payload.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 1024,
    });
    assert.equal(result.ok, false);
  });
});
