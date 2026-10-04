# Klara od środka · Zagłoba od środka

Two interactive 3D walkthroughs built on one shared engine: **Klara** (`klara.html`) and **Zagłoba** (`zagloba.html`). The home page (`index.html`) lets the visitor pick one (keys `1`/`2`); the Quantica logo in each app leads back to it. Old `index.html?scene=…` deep links redirect to `klara.html`.

## Klara od środka

An interactive 3D walkthrough of **Klara – bezpieczny (i inteligentny) chat AI**, seen from the user's side and then from inside the server. Visually it matches the *Explore the Floor* sales demo (`../oferta`): the same isometric voxel world, the same robot and the same Quantica Lab tokens.

## The journey (10 scenes)

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

## Run

Open `index.html` (the home page) or `klara.html` directly, or serve the folder with `python3 -m http.server`. There is no build step. Three.js 0.180 loads from jsDelivr; without it (or without WebGL) the demo switches to a schematic view and keeps working.

**Keys:** `→`/`N`/`Space` next (the first press finishes the current animation), `←` back, `1–4` pick a prompt, `Enter` send, `A` switches Auto ↔ Krok po kroku (the app **starts in Auto**, a kiosk-style loop; pressing a button or a navigation key switches to step by step, rotating the 3D view does not), `R` restart, `H` help, `F` fullscreen. In the 3D view: drag to rotate, scroll to zoom, double-click to reset.

**URL parameters:** `?auto=0` (start step by step) · `?auto=1` · `?scene=<id>&prompt=sensitive|routine|complex&policy=apiq|frontier|off` · `?speed=0.5–4` · `?selftest=1`.

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
- `klara-stations.js`, `klara-app.js` / `zagloba-stations.js`, `zagloba-app.js` – each product's stations and content.
- `zagloba-data.js` – sources, documents, questions and the pure `decide(question, settings)` (permissions, re-ranking, abstention).
- `klara-data.js` – scenes, prompts (incl. an attachment), routes, `protectedItems()` and the pure `decide(prompt, policy)`. Invariant: protected data, in the prompt or an attachment, is never routed externally.
- `index.html` – the home page: a choice between the two journeys, each shown as a still of its 3D server interior (`assets/home/klara.webp` = `klara.html?scene=route&prompt=sensitive`, `assets/home/zagloba.webp` = `zagloba.html?scene=rank&prompt=procedure`; `#stage` captured at 2× with labels hidden, saved as 1600 px WebP).
- `klara.html` / `zagloba.html` – each product's shell with its accent and world tokens (`--world-*` drive the 3D colours).

## Verify

```sh
node tests/route.cjs
node tests/zagloba.cjs
PLAYWRIGHT_MODULE=/abs/path/playwright/index.mjs CHROME_PATH=/usr/bin/google-chrome node tests/browser.mjs
```

The DOM contract lives on `#app`: `data-scene`, `data-phase`, `data-prompt`, `data-route`, `data-policy`, `data-packet` (expected) and `data-world-packet` (actual, from the 3D world). `App.probe()` checks the privacy, routing, masking, flow and world invariants; *Pomoc → Diagnostyka demo* runs the same probe.

All people, numbers and the company (Falkarton Sp. z o.o.) are fictional. The simulation never calls real models. Product statements follow https://quanticalab.ai/klara_website.html.
