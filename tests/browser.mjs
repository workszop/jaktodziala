// Headless browser checks for the home page (index.html) and both apps (Klara: klara.html, Zagłoba: zagloba.html): WebGL self-test over every prompt × policy × scene, a
// keyboard playthrough (at ?speed=4; Auto's first scene runs in real time), phone-width overflow and the CDN-blocked schematic fallback.
// Run: PLAYWRIGHT_MODULE=/abs/path/to/playwright/index.mjs CHROME_PATH=/usr/bin/google-chrome node tests/browser.mjs [--only=home,klara,zagloba | --only=smoke]
// Sections print their time. CDN files (three.js, fonts) are served from tests/.cache after the first run, so a CDN hiccup cannot fail a run.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
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
const CACHE = join(ROOT, "tests", ".cache");
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|(api|cdn)\.fontshare\.com|fonts\.(googleapis|gstatic)\.com)\//;
// --only=a,b runs those sections; without it everything except the quick smoke section runs
const ONLY = (process.argv.find(a => a.startsWith("--only=")) || "--only=").slice(7).split(",").filter(Boolean);
const want = s => (ONLY.length ? ONLY.includes(s) : s !== "smoke");

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], failures = [];
const check = (name, ok, detail = "") => { console.log((ok ? "ok  " : "FAIL") + " " + name + (detail ? " – " + detail : "")); if (!ok) failures.push(name); };
const watch = p => { p.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); p.on("pageerror", e => errors.push(e.message)); return p; };
// CDN request → the local cache, fetched (and stored) once on a miss; CORS header because fonts and the module script are cross-origin
async function cdn(route) {
  const url = route.request().url(), file = join(CACHE, createHash("sha1").update(url).digest("hex")), headers = { "access-control-allow-origin": "*" };
  try { const [body, meta] = await Promise.all([readFile(file), readFile(file + ".json", "utf8")]); return await route.fulfill({ body, headers, ...JSON.parse(meta) }); } catch {}
  try {
    const r = await route.fetch({ timeout: 20000 }), body = await r.body(), meta = { status: r.status(), contentType: r.headers()["content-type"] || "application/octet-stream" };
    if (r.ok()) { await mkdir(CACHE, { recursive: true }); await writeFile(file, body); await writeFile(file + ".json", JSON.stringify(meta)); }
    return await route.fulfill({ body, headers, ...meta });
  } catch { return route.abort(); }
}
const open = async (opts = {}) => { const p = watch(await browser.newPage({ viewport: { width: 1440, height: 860 }, ...opts })); await p.route(CDN, cdn); return p; };
// section timer: lap(name) prints the previous section's time and starts the next one
let lapName = "", lapT = Date.now();
const lap = name => { if (lapName) console.log(`     ${lapName}: ${((Date.now() - lapT) / 1000).toFixed(1)} s`); lapName = name; lapT = Date.now(); };
const data = p => p.evaluate(() => ({ ...document.getElementById("app").dataset }));
const ready = (p, r = "webgl") => p.waitForFunction(want => document.getElementById("app").dataset.renderer === want, r, { timeout: 25000 });
// a condition that never comes true is a named failure (false), not a timeout exception that aborts the run
const until = (p, fn, ms = 10000) => p.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
const done = p => until(p, () => document.getElementById("app").dataset.phase === "done", 45000);
const noOverflow = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
// Keyboard playthrough to the summary: `key` picks the prompt in the chat; after every scene the world's packet must match
// the DOM contract and the probe must pass. Returns the scenes seen.
async function playthrough(p, key, prefix = "") {
  const seen = [];
  for (let i = 0; i < 14; i++) {
    // the contract updates on the key event, the world publishes its packet on its next frame – after the collision replay
    // that first software-WebGL frame can take seconds under load, so allow a generous catch-up before comparing
    await until(p, () => { const s = document.getElementById("app").dataset; return s.packet === "moving" || s.worldPacket === s.packet; });
    const d = await data(p); seen.push(d.scene);
    if (d.packet !== "moving" && d.worldPacket !== d.packet) check(prefix + "world packet at " + d.scene, false, d.worldPacket + " ≠ " + d.packet);
    if (d.scene === "final") break;
    if (d.scene === "chat") { await p.keyboard.press(key); await p.keyboard.press("Enter"); } else await p.keyboard.press("ArrowRight");
    if (!await done(p)) { check(prefix + "scene finishes: " + (await data(p)).scene, false); break; }
    const pr = await p.evaluate(() => App.probe()); if (!pr.ok) check(prefix + "probe at " + pr.scene, false, pr.failures.join(","));
  }
  return seen;
}

try {
  // quick tier (--only=smoke): each app loads, waits at the Start with a clean probe, and Start moves the robot
  if (want("smoke")) { lap("smoke");
  for (const app of ["klara", "zagloba"]) {
    const p = await open(); await p.goto(ROOT_URL + app + ".html?speed=4"); await ready(p);
    const idle = await until(p, () => { const s = document.getElementById("app").dataset; return s.phase === "idle" && s.worldRobot === "waiting"; }) && await p.evaluate(() => App.probe().ok);
    await p.evaluate(() => App.start());
    check(app + " smoke: loads, waits at Start, probe ok, Start moves the robot", idle && await until(p, () => document.getElementById("app").dataset.worldRobot !== "waiting"));
    await p.close();
  }
  }

  // 0) home page: lists both journeys, keys 1/2 open them, old deep links still reach Klara
  if (want("home")) { lap("home");
  const h = await open();
  await h.goto(ROOT_URL + "index.html");
  const hd = await h.evaluate(() => ({ ready: document.getElementById("home").dataset.ready, apps: [...document.querySelectorAll(".choice")].map(a => a.dataset.app + ">" + a.getAttribute("href")) }));
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
  const hm = await open({ viewport: { width: 390, height: 844 } });
  await hm.goto(ROOT_URL + "index.html");
  check("home: no horizontal overflow at 390px", await noOverflow(hm)); await hm.close();
  }

  // 1) Klara: Auto and the Start, in real time (the one scene that runs at speed 1)
  if (want("klara")) { lap("klara: Auto + Start (real time)");
  const page = await open();
  await page.goto(BASE); await ready(page);
  // default mode: Auto, advancing without input; dragging the 3D view keeps it; the switch goes to step by step
  check("starts in Auto mode", (await data(page)).auto === "true");
  // every simulation starts idle: the robot stands in the room until Start, and Auto does not leave that on its own
  const idleRobot = p => until(p, () => { const s = document.getElementById("app").dataset; return s.phase === "idle" && s.worldRobot === "waiting"; });
  check("starts idle with the robot standing in the room", await idleRobot(page) && await page.isVisible("#btnStart"));
  // the Auto timer (dwell) only runs once a scene is done: while idle it stays 0 however long the page waits,
  // so ~1.5 s and at least 20 frames (each one an Auto tick) prove it without outwaiting DWELL.login
  await page.evaluate(() => new Promise(r => { const t0 = performance.now(); let n = 0; const f = () => (++n >= 20 && performance.now() - t0 >= 1500 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  check("Auto waits for Start", (await data(page)).phase === "idle" && await page.evaluate(() => App.state.dwell === 0 && App.probe().ok));
  await page.click("#btnStart");
  check("Start: robot walks to the computer, Auto stays on", await until(page, () => document.getElementById("app").dataset.worldRobot === "walking")
    && (await data(page)).auto === "true" && !(await page.isVisible("#btnStart")));
  check("Auto advances past the first scene on its own", await until(page, () => document.getElementById("app").dataset.scene !== "login", 45000));
  const box = await page.locator(".world-canvas").boundingBox();
  if (box) { await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 320, box.y + 210); await page.mouse.up(); }
  check("rotating the 3D view keeps Auto", !!box && (await data(page)).auto === "true", box ? "" : "no 3D canvas");
  await page.click("#btnStep");
  check("switch to Krok po kroku", (await data(page)).auto === "false" && await page.getAttribute("#btnStep", "aria-pressed") === "true");
  await page.click("#btnAuto");
  check("switch back to Auto", (await data(page)).auto === "true");
  await page.close();

  // 2) keyboard playthrough of a protected-data run at ?speed=4, then the self-test (once: it also proves the matrix) and the collision replay
  lap("klara: playthrough + self-test + collisions");
  const kp = await open(); await kp.goto(BASE + "?auto=0&speed=4"); await ready(kp);
  await kp.evaluate(() => App.start()); await kp.keyboard.press("r");
  check("restart returns to the idle start", await idleRobot(kp));
  check("playthrough starts step by step", (await data(kp)).auto === "false");
  const seen = await playthrough(kp, "1");
  check("playthrough reaches the summary", seen.at(-1) === "final", seen.join(">"));
  check("one run recorded, routed locally", (await data(kp)).runs === "1" && (await kp.evaluate(() => App.state.runs[0].target)) === "local");
  const st = await kp.evaluate(() => App.selfTest());
  check("self-test: prompts × policies × scenes", st.ok, st.failures.slice(0, 3).join(" | "));
  check("self-test passes after the user's own runs", st.ok, st.failures.slice(0, 3).join(" | "));
  const col = await kp.evaluate(() => KlaraWorld.debugCollisions());
  check("travelling sheet never passes through scene geometry", col.ok, (col.hits || []).slice(0, 3).map(h => h.scene + "@" + h.t0 + " " + h.mesh).join(" | "));
  await kp.close();

  // 3) phone width
  lap("klara: phone, fallback, shell edge cases");
  const m = await open({ viewport: { width: 390, height: 844 } });
  await m.goto(BASE + "?scene=admin&prompt=complex"); await ready(m);
  check("no horizontal overflow at 390px", await noOverflow(m));

  // 4) schematic fallback without the 3D library
  const f = await open({ viewport: { width: 1280, height: 800 } });
  await f.route(/cdn\.jsdelivr\.net/, r => r.abort());
  await f.goto(BASE + "?scene=route&prompt=sensitive&policy=frontier"); await ready(f, "fallback");
  const fp = await f.evaluate(() => App.probe());
  check("fallback probe (privacy + flow contract)", fp.ok, fp.failures.join(","));
  check("fallback blocks external routes", await f.evaluate(() => ["apiq", "frontier"].every(r => document.querySelector(`#flowBig [data-node="${r}"]`)?.dataset.state === "blocked")));

  // 4b) shell regressions: the idle stepper, keyboard focus, deep-linked runs, reduced motion, the setting API
  const g = await open();
  await g.goto(BASE + "?auto=0"); await ready(g);
  await g.click('.step[data-scene="login"]');
  check("stepper 01 while idle acts as Start (the robot walks, not logged in at once)", (await data(g)).phase === "playing");
  for (const key of ["Enter", " "]) {
    await g.goto(BASE + "?auto=0"); await ready(g); await g.focus("#btnStart"); await g.keyboard.press(key);
    check(`keyboard Start (${key === " " ? "Space" : key}) leaves focus on Dalej`, await g.evaluate(() => document.activeElement.id) === "btnNext");
  }
  // Dalej by keyboard into the chat: without a prompt Dalej is disabled, so focus moves on to a prompt chip, not to the page
  await done(g); await g.focus("#btnNext"); await g.keyboard.press("Enter");
  const fc = await g.evaluate(() => { const a = document.activeElement; return { scene: document.getElementById("app").dataset.scene, on: a.getAttribute("role") === "radio" ? "chip" : a.id === "btnNext" && !a.disabled ? "btnNext" : a.tagName }; });
  check("Dalej into the chat keeps keyboard focus (a prompt chip)", fc.scene === "chat" && (fc.on === "chip" || fc.on === "btnNext"), fc.scene + " / " + fc.on);
  await g.evaluate(() => App.goTo("final")); await g.locator("#final .final-actions button", { hasText: "Zacznij od nowa" }).focus(); await g.keyboard.press("Enter");
  check("Zacznij od nowa by keyboard puts focus on Start", await g.evaluate(() => document.activeElement.id) === "btnStart" && (await data(g)).phase === "idle");
  for (const q of ["prompt=complex&scene=chat", "prompt=complex"]) {
    await g.goto(BASE + "?auto=0&" + q); await ready(g);
    const n = await g.evaluate(() => { for (const s of ["chat", "send", "scan", "gauge", "route", "model", "return", "admin", "final"]) App.goTo(s); return App.state.runs.length; });
    check(`deep-linked prompt (${q}) is logged as a run`, n === 1, n + " runs");
  }
  await g.goto(BASE + "?auto=0&scene=admin&prompt=complex"); await ready(g);
  const pol0 = (await data(g)).policy; await g.evaluate(() => App.setPolicy("bogus"));
  check("App.setPolicy ignores an unknown policy", (await data(g)).policy === pol0, (await data(g)).policy);
  await g.focus("#btnBack"); await g.evaluate(() => App.setPolicy("off"));
  check("App.setPolicy leaves keyboard focus where it was", (await data(g)).policy === "off" && await g.evaluate(() => document.activeElement.id) === "btnBack", await g.evaluate(() => document.activeElement.id || document.activeElement.tagName));
  await g.click('.opts [role="radio"]:nth-child(2)');
  check("clicking a policy option selects it and keeps focus on it", (await data(g)).policy === "frontier" && await g.evaluate(() => document.activeElement.dataset.value) === "frontier");
  await g.keyboard.press("ArrowDown");
  check("arrow keys move the policy radio and its focus", (await data(g)).policy === "off" && await g.evaluate(() => document.activeElement.dataset.value) === "off");
  // unknown scene and prompt ids are ignored: the scene stays and the render loop keeps running
  await g.goto(BASE + "?auto=0&scene=admin&prompt=complex"); await ready(g);
  const s0 = await data(g), f0 = await g.evaluate(() => App.world().frames);
  const thrown = await g.evaluate(() => [() => App.goTo("nope"), () => App.startRun("nope")].map(f => { try { f(); return ""; } catch (e) { return e.message; } }).filter(Boolean));
  const f1 = await g.evaluate(n => new Promise(res => { const t0 = performance.now(); (function poll() { const f = App.world().frames; if (f > n + 5 || performance.now() - t0 > 4000) res(f); else setTimeout(poll, 50); })(); }), f0);
  const s1 = await data(g);
  check("App.goTo / App.startRun ignore unknown ids, frames keep coming", !thrown.length && s1.scene === s0.scene && s1.phase === s0.phase && s1.prompt === s0.prompt && f1 > f0 + 5, thrown.join(" | ") + ` ${s1.scene}/${s1.phase} frames ${f0}→${f1}`);
  // a deep-linked run keeps the setting it was made with: a later policy change applies to the next run only
  await g.goto(BASE + "?auto=0&scene=admin&prompt=complex"); await ready(g);
  const r0 = (await data(g)).route; await g.evaluate(() => { App.setPolicy("off"); App.goTo("return"); });
  const r1 = (await data(g)).route;
  check("deep-linked run keeps its route after a policy change (complex → apiq)", r0 === "apiq" && r1 === "apiq", r0 + " → " + r1);
  // the same prompt run again announces its answer again (aria-live)
  await g.goto(BASE + "?auto=0&prompt=routine&scene=chat"); await ready(g);
  const said = await g.evaluate(() => {
    const out = [], ann = document.getElementById("announce"), run = () => { for (const s of ["send", "scan", "gauge", "route", "model", "return"]) App.goTo(s); out.push(ann.textContent); ann.textContent = ""; };
    run(); App.startRun("routine"); run(); return out;
  });
  check("a repeated run announces its answer again", said.length === 2 && said.every(Boolean), said.map(s => s.slice(0, 24) || "(empty)").join(" | "));
  // the link's setting is where a restart (R) starts again
  await g.goto(BASE + "?policy=off&auto=0"); await ready(g);
  await g.evaluate(() => App.setPolicy("frontier")); await g.keyboard.press("r");
  check("restart keeps the policy from the link (?policy=off)", (await data(g)).policy === "off" && (await data(g)).phase === "idle", (await data(g)).policy);
  await g.close();
  const rm = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await rm.goto(BASE + "?auto=0");
  const blink = await rm.evaluate(() => {
    const f = document.createElement("label"), o = document.createElement("output"); f.className = "field"; o.className = "caret"; f.appendChild(o); document.body.appendChild(f);
    const n = getComputedStyle(o, "::after").animationIterationCount; f.remove(); return n;
  });
  check("reduced motion stops the caret blink (pseudo-elements)", blink === "1", blink); await rm.close();
  }

  // 5) Zagłoba: same shell and engine, its own invariants (permissions, citations, abstention)
  if (want("zagloba")) { lap("zagloba: playthrough + collisions + access");
  const z = await open();
  await z.goto(ROOT_URL + "zagloba.html?auto=0&speed=4"); await ready(z);
  check("?auto=0 starts step by step", (await data(z)).auto === "false");
  // the page opens at the idle start, step by step, where the playthrough begins by pressing Start
  const zseen = await playthrough(z, "1", "Zagłoba ");
  check("Zagłoba playthrough (procedure question) reaches the summary", zseen.at(-1) === "final", zseen.join(">"));
  const zrun = await z.evaluate(() => App.state.runs[0]);
  check("Zagłoba: board document skipped and never cited", zrun && zrun.skipped.includes("limity") && !zrun.citations.includes("limity"));
  const zc = await z.evaluate(() => ZaglobaWorld.debugCollisions());
  check("Zagłoba: sheet never passes through scene geometry", zc.ok, (zc.hits || []).slice(0, 3).map(h => h.scene + "@" + h.t0 + " " + h.mesh).join(" | "));
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
  // the link's setting is where a restart (R) and the self-test start again; the self-test still runs every access value (once: it also proves the matrix)
  lap("zagloba: link setting + self-test + phone");
  await z.goto(ROOT_URL + "zagloba.html?access=board&auto=0"); await ready(z);
  await z.evaluate(() => App.setAccess(false)); await z.keyboard.press("r");
  check("Zagłoba: restart keeps the access from the link (?access=board)", (await data(z)).boardAccess === "true", (await data(z)).boardAccess);
  const zt2 = await z.evaluate(() => App.selfTest());
  check("Zagłoba self-test: questions × access × scenes", zt2.ok, zt2.failures.slice(0, 3).join(" | "));
  check("Zagłoba self-test from an ?access=board link passes and ends on it", zt2.ok && (await data(z)).boardAccess === "true" && (await data(z)).test === "pass", zt2.failures.slice(0, 3).join(" | "));
  const zm = await open({ viewport: { width: 390, height: 844 } });
  await zm.goto(ROOT_URL + "zagloba.html" + "?scene=admin&prompt=procedure"); await ready(zm);
  check("Zagłoba: no horizontal overflow at 390px", await noOverflow(zm));
  }
  lap("");

  const real = errors.filter(e => !/jsdelivr|ERR_FAILED|Failed to fetch dynamically/.test(e)); // the blocked CDN in step 4 is expected
  check("no console errors", real.length === 0, real.slice(0, 3).join(" | "));
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `\n${failures.length} failed` : "\nall passed");
process.exit(failures.length ? 1 : 0);
