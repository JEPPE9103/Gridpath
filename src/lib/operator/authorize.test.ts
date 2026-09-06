import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNoxheimOperator } from "@/lib/operator/authorize";

describe("operator allowlist", () => {
  const env = {
    OPERATOR_EMAILS: "ops@noxheim.com, partner@example.com",
    OPERATOR_USER_IDS: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  } as NodeJS.ProcessEnv;

  it("denies everyone when no allowlist is configured", () => {
    assert.equal(isNoxheimOperator({ email: "ops@noxheim.com", env: {} }), false);
  });

  it("allows only configured emails and user ids (server-side)", () => {
    assert.equal(
      isNoxheimOperator({ email: "ops@noxheim.com", userId: "other", env }),
      true,
    );
    assert.equal(
      isNoxheimOperator({
        email: "nobody@example.com",
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        env,
      }),
      true,
    );
    assert.equal(
      isNoxheimOperator({ email: "customer@example.com", userId: "bbbb", env }),
      false,
    );
  });
});
