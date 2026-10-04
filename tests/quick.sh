#!/usr/bin/env bash
# Quick tier (~30 s): syntax of every script, the Node unit tests and the browser smoke section.
# The full suite (node tests/browser.mjs, ~minutes) is for shared or rendering changes and before a push.
# Needs PLAYWRIGHT_MODULE (and CHROME_PATH) like tests/browser.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in *.js tests/*.cjs tests/*.mjs; do node --check "$f"; done
node tests/route.cjs | tail -n 1
node tests/zagloba.cjs | tail -n 1
node tests/browser.mjs --only=smoke
