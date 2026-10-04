// Headless browser checks for the home page (index.html) and both apps (Klara: klara.html, Zagłoba: zagloba.html): WebGL self-test over every prompt × policy × scene, a real-time
// keyboard playthrough, phone-width overflow and the CDN-blocked schematic fallback.
// Run: PLAYWRIGHT_MODULE=/abs/path/to/playwright/index.mjs CHROME_PATH=/usr/bin/google-chrome node tests/browser.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".css": "text/css" };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(ROOT, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const ROOT_URL = `http://127.0.0.1:${server.address().port}/`;
const BASE = ROOT_URL + "klara.html";

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], failures = [];
const check = (name, ok, detail = "") => { console.log((ok ? "ok  " : "FAIL") + " " + name + (detail ? " – " + detail : "")); if (!ok) failures.push(name); };
const watch = p => { p.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); p.on("pageerror", e => errors.push(e.message)); return p; };
const data = p => p.evaluate(() => ({ ...document.getElementById("app").dataset }));
const ready = (p, r = "webgl") => p.waitForFunction(want => document.getElementById("app").dataset.renderer === want, r, { timeout: 25000 });
const done = p => p.waitForFunction(() => document.getElementById("app").dataset.phase === "done", null, { timeout: 45000 });
const noOverflow = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
// Keyboard playthrough to the summary: `key` picks the prompt in the chat; after every scene the world's packet must match
// the DOM contract and the probe must pass. Returns the scenes seen.
async function playthrough(p, key, prefix = "") {
  const seen = [];
  for (let i = 0; i < 14; i++) {
    // the contract updates on the key event, the world publishes its packet on its next frame – after the collision replay
    // that first software-WebGL frame can take seconds under load, so allow a generous catch-up before comparing
    await p.waitForFunction(() => { const s = document.getElementById("app").dataset; return s.packet === "moving" || s.worldPacket === s.packet; }, null, { timeout: 10000 }).catch(() => {});
    const d = await data(p); seen.push(d.scene);
    if (d.packet !== "moving" && d.worldPacket !== d.packet) check(prefix + "world packet at " + d.scene, false, d.worldPacket + " ≠ " + d.packet);
    if (d.scene === "final") break;
    if (d.scene === "chat") { await p.keyboard.press(key); await p.keyboard.press("Enter"); } else await p.keyboard.press("ArrowRight");
    await done(p);
    const pr = await p.evaluate(() => App.probe()); if (!pr.ok) check(prefix + "probe at " + pr.scene, false, pr.failures.join(","));
  }
  return seen;
}

try {
  // 0) home page: lists both journeys, keys 1/2 open them, old deep links still reach Klara
  const h = watch(await browser.newPage({ viewport: { width: 1440, height: 860 } }));
  await h.goto(ROOT_URL + "index.html");
  const hd = await h.evaluate(() => ({ ...document.getElementById("home").dataset, apps: [...document.querySelectorAll(".choice")].map(a => a.dataset.app + ">" + a.getAttribute("href")) }));
  check("home lists Klara and Zagłoba", hd.ready === "true" && hd.apps.join() === "klara>klara.html,zagloba>zagloba.html", hd.apps.join());
  check("home: one top-level heading", await h.locator("h1").count() === 1);
  check("home: both scene visuals load", await h.evaluate(() => [...document.querySelectorAll(".choice img")].every(i => i.complete && i.naturalWidth > 0)));
  // a navigation that never happens is a named failure, not an exception that skips the rest of the run
  const lands = (act, url) => act().then(() => h.waitForURL(url, { timeout: 10000 })).then(() => true, () => false);
  check("home: key 2 opens Zagłoba", await lands(() => h.keyboard.press("2"), /zagloba\.html$/));
  check("home: clicking the Klara card opens Klara", await lands(async () => { await h.goto(ROOT_URL + "index.html"); await h.click('.choice[data-app="klara"]'); }, /klara\.html$/));
  check("app logo links back home", await lands(() => h.click(".brand .home-link", { timeout: 10000 }), /index\.html$/));
  check("old index.html deep link redirects to Klara", await lands(() => h.goto(ROOT_URL + "index.html?scene=admin&prompt=complex"), /klara\.html\?scene=admin&prompt=complex$/));
  await h.close();
  const hm = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
  await hm.goto(ROOT_URL + "index.html");
  check("home: no horizontal overflow at 390px", await noOverflow(hm)); await hm.close();

  // 1) WebGL self-test
  const page = watch(await browser.newPage({ viewport: { width: 1440, height: 860 } }));
  await page.goto(BASE); await ready(page);
  // default mode: Auto, advancing without input; dragging the 3D view keeps it; the switch goes to step by step
  check("starts in Auto mode", (await data(page)).auto === "true");
  // every simulation starts idle: the robot stands in the room until Start, and Auto does not leave that on its own
  const idleRobot = p => p.waitForFunction(() => { const s = document.getElementById("app").dataset; return s.phase === "idle" && s.worldRobot === "waiting"; }, null, { timeout: 10000 }).then(() => true, () => false);
  check("starts idle with the robot standing in the room", await idleRobot(page) && await page.isVisible("#btnStart"));
  await page.waitForTimeout(3000);
  check("Auto waits for Start", (await data(page)).phase === "idle" && (await page.evaluate(() => App.probe())).ok);
  await page.click("#btnStart");
  check("Start: robot walks to the computer, Auto stays on", await page.waitForFunction(() => document.getElementById("app").dataset.worldRobot === "walking", null, { timeout: 10000 }).then(() => true, () => false)
    && (await data(page)).auto === "true" && !(await page.isVisible("#btnStart")));
  await page.waitForFunction(() => document.getElementById("app").dataset.scene !== "login", null, { timeout: 45000 });
  check("Auto advances past the first scene on its own", true);
  const box = await page.locator(".world-canvas").boundingBox();
  if (box) { await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 320, box.y + 210); await page.mouse.up(); }
  check("rotating the 3D view keeps Auto", (await data(page)).auto === "true");
  await page.click("#btnStep");
  check("switch to Krok po kroku", (await data(page)).auto === "false" && await page.getAttribute("#btnStep", "aria-pressed") === "true");
  await page.click("#btnAuto");
  check("switch back to Auto", (await data(page)).auto === "true");
  const stepPage = watch(await browser.newPage({ viewport: { width: 1280, height: 800 } }));
  await stepPage.goto(BASE + "?auto=0"); await ready(stepPage);
  check("?auto=0 starts step by step", (await data(stepPage)).auto === "false"); await stepPage.close();
  const st = await page.evaluate(() => App.selfTest());
  check("self-test: prompts × policies × scenes", st.ok, st.failures.slice(0, 3).join(" | "));
  const col = await page.evaluate(() => KlaraWorld.debugCollisions());
  check("travelling sheet never passes through scene geometry", col.ok, (col.hits || []).slice(0, 3).map(h => h.scene + "@" + h.t0 + " " + h.mesh).join(" | "));

  // 2) real-time keyboard playthrough of a protected-data run
  await page.keyboard.press("r");
  check("restart returns to the idle start", await idleRobot(page));
  const seen = await playthrough(page, "1");
  check("playthrough reaches the summary", seen.at(-1) === "final", seen.join(">"));
  check("one run recorded, routed locally", (await data(page)).runs === "1" && (await page.evaluate(() => App.state.runs[0].target)) === "local");
  const st2 = await page.evaluate(() => App.selfTest());
  check("self-test passes after the user's own runs", st2.ok, st2.failures.slice(0, 3).join(" | "));

  // 3) phone width
  const m = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
  await m.goto(BASE + "?scene=admin&prompt=complex"); await ready(m);
  check("no horizontal overflow at 390px", await noOverflow(m));

  // 4) schematic fallback without the 3D library
  const f = watch(await browser.newPage({ viewport: { width: 1280, height: 800 } }));
  await f.route(/cdn\.jsdelivr\.net/, r => r.abort());
  await f.goto(BASE + "?scene=route&prompt=sensitive&policy=frontier"); await ready(f, "fallback");
  const fp = await f.evaluate(() => App.probe());
  check("fallback probe (privacy + flow contract)", fp.ok, fp.failures.join(","));
  check("fallback blocks external routes", await f.evaluate(() => ["apiq", "frontier"].every(r => document.querySelector(`#flowBig [data-node="${r}"]`).dataset.state === "blocked")));

  // 4b) shell regressions: the idle stepper, keyboard focus, deep-linked runs, reduced motion, the setting API
  const g = watch(await browser.newPage({ viewport: { width: 1440, height: 860 } }));
  await g.goto(BASE + "?auto=0"); await ready(g);
  await g.click('.step[data-scene="login"]');
  check("stepper 01 while idle acts as Start (the robot walks, not logged in at once)", (await data(g)).phase === "playing");
  for (const key of ["Enter", " "]) {
    await g.goto(BASE + "?auto=0"); await ready(g); await g.focus("#btnStart"); await g.keyboard.press(key);
    check(`keyboard Start (${key === " " ? "Space" : key}) leaves focus on Dalej`, await g.evaluate(() => document.activeElement.id) === "btnNext");
  }
  await g.evaluate(() => App.goTo("final")); await g.focus("#final .final-actions button:nth-child(3)"); await g.keyboard.press("Enter");
  check("Zacznij od nowa by keyboard puts focus on Start", await g.evaluate(() => document.activeElement.id) === "btnStart" && (await data(g)).phase === "idle");
  for (const q of ["prompt=complex&scene=chat", "prompt=complex"]) {
    await g.goto(BASE + "?auto=0&" + q); await ready(g);
    const n = await g.evaluate(() => { for (const s of ["chat", "send", "scan", "gauge", "route", "model", "return", "admin", "final"]) App.goTo(s); return App.state.runs.length; });
    check(`deep-linked prompt (${q}) is logged as a run`, n === 1, n + " runs");
  }
  await g.goto(BASE + "?auto=0&scene=admin&prompt=complex"); await ready(g);
  const pol0 = (await data(g)).policy; await g.evaluate(() => App.setPolicy("bogus"));
  check("App.setPolicy ignores an unknown policy", (await data(g)).policy === pol0, (await data(g)).policy);
  await g.click('.opts [role="radio"]:nth-child(2)');
  check("clicking a policy option selects it and keeps focus on it", (await data(g)).policy === "frontier" && await g.evaluate(() => document.activeElement.dataset.value) === "frontier");
  await g.keyboard.press("ArrowDown");
  check("arrow keys move the policy radio and its focus", (await data(g)).policy === "off" && await g.evaluate(() => document.activeElement.dataset.value) === "off");
  await g.close();
  const rm = watch(await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" }));
  await rm.goto(BASE + "?auto=0");
  const blink = await rm.evaluate(() => {
    const f = document.createElement("label"), o = document.createElement("output"); f.className = "field"; o.className = "caret"; f.appendChild(o); document.body.appendChild(f);
    const n = getComputedStyle(o, "::after").animationIterationCount; f.remove(); return n;
  });
  check("reduced motion stops the caret blink (pseudo-elements)", blink === "1", blink); await rm.close();

  // 5) Zagłoba: same shell and engine, its own invariants (permissions, citations, abstention)
  const z = watch(await browser.newPage({ viewport: { width: 1440, height: 860 } }));
  await z.goto(ROOT_URL + "zagloba.html" + "?auto=0"); await ready(z);
  const zt = await z.evaluate(() => App.selfTest());
  check("Zagłoba self-test: questions × access × scenes", zt.ok, zt.failures.slice(0, 3).join(" | "));
  const zc = await z.evaluate(() => ZaglobaWorld.debugCollisions());
  check("Zagłoba: sheet never passes through scene geometry", zc.ok, (zc.hits || []).slice(0, 3).map(h => h.scene + "@" + h.t0 + " " + h.mesh).join(" | "));
  await z.evaluate(() => App.restart()); await z.keyboard.press("ArrowRight"); await z.waitForTimeout(100); await done(z);
  const zseen = await playthrough(z, "2", "Zagłoba ");
  check("Zagłoba playthrough (restricted question) reaches the summary", zseen.at(-1) === "final", zseen.join(">"));
  const zrun = await z.evaluate(() => App.state.runs[0]);
  check("Zagłoba: board document skipped and never cited", zrun && zrun.skipped.includes("budzet") && !zrun.citations.includes("budzet"));
  // the access setting resolves values through its declared options: "false" is not access, junk is ignored
  await z.evaluate(() => App.goTo("admin"));
  await z.evaluate(() => App.setAccess("false"));
  check("App.setAccess(\"false\") leaves access off", (await data(z)).boardAccess === "false" && await z.evaluate(() => App.state.settings.boardAccess) === false);
  await z.evaluate(() => App.setAccess("bogus"));
  check("App.setAccess ignores an unknown value", (await data(z)).boardAccess === "false");
  await z.evaluate(() => App.setAccess(true));
  check("App.setAccess(true) grants access", (await data(z)).boardAccess === "true" && await z.evaluate(() => App.state.settings.boardAccess) === true);
  await z.evaluate(() => App.setAccess(false)); await z.focus('.opts [role="radio"]'); await z.keyboard.press("ArrowDown");
  check("Zagłoba: arrow keys move the access radio and its focus", (await data(z)).boardAccess === "true" && await z.evaluate(() => document.activeElement.dataset.value) === "true");
  const zm = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
  await zm.goto(ROOT_URL + "zagloba.html" + "?scene=admin&prompt=restricted"); await ready(zm);
  check("Zagłoba: no horizontal overflow at 390px", await noOverflow(zm));

  const real = errors.filter(e => !/jsdelivr|ERR_FAILED|Failed to fetch dynamically/.test(e)); // the blocked CDN in step 4 is expected
  check("no console errors", real.length === 0, real.slice(0, 3).join(" | "));
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `\n${failures.length} failed` : "\nall passed");
process.exit(failures.length ? 1 : 0);
