// Deterministic checks for Zagłoba's retrieval decision and data. Run: node tests/zagloba.cjs
"use strict";
const { assert, load, test, finish } = require("./harness.cjs");
const Z = load("zagloba-data.js", "ZaglobaData");
const SETTINGS = [{ boardAccess: false }, { boardAccess: true }];

test("permission invariant: a document the user cannot read is never cited", () => {
  for (const p of Z.PROMPTS) for (const s of SETTINGS) {
    const d = Z.decide(p, s);
    for (const id of d.citations) assert.ok(Z.canRead(Z.DOCS[id], s), p.id + " cites " + id);
    for (const id of d.skipped) assert.ok(!d.citations.includes(id) && !d.ranked.includes(id), p.id + " skipped " + id + " but used");
  }
});

test("procedure question: the board document is skipped without access and cited with it", () => {
  const p = Z.promptById("procedure");
  const without = Z.decide(p, { boardAccess: false }), withAccess = Z.decide(p, { boardAccess: true });
  assert.deepStrictEqual([...without.skipped], ["limity"]);
  assert.ok(!without.citations.includes("limity") && withAccess.citations.includes("limity"));
  assert.strictEqual(withAccess.skipped.length, 0);
});

test("no coverage: no speculative answer, the right source is named", () => {
  const d = Z.decide(Z.promptById("nodata"), {});
  assert.strictEqual(d.outcome, "nodata");
  assert.ok(d.redirect && d.answer.includes(d.redirect) && d.badge.includes(d.redirect));
});

test("ranking: citations are the top-k relevant readable documents, best first", () => {
  for (const p of Z.PROMPTS) for (const s of SETTINGS) {
    const d = Z.decide(p, s);
    assert.ok(d.ranked.length <= Z.TOP_K);
    for (const id of d.ranked) assert.ok(d.scores[id].score >= Z.RELEVANCE_MIN, id);
    for (let i = 1; i < d.ranked.length; i++) assert.ok(d.scores[d.ranked[i - 1]].score >= d.scores[d.ranked[i]].score);
  }
});

test("answer citation numbers exist: every [n] refers to a cited document", () => {
  for (const p of Z.PROMPTS) for (const s of SETTINGS) {
    const d = Z.decide(p, s), nums = [...d.answer.matchAll(/\[(\d+)\]/g)].map(m => +m[1]);
    for (const n of nums) assert.ok(n >= 1 && n <= d.citations.length, p.id + " [" + n + "] of " + d.citations.length);
  }
});

test("scenes and documents are consistent", () => {
  const ids = Z.SCENES.map(s => s.id); assert.strictEqual(new Set(ids).size, ids.length);
  for (const p of Z.PROMPTS) for (const [id] of p.candidates) assert.ok(Z.DOCS[id], id);
  for (const doc of Object.values(Z.DOCS)) assert.ok(Z.SOURCES[doc.source], doc.title);
  assert.strictEqual(Z.packetAt("model"), "local"); assert.strictEqual(Z.packetAt("nope"), "none");
});

finish();
