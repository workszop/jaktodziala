// Shared harness for the Node checks (route.cjs, zagloba.cjs): loads a classic-script data file into a sandbox,
// runs named tests and scans every shipped text file for em-dashes (testNoEmDashes, run once, from route.cjs).
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
const SHIPPED_KNOWN = ["index.html", "klara.html", "zagloba.html", "app.css", "README.md", "app-core.js", "world-core.js"];
const shippedTextFiles = () => fs.readdirSync(ROOT).filter(f => /\.(html|js)$/.test(f) || f === "app.css" || f === "README.md").sort();

function testNoEmDashes() {
  test("no em-dashes in any shipped text file", () => {
    const files = shippedTextFiles();
    for (const f of SHIPPED_KNOWN) assert.ok(files.includes(f), "not scanned: " + f);
    const hits = files.filter(f => fs.readFileSync(path.join(ROOT, f), "utf8").includes(EM_DASH));
    assert.deepStrictEqual(hits, [], "em-dash found");
  });
}

function finish() { console.log(`\n${passed} passed`); }

module.exports = { assert, load, test, testNoEmDashes, finish };
