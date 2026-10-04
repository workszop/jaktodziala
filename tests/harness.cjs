// Shared harness for the Node checks (route.cjs, zagloba.cjs): loads a classic-script data file into a sandbox,
// runs named tests and scans every shipped text file for em-dashes.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");

const ROOT = path.join(__dirname, "..");
const EM_DASH = "\u2014";
let passed = 0;

// Runs a classic script (it publishes itself on globalThis) and returns what it published as `globalName`.
function load(file, globalName) {
  const ctx = {}; ctx.globalThis = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx, { filename: file });
  return ctx[globalName];
}

function test(name, fn) { fn(); passed++; console.log("ok  " + name); }

// Every text file the site ships: the pages, the scripts at the root, the stylesheet and the README.
// EM_DASH_ROOT points the scan at another folder (to prove the check bites without touching the repo).
function shippedTextFiles(root = process.env.EM_DASH_ROOT || ROOT) {
  return fs.readdirSync(root).filter(f => /\.(html|js)$/.test(f) || f === "app.css" || f === "README.md").sort().map(f => path.join(root, f));
}

function testNoEmDashes() {
  test("no em-dashes in any shipped text file", () => {
    const files = shippedTextFiles();
    assert.ok(files.length > 0, "no files to scan");
    const hits = files.filter(f => fs.readFileSync(f, "utf8").includes(EM_DASH));
    assert.deepStrictEqual(hits.map(f => path.basename(f)), [], "em-dash found");
    if (process.env.EM_DASH_LIST) console.log("    scanned: " + files.map(f => path.basename(f)).join(" "));
  });
}

function finish() { console.log(`\n${passed} passed`); }

module.exports = { assert, load, test, testNoEmDashes, finish };
