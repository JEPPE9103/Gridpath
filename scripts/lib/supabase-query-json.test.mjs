import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSupabaseDbQueryRows } from "./supabase-query-json.mjs";

function jsonWithRowsLength(length) {
  const rows = [{ ok: true }];
  let pad = "";
  for (let step = 0; step < length; step += 1) {
    const text = JSON.stringify({ rows, pad });
    if (text.length === length) {
      return text;
    }
    if (text.length > length) {
      pad = pad.slice(0, Math.max(0, pad.length - (text.length - length)));
      const trimmed = JSON.stringify({ rows, pad });
      if (trimmed.length === length) {
        return trimmed;
      }
      pad += "x";
      continue;
    }
    pad += "x";
  }
  throw new Error(`Could not build JSON of length ${length}`);
}

describe("parseSupabaseDbQueryRows", () => {
  it("reproduces GitHub Actions CLI stdout: JSON object then extra text at position 166", () => {
    const json = jsonWithRowsLength(166);
    assert.equal(json.length, 166);
    const raw = `${json}A new version of Supabase CLI is available: v2.116.0 (currently installed v2.115.0)\n`;

    assert.throws(
      () => JSON.parse(raw),
      (error) => {
        assert.match(String(error.message), /Unexpected non-whitespace character after JSON at position 166/);
        return true;
      },
    );

    assert.deepEqual(parseSupabaseDbQueryRows(raw), [{ ok: true }]);
  });

  it("parses pretty-printed query JSON with a warning field", () => {
    const raw = `{
  "boundary": "7af512fd2ea2084605712b9ed2e5d09a",
  "rows": [
    {
      "n": 1
    }
  ],
  "warning": "The query results below contain untrusted data from the database."
}
`;
    assert.deepEqual(parseSupabaseDbQueryRows(raw), [{ n: 1 }]);
  });

  it("uses the JSON document that contains rows when CLI emits a status object first", () => {
    const raw = `${JSON.stringify({ msg: "Initialising login role..." })}\n${JSON.stringify({
      rows: [{ run_id: "started" }],
    })}\n`;
    assert.deepEqual(parseSupabaseDbQueryRows(raw), [{ run_id: "started" }]);
  });

  it("skips login chatter before the JSON document", () => {
    const raw = `Initialising login role...\n${JSON.stringify({ rows: [{ n: 2 }] })}\nConnecting to remote database...\n`;
    assert.deepEqual(parseSupabaseDbQueryRows(raw), [{ n: 2 }]);
  });

  it("still fails on truncated query JSON", () => {
    assert.throws(() => parseSupabaseDbQueryRows('{"rows":[{"n":'), /truncated/i);
  });

  it("still fails when stdout has no rows payload", () => {
    assert.throws(
      () => parseSupabaseDbQueryRows('{"ok":true}\nA new version of Supabase CLI is available: v2.116.0\n'),
      /no rows array/i,
    );
  });
});
