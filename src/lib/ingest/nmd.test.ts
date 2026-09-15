import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedNmd2023Url, nmd2023ClassToGroup } from "./nmd";

describe("NMD production source", () => {
  it("maps NMD 2023 classes for screening groups", () => {
    assert.equal(nmd2023ClassToGroup(41), "open");
    assert.equal(nmd2023ClassToGroup(2), "wetland");
  });

  it("allows https NMD COG URLs and rejects non-https hosts in production rules", () => {
    assert.equal(isAllowedNmd2023Url("https://example.supabase.co/storage/v1/object/public/nmd/NMD2023bas_v0_3_cog.tif"), true);
    assert.equal(isAllowedNmd2023Url("ftp://example.com/nmd.tif"), false);
    assert.equal(isAllowedNmd2023Url("not-a-url"), false);
  });
});
