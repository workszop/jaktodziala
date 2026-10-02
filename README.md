# Klara od środka

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

Open `index.html` directly, or serve the folder with `python3 -m http.server`. There is no build step. Three.js 0.180 loads from jsDelivr; without it (or without WebGL) the demo switches to a schematic view and keeps working.

**Keys:** `→`/`N`/`Space` next (the first press finishes the current animation), `←` back, `1–4` pick a prompt, `Enter` send, `A` autoplay (kiosk loop; any touch takes over), `R` restart, `H` help, `F` fullscreen. In the 3D view: drag to rotate, scroll to zoom, double-click to reset.

**URL parameters:** `?auto=1` · `?scene=<id>&prompt=sensitive|routine|complex&policy=apiq|frontier|off` · `?speed=0.5–4` · `?selftest=1`.

## Files

- `klara-data.js` – scenes, prompts (incl. an attachment), routes, `protectedItems()` and the pure `decide(prompt, policy)`. Invariant: protected data, in the prompt or an attachment, is never routed externally.
- `klara-world.js` – the Three.js diorama. World state is a pure function of `{sceneId, t, prompt, decision}`, so back-navigation and skipping are deterministic.
- `klara-app.js` – the scene state machine, narration panel, in-world screens, admin panel and autoplay.
- `index.html` – the shell and all CSS tokens (`--world-*` drive the 3D colours).

## Verify

```sh
node tests/route.cjs
PLAYWRIGHT_MODULE=/abs/path/playwright/index.mjs CHROME_PATH=/usr/bin/google-chrome node tests/browser.mjs
```

The DOM contract lives on `#app`: `data-scene`, `data-phase`, `data-prompt`, `data-route`, `data-policy`, `data-packet` (expected) and `data-world-packet` (actual, from the 3D world). `App.probe()` checks the privacy, routing, masking, flow and world invariants; *Pomoc → Diagnostyka demo* runs the same probe.

All people, numbers and the company (Falkarton Sp. z o.o.) are fictional. The simulation never calls real models. Product statements follow https://quanticalab.ai/klara_website.html.
