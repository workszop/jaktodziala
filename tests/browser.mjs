// Headless browser checks for both apps (Klara: index.html, Zagłoba: zagloba.html): WebGL self-test over every prompt × policy × scene, a real-time
// keyboard playthrough, phone-width overflow and the CDN-blocked schematic fallback.
// Run: PLAYWRIGHT_MODULE=/abs/path/to/playwright/index.mjs CHROME_PATH=/usr/bin/google-chrome node tests/browser.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".css": "text/css" };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  try { const body = await readFile(join(ROOT, path || "index.html")); res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise(r => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [], failures = [];
const check = (name, ok, detail = "") => { console.log((ok ? "ok  " : "FAIL") + " " + name + (detail ? " – " + detail : "")); if (!ok) failures.push(name); };
const watch = p => { p.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); p.on("pageerror", e => errors.push(e.message)); return p; };
const data = p => p.evaluate(() => ({ ...document.getElementById("app").dataset }));
const ready = (p, r = "webgl") => p.waitForFunction(want => document.getElementById("app").dataset.renderer === want, r, { timeout: 25000 });

try {
  // 1) WebGL self-test
  const page = watch(await browser.newPage({ viewport: { width: 1440, height: 860 } }));
  await page.goto(BASE); await ready(page);
  // default mode: Auto, advancing without input; dragging the 3D view keeps it; the switch goes to step by step
  check("starts in Auto mode", (await data(page)).auto === "true");
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
  await page.waitForFunction(() => document.getElementById("app").dataset.phase === "done", null, { timeout: 45000 });
  const seen = [];
  for (let i = 0; i < 14; i++) {
    const d = await data(page); seen.push(d.scene);
    if (d.packet !== "moving" && d.worldPacket !== d.packet) check("world packet at " + d.scene, false, d.worldPacket + " ≠ " + d.packet);
    if (d.scene === "final") break;
    if (d.scene === "chat") { await page.keyboard.press("1"); await page.keyboard.press("Enter"); } else await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.getElementById("app").dataset.phase === "done", null, { timeout: 45000 });
    const pr = await page.evaluate(() => App.probe()); if (!pr.ok) check("probe at " + pr.scene, false, pr.failures.join(","));
  }
  check("playthrough reaches the summary", seen.at(-1) === "final", seen.join(">"));
  check("one run recorded, routed locally", (await data(page)).runs === "1" && (await page.evaluate(() => App.state.runs[0].target)) === "local");

  // 3) phone width
  const m = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
  await m.goto(BASE + "?scene=admin&prompt=complex"); await ready(m);
  check("no horizontal overflow at 390px", await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  // 4) schematic fallback without the 3D library
  const f = watch(await browser.newPage({ viewport: { width: 1280, height: 800 } }));
  await f.route(/cdn\.jsdelivr\.net/, r => r.abort());
  await f.goto(BASE + "?scene=route&prompt=sensitive&policy=frontier"); await ready(f, "fallback");
  const fp = await f.evaluate(() => App.probe());
  check("fallback probe (privacy + flow contract)", fp.ok, fp.failures.join(","));
  check("fallback blocks external routes", await f.evaluate(() => ["apiq", "frontier"].every(r => document.querySelector(`#flowBig [data-node="${r}"]`).dataset.state === "blocked")));

  // 5) Zagłoba: same shell and engine, its own invariants (permissions, citations, abstention)
  const z = watch(await browser.newPage({ viewport: { width: 1440, height: 860 } }));
  await z.goto(BASE.replace("index.html", "zagloba.html") + "?auto=0"); await ready(z);
  const zt = await z.evaluate(() => App.selfTest());
  check("Zagłoba self-test: questions × access × scenes", zt.ok, zt.failures.slice(0, 3).join(" | "));
  const zc = await z.evaluate(() => ZaglobaWorld.debugCollisions());
  check("Zagłoba: sheet never passes through scene geometry", zc.ok, (zc.hits || []).slice(0, 3).map(h => h.scene + "@" + h.t0 + " " + h.mesh).join(" | "));
  await z.evaluate(() => App.restart()); await z.keyboard.press("ArrowRight"); await z.waitForTimeout(100);
  await z.waitForFunction(() => document.getElementById("app").dataset.phase === "done", null, { timeout: 45000 });
  const zseen = [];
  for (let i = 0; i < 14; i++) {
    const d = await data(z); zseen.push(d.scene); if (d.scene === "final") break;
    if (d.scene === "chat") { await z.keyboard.press("2"); await z.keyboard.press("Enter"); } else await z.keyboard.press("ArrowRight");
    await z.waitForFunction(() => document.getElementById("app").dataset.phase === "done", null, { timeout: 45000 });
    const pr = await z.evaluate(() => App.probe()); if (!pr.ok) check("Zagłoba probe at " + pr.scene, false, pr.failures.join(","));
  }
  check("Zagłoba playthrough (restricted question) reaches the summary", zseen.at(-1) === "final", zseen.join(">"));
  const zrun = await z.evaluate(() => App.state.runs[0]);
  check("Zagłoba: board document skipped and never cited", zrun && zrun.skipped.includes("budzet") && !zrun.citations.includes("budzet"));
  const zm = watch(await browser.newPage({ viewport: { width: 390, height: 844 } }));
  await zm.goto(BASE.replace("index.html", "zagloba.html") + "?scene=admin&prompt=restricted"); await ready(zm);
  check("Zagłoba: no horizontal overflow at 390px", await zm.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  const real = errors.filter(e => !/jsdelivr|ERR_FAILED|Failed to fetch dynamically/.test(e)); // the blocked CDN in step 4 is expected
  check("no console errors", real.length === 0, real.slice(0, 3).join(" | "));
} finally {
  await browser.close(); server.close();
}
console.log(failures.length ? `\n${failures.length} failed` : "\nall passed");
process.exit(failures.length ? 1 : 0);
