// Run with: npm test ReccoBeats requests that are skipped before reaching the network.
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { idsForIsrc } from "../services/mood/reccobeats.js";

const realFetch = globalThis.fetch;

describe("idsForIsrc", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("doesn't search titles too short for ReccoBeats, which it rejects", async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      throw new Error("should not be called");
    };

    assert.deepEqual(await idsForIsrc("灯火", "JPU901900123"), []);
    assert.deepEqual(await idsForIsrc(" 風花 ", "JPU901900124"), []);
    assert.equal(calls, 0);
  });
});
