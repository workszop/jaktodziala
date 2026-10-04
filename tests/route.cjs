// Deterministic checks for the routing decision and scene data. Run: node tests/route.cjs
"use strict";
const { assert, load, test, testNoEmDashes, finish } = require("./harness.cjs");
const K = load("klara-data.js", "KlaraData");

test("every prompt × policy yields a known target", () => {
  for (const p of K.PROMPTS) for (const o of K.POLICY_OPTIONS) {
    const d = K.decide(p, { external: o.id });
    assert.ok(K.ROUTE_IDS.includes(d.target), p.id + "/" + o.id);
    assert.strictEqual(d.states[d.target], "on");
    assert.strictEqual(Object.values(d.states).filter(s => s === "on").length, 1);
  }
});

test("privacy invariant: protected data is never routed externally, under any policy", () => {
  for (const p of K.PROMPTS.filter(p => K.protectedItems(p).length)) for (const o of K.POLICY_OPTIONS) {
    const d = K.decide(p, { external: o.id });
    assert.strictEqual(d.target, "local");
    assert.strictEqual(d.external, false);
    assert.strictEqual(d.states.apiq, "blocked");
    assert.strictEqual(d.states.frontier, "blocked");
  }
});

test("routine and standard tasks stay local; complex follows policy", () => {
  assert.strictEqual(K.decide(K.promptById("routine"), { external: "frontier" }).target, "local");
  // "standard" without protected data (the only standard prompt also carries protected data, which would keep it local anyway)
  const standard = { ...K.promptById("complex"), complexity: "standard" };
  for (const o of K.POLICY_OPTIONS) {
    const d = K.decide(standard, { external: o.id });
    assert.strictEqual(d.level, "standard"); assert.strictEqual(d.protectedCount, 0); assert.strictEqual(d.target, "local", o.id);
  }
  assert.strictEqual(K.decide(K.promptById("complex"), { external: "apiq" }).target, "apiq");
  assert.strictEqual(K.decide(K.promptById("complex"), { external: "frontier" }).target, "frontier");
  assert.strictEqual(K.decide(K.promptById("complex"), { external: "off" }).target, "local");
  assert.strictEqual(K.decide(K.promptById("complex"), { external: "bogus" }).target, "apiq", "unknown policy falls back to default");
  assert.strictEqual(K.decide(null, K.DEFAULT_SETTINGS), null);
});

test("sensitive fragments exist verbatim in their prompt text or attachment", () => {
  for (const p of K.PROMPTS) for (const s of p.sensitive) assert.ok(p.text.includes(s.text), s.text);
  for (const p of K.PROMPTS.filter(p => p.attachment)) for (const s of p.attachment.sensitive) assert.ok(p.attachment.lines.some(l => l.includes(s.text)), s.text);
});

test("mask tokens never contain the text they hide", () => {
  for (const p of K.PROMPTS) for (const s of K.protectedItems(p)) assert.ok(!s.token.includes(s.text), s.token);
});

test("answers never echo protected fragments (prompt or attachment)", () => {
  for (const p of K.PROMPTS) for (const s of K.protectedItems(p)) assert.ok(!p.answer.includes(s.text), s.text);
});

test("attachment-only protected data keeps a complex task local under every policy", () => {
  const p = K.promptById("attachment");
  assert.strictEqual(p.sensitive.length, 0, "prompt text itself is neutral");
  assert.strictEqual(p.complexity, "high", "without the attachment it would go external");
  for (const o of K.POLICY_OPTIONS) {
    const d = K.decide(p, { external: o.id });
    assert.strictEqual(d.target, "local"); assert.strictEqual(d.fromAttachment, true);
    assert.strictEqual(d.states.apiq, "blocked"); assert.strictEqual(d.states.frontier, "blocked");
    assert.ok(d.reason.includes("załączniku"));
  }
  const noAttachment = { ...p, attachment: undefined };
  assert.strictEqual(K.decide(noAttachment, { external: "apiq" }).target, "apiq", "the attachment is what changes the route");
});

test("scenes: unique ids, positive durations, packet locations resolvable", () => {
  const ids = K.SCENES.map(s => s.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const s of K.SCENES) assert.ok(s.dur > 0, s.id);
  const d = K.decide(K.promptById("complex"), { external: "frontier" });
  assert.strictEqual(K.packetAt("model", d), "frontier");
  assert.strictEqual(K.packetAt("scan", d), "scan");
  assert.strictEqual(K.packetAt("nope", d), "none");
});

testNoEmDashes();
finish();
