# Klara od środka · Zagłoba od środka

Two interactive 3D walkthroughs built on one shared engine: **Klara** (`klara.html`) and **Zagłoba** (`zagloba.html`). The home page (`index.html`) lets the visitor pick one (keys `1`/`2`); the Quantica logo in each app leads back to it. Old `index.html?scene=…` deep links redirect to `klara.html`.

## Run

Open `index.html` (the home page), `klara.html` or `zagloba.html` directly, or serve the folder with `python3 -m http.server`. There is no build step. Three.js 0.180 loads from jsDelivr; without it (or without WebGL) the app switches to a schematic view and keeps working. Everything below applies to both apps.

**Start:** every simulation (on load, after `R` / *Od nowa* / *Zacznij od nowa*, and when the Auto loop ends) waits with the robot standing in the room; **Start** (button, `Space`, `Enter`, `→`) sends it to the computer to log in. Auto never leaves the start on its own and stays on when Start is pressed.

**Keys:** `→`/`N`/`Space`/`PageDown` next (the first press finishes the current animation), `←`/`PageUp` back, `1–4` pick a prompt in the chat (on the answer screen: start a new run with it), `Enter` send, `A` switches Auto ↔ Krok po kroku (the app **starts in Auto**, a kiosk-style loop; pressing a button or a navigation key switches to step by step, rotating the 3D view does not), `R` restart, `H`/`?` help, `F` fullscreen. Arrow keys move within a radio group (prompt chips, the admin setting). In the 3D view: drag to rotate, scroll to zoom, double-click to reset.

**URL parameters** (both apps):

- `?scene=<id>` opens a scene, shown finished and step by step; scenes after the chat need a `prompt`. Add `&play=1` to play it from its start instead.
- `?prompt=<id>` – Klara: `sensitive|routine|complex|attachment`; Zagłoba: `procedure|restricted|nodata|fresh`.
- The admin setting – Klara: `?policy=apiq|frontier|off`; Zagłoba: `?access=board` (access to the board folder granted). A restart (`R` / *Od nowa* / *Zacznij od nowa*) and the self-test start from it again; a deep-linked run (`?scene=…&prompt=…`) keeps the setting it opened with when the setting is changed later (the change applies to the next run).
- `?auto=0` (start step by step) · `?auto=1` (Auto even with a deep link) · `?speed=0.25–4` (animation speed, clamped) · `?selftest=1` (starts step by step and runs the self-test once the renderer is ready; the result lands in `data-test`).

## Klara od środka (`klara.html`)

An interactive 3D walkthrough of **Klara – bezpieczny (i inteligentny) chat AI**, seen from the user's side and then from inside the server. Visually it matches the *Explore the Floor* sales demo (`../oferta`): the same isometric voxel world, the same robot and the same Quantica Lab tokens.

### The journey (10 scenes)

| # | Scene | What happens |
|---|---|---|
| 01 | Pulpit i logowanie | The robot walks to its desk. The monitor shows its desktop; the Klara icon opens a window and the robot logs in with an organisation account. |
| 02 | Okno czatu | The Klara chat inside the desktop window. Pick one of 4 prompts: protected data / routine / complex / **attachment with company data**. |
| 03 | Wysyłka | The prompt becomes a glowing packet that rides the cable to the **Quantica AI Server**. |
| 04 | Skaner | The rack opens. The sheet passes through an **X-ray tunnel**; a preview monitor above the rack shows the message and the **attachment pages** side by side – protected fragments flash red, then turn into black redaction bars with tokens. |
| 05 | Złożoność | A gauge rates task complexity. |
| 06 | Zwrotnica i reguły | A **rules board** evaluates 3 rules one by one (protected data → complexity → policy) with lamps; barriers + padlocks close external exits; the chosen track lights green, blocked ones red. |
| 07 | Model | Local route: a **cabinet of GPU servers** (one local model each) – the chosen server slides out and takes the sheet in. External: out through *Wyjście z organizacji* to the Quantica APIQ / Frontier API cloud. |
| 08 | Odpowiedź | The answer travels back to the chat, labelled with the model that handled it. |
| 09 | Panel organizacji | Admin dashboard: usage per route, the fixed data-protection rule, a policy for complex tasks (APIQ / Frontier / local only) and a re-run button. |
| 10 | Podsumowanie | Your runs and the four benefits, plus a link to the product page. |

Inside the server, **explanation callouts** are anchored to the stations (X-ray monitor, scanner, gauge, switch, local model, exit gate, clouds) and fill in step by step, so the explanation lives in the 3D scene, not only in the side panel. Prompt 4 shows that Klara reads attachments: the prompt text is harmless and complex (it would go external), but the attachment's confidential content keeps it local.

## Zagłoba od środka (`zagloba.html`)

The journey of a question through **Zagłoba – inteligentny asystent wiedzy** (RAG). Same office, robot, desktop and Quantica AI Server, different stations inside:

| # | Scene | What happens |
|---|---|---|
| 01 | Pulpit i logowanie | Login with an organisation account – the user's role and access rights come with it. |
| 02 | Pytanie | 4 questions: procedure · restricted access · no coverage · a document changed yesterday. |
| 03 | Wysyłka | The question rides the cable to the server; Zagłoba can run fully on-premise. |
| 04 | Wyszukiwanie | Hybrid search over the knowledge index (shelves synced with SharePoint, OneDrive, Amazon S3): keyword highlights on the sheet, beams to the candidate documents. For question 4 the changed document first arrives through the SharePoint sync pipe. |
| 05 | Uprawnienia | A badge gate checks every candidate; a document from the board folder is stopped, locked and dropped into the "skipped" tray. |
| 06 | Trafność | Re-ranking: the most relevant documents climb a podium (top 3), weak ones fade. |
| 07 | Model | The local model (GPU server cabinet) answers only from the selected fragments – or abstains when the base has no coverage and names the right source. |
| 08 | Odpowiedź | The answer in the chat with citation cards [1] [2] … |
| 09 | Panel | Data sources with background sync, and the user's access to the board folder – grant it and ask question 2 again. |
| 10 | Podsumowanie | Runs and the five benefits from the product page. |

Invariant: a document the user cannot read is never cited (`tests/zagloba.cjs` + `App.probe`).

## Files

- `world-core.js` – the shared 3D engine (rooms, the employee's desk and admin console, robots, server shell, rack-top monitor mount, cable, sheet, clouds, GPU cabinet, labels, callouts, camera, collision probe). Each product furnishes its own office (`buildOffice`, `config.office` windows/rug, office colour tokens in its shell): Klara is a cool open space with a desk pod, coffee point and an orange lounge; Zagłoba a warm knowledge office with bookcases, a file cabinet and a reading table.
- `app-core.js` + `app.css` – the shared app shell (state machine, stepper, panel, desktop and chat, Auto / Krok po kroku, DOM contract, probe, self-test).
- `klara-stations.js`, `klara-app.js` / `zagloba-stations.js`, `zagloba-app.js` – each product's stations and content; the app file declares the product's one admin setting (URL parameter, `App.*` setter, `data-*` attribute, self-test matrix) and its contract and probe hooks.
- `zagloba-data.js` – sources, documents, questions and the pure `decide(question, settings)` (permissions, re-ranking, abstention).
- `klara-data.js` – scenes, prompts (incl. an attachment), routes, `protectedItems()` and the pure `decide(prompt, policy)`. Invariant: protected data, in the prompt or an attachment, is never routed externally.
- `index.html` – the home page (`#home` gets `data-ready="true"` once its script has run): a choice between the two journeys, each shown as a still of its 3D server interior (`assets/home/klara.webp` = `klara.html?scene=route&prompt=sensitive`, `assets/home/zagloba.webp` = `zagloba.html?scene=rank&prompt=procedure`; `#stage` captured at 2× with labels hidden, saved as 1600 px WebP).
- `klara.html` / `zagloba.html` – each product's shell with its accent and world tokens (`--world-*` drive the 3D colours).
- `assets/brand/` – favicon and the Quantica logo; `assets/home/` – the two home page stills.
- `tests/` – `harness.cjs` (sandbox loader, `test()`, the em-dash scan over every shipped text file, run from `route.cjs`), `route.cjs` (Klara's routing), `zagloba.cjs` (Zagłoba's retrieval), `browser.mjs` (headless Chrome: home page, both apps, self-tests, keyboard playthroughs, phone width, the schematic fallback; `--only=` sections), `quick.sh` (the quick tier).

## Verify

Two tiers. Pick the smallest that covers the change: a text, style or one-product tweak rarely needs the full suite.

```sh
export PLAYWRIGHT_MODULE=/abs/path/playwright/index.mjs CHROME_PATH=/usr/bin/google-chrome
tests/quick.sh                                  # ~30 s: syntax, Node tests, browser smoke (both apps load, wait at Start, Start moves the robot)
node tests/browser.mjs                          # full suite, prints the time per section
node tests/browser.mjs --only=klara             # one area: home, klara, zagloba (comma-separated), or smoke
```

The browser suite serves three.js and the fonts from `tests/.cache/` (filled on the first run, git-ignored), so it needs the network only once. Playthroughs run at `?speed=4`; only Auto's first scene runs in real time.

**DOM contract** on `#app` (both apps): `data-scene`, `data-phase` (`idle` at the start, then `playing` / `done`), `data-prompt`, `data-packet` (expected packet location, `moving` while a scene plays), `data-world-packet` (actual, from the 3D world) and `data-world-robot` (`waiting` / `walking` / `desk`; both only with WebGL), `data-auto` (`true` / `false`), `data-renderer` (`loading` / `webgl` / `fallback`), `data-runs` (runs logged), `data-reached` (furthest scene index unlocked in the stepper), and after a self-test `data-test` (`pass` / `fail`) with `data-test-detail`. Product-specific: Klara `data-route` (`local` / `apiq` / `frontier`) and `data-policy`; Zagłoba `data-board-access` (`true` / `false`), `data-outcome` (`answer` / `nodata`), `data-cited` and `data-skipped` (document ids, comma-separated).

**`App` API:** `App.start()` presses Start, `App.next()` / `App.back()`, `App.goTo(sceneId)` (shown finished), `App.startRun(promptId)` (both ignore an unknown id), `App.restart()`, `App.setSettings(patch)`, the product's setter (`App.setPolicy(id)` / `App.setAccess(bool)`; an unknown value is ignored, keyboard focus stays where it is), `App.probe()`, `App.selfTest()`, `App.snapshot()`, `App.world()` and `App.state`. `App.probe()` checks the idle start, stepper, privacy / permission, routing, masking, flow and world invariants; *Pomoc → Diagnostyka demo* runs the same probe. `App.selfTest()` runs every prompt × setting through every scene and ends at the idle start.

All people, numbers and the company (Falkarton Sp. z o.o.) are fictional. The simulation never calls real models. Product statements follow https://quanticalab.ai/klara_website.html and https://quanticalab.ai/zagloba_website.html.
