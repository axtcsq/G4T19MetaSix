// Run with: npm test The six types as the Personality page shows them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { describeTypes } from "../services/patterns.js";

test("all six types are described", () => {
  const types = describeTypes();
  assert.deepEqual(
    types.map((type) => type.id),
    ["storm-chaser", "tide-keeper", "poet", "daydreamer", "spark", "wanderer"],
  );
  for (const type of types) {
    assert.ok(type.name && type.tagline && type.description, type.id);
    assert.ok(type.traits.length > 0, type.id);
  }
});

test("each type names the traits it leans towards", () => {
  const traits = Object.fromEntries(describeTypes().map((type) => [type.id, type.traits]));
  assert.deepEqual(traits["storm-chaser"], ["Amped", "Explorer"]);
  assert.deepEqual(traits["tide-keeper"], ["Mellow", "Loyalist"]);
  assert.deepEqual(traits.poet, ["Wordsmith", "Solo"]);
  assert.deepEqual(traits.daydreamer, ["Mellow", "Soundscaper", "Solo"]);
  assert.deepEqual(traits.spark, ["Amped", "Crowd"]);
  assert.deepEqual(traits.wanderer, ["Explorer", "Soundscaper"]);
});

test("the target profiles stay on the server", () => {
  for (const type of describeTypes()) assert.equal(type.profile, undefined);
});
