import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRequiredOperators } from "./demo-seed-operators.mjs";

describe("demo operator resolution", () => {
  it("resolves required operators by catalog name rather than seed.sql UUIDs", () => {
    const resolved = resolveRequiredOperators([
      { id: "11111111-1111-4111-8111-111111111111", name: "Ellevio" },
      { id: "22222222-2222-4222-8222-222222222222", name: "Vattenfall Eldistribution" },
      { id: "33333333-3333-4333-8333-333333333333", name: "E.ON Energidistribution" },
      { id: "44444444-4444-4444-8444-444444444444", name: "Göteborg Energi" },
    ]);
    assert.equal(resolved.ellevio.name, "Ellevio");
    assert.equal(resolved.vattenfall.id, "22222222-2222-4222-8222-222222222222");
    assert.equal(resolved.eon.name, "E.ON Energidistribution");
    assert.equal(resolved.goteborg.name, "Göteborg Energi");
  });

  it("fails rather than inventing a missing operator", () => {
    assert.throws(
      () =>
        resolveRequiredOperators([
          { id: "11111111-1111-4111-8111-111111111111", name: "Ellevio" },
        ]),
      /required grid operators were not found/,
    );
  });
});
