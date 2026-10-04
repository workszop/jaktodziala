/* Klara od środka – stations inside the Quantica AI Server for the shared world engine (world-core.js):
   X-ray tunnel + preview monitor, complexity gauge, switch with organisation rules, barriers on external ports,
   GPU server cabinet (local models), exits to Quantica APIQ / Frontier API. */
window.KlaraStations = {
  config: {
    sceneOrder: ["login", "chat", "send", "scan", "gauge", "route", "model", "return", "admin", "final"],
    openScene: "scan",
    travelScenes: ["scan", "gauge", "route", "model"],
    colorKeys: ["providerA", "providerB", "providerC", "gaugeLow", "gaugeMid", "gaugeHigh", "xrayShell", "sofa", "counter"],
    // open-space office: a high strip of windows, a rug under the lounge
    office: { windows: { count: 4, w: 1.4, h: 0.36, y: 0.62 }, rug: [4.15, 4.6, 2.3, 1.8] },
    ports: [10.9, 11.5],
    clouds: [
      { key: "apiq", pos: [9.3, 3.1, -2.7], ring: "brand", emblem: "q" },
      { key: "frontier", pos: [13.2, 3.1, -2.7], ring: "admin", emblem: "cubes", cubes: ["providerA", "providerB", "providerC"] }
    ],
    shots: {
      scan: { target: [9.3, 1.05, 2.3], span: 2.75, angle: 0.4, elev: 0.42 },
      gauge: { target: [10.05, 0.55, 2.7], span: 2.3, angle: 0.42, elev: 0.6 },
      route: { target: [11.2, 0.75, 2.45], span: 3.4, angle: 0.5, elev: 0.66 }
    },
    labels: [
      { id: "monitor", text: "Podgląd skanu", color: "scan", pos: [9.18, 2.13, 1.74], scenes: ["scan", "gauge"] },
      { id: "scan", text: "Skaner rentgenowy", color: "scan", pos: [9.2, 1.06, 2.8], scenes: ["scan"] },
      { id: "gauge", text: "Miernik złożoności", color: "accent", pos: [10.0, 1.18, 2.25], scenes: ["gauge"] },
      { id: "switch", text: "Zwrotnica", color: "accent", pos: [10.9, 0.8, 2.85], scenes: ["route"] },
      { id: "local", text: "Modele lokalne · serwery GPU", color: "ok", pos: [12.25, 1.22, 2.75], scenes: ["route", "model", "final"], route: "local" },
      { id: "gate", text: "Wyjście z organizacji", color: "ok", pos: [11.25, 1.1, 0.06], scenes: ["route", "model", "final"] },
      { id: "apiq", text: "Quantica APIQ", color: "brand", pos: [9.3, 3.95, -2.7], scenes: ["model", "final"], route: "apiq" },
      { id: "frontier", text: "Frontier API", color: "admin", pos: [13.2, 3.95, -2.7], scenes: ["model", "final"], route: "frontier" }
    ],
    // Callout anchors share ids with labels: an active callout replaces the plain label.
    anchors: {
      monitor: [8.6, 1.74, 1.94], scan: [9.2, 0.9, 3.3], gauge: [10.27, 0.76, 2.34], switch: [10.9, 0.4, 2.8],
      gate: [11.25, 0.7, 0.06], apiq: [9.3, 3.5, -2.7], frontier: [13.2, 3.5, -2.7]
    },
    ariaLabel: "Świat 3D: biuro, kabel do serwerowni, Quantica AI Server i modele zewnętrzne. Przeciągnij, aby obrócić; kółko przybliża; dwuklik resetuje widok."
  },

  create(k) {
    "use strict";
    // ─── Constants ───
    const { THREE, G, colors, refs, paths, info, font } = k;
    const { box, cylinder, sphere, group, strip, own, makePath, fakeText, seeded, paintMark } = k;
    const { clamp, phase, ease, easeOutBack, lerp, order } = k;
    const { FLOOR, RIDE, PORT_Z, GATE, LOCAL_TURN } = G;
    const K = window.KlaraData, CFG = window.KlaraStations.config;
    const SCAN = [9.2, RIDE, 2.8], GAUGE = [10.0, RIDE, 2.8], SWITCH = [10.9, RIDE, 2.8], INLET = G.INLET;
    const PORT_X = { apiq: CFG.ports[0], frontier: CFG.ports[1] };
    const CLOUD = Object.fromEntries(CFG.clouds.map(c => [c.key, c.pos]));
    // Rails out of the switch, per route (the local ones belong to the engine's GPU bay); lit tracks run along them.
    const RAILS = { local: G.LOCAL_RAILS, apiq: [[[10.9, 2.58], [10.9, 1.82]]], frontier: [[[11.05, 2.65], [11.5, 2.2]], [[11.5, 2.2], [11.5, 1.82]]] };
    const ARROW_ANGLE = { local: Math.atan2(-(LOCAL_TURN[1] - 2.8), LOCAL_TURN[0] - 10.9), apiq: Math.PI / 2, frontier: Math.PI / 4, neutral: -Math.PI / 2 };
    const NEEDLE_REST = 1.15;
    const RULE_TEXT = ["Dane chronione (także w załącznikach) → tylko model lokalny", "Zadanie proste lub standardowe → model lokalny", "Zadanie złożone → model zewnętrzny wg polityki"];
    const RULE_HIT = ["danger", "ok", "accent"];
    const PAGE_FLAGS = [[0, 2], [1], [3]];
    Object.assign(info, { arrow: "neutral", barriers: "up", rules: "", scanView: "idle" });

    // ─── Build: stations ───
    function buildXrayTunnel() {
      const x = SCAN[0], L = 0.9, z0 = 2.31, z1 = 3.29, base = FLOOR + 0.12, top = 0.82;
      box(x, (z0 + z1) / 2, L, z1 - z0, 0.1, "xrayShell", top, undefined, 0.04);
      for (const z of [z0 + 0.03, z1 - 0.03]) box(x, z, L, 0.06, top - base, "xrayShell", base);
      refs.tunnelMat = own("scan", { emissive: colors.scan, emissiveIntensity: 0.1 });
      box(x, 2.8, L - 0.14, 0.3, 0.02, refs.tunnelMat, top - 0.02);
      const curtain = own("ink", { transparent: true, opacity: 0.5 });
      for (const cx of [x - L / 2 - 0.02, x + L / 2 + 0.02]) for (let z = z0 + 0.11; z < z1 - 0.08; z += 0.12) {
        const s = box(cx, z, 0.012, 0.1, 0.4, curtain, top - 0.4); s.castShadow = false;
        s.userData.noCollide = true; // flexible strips the sheet pushes through
      }
      refs.beaconMat = own("scan", { emissive: colors.scan, emissiveIntensity: 0 });
      cylinder(x + 0.3, 3.1, 0.04, 0.06, refs.beaconMat, top + 0.1);
    }
    // What the X-ray preview monitor (above the back panel) shows: the message on the left, attachments on the right;
    // view = idle | scanning | found | masked | clear.
    function drawXray(c, st) {
      const line = colors.xrayLine, red = colors.danger, ink = colors.ink, paper = colors.paper, ok = colors.ok;
      const pane = (x, title) => { c.strokeStyle = line; c.globalAlpha = 0.35; c.lineWidth = 2; c.strokeRect(x, 84, 466, 420); c.globalAlpha = 1; c.fillStyle = line; c.font = font(700, 22, true); c.fillText(title, x + 16, 116); };
      pane(30, "WIADOMOŚĆ"); pane(528, "ZAŁĄCZNIK");
      if (st.view === "idle") { c.fillStyle = line; c.globalAlpha = 0.6; c.font = font(500, 24, true); c.fillText("oczekiwanie na polecenie…", 46, 560); c.globalAlpha = 1; return; }
      const tagBar = (x, y, w, item, state) => {
        if (state === "masked") { c.fillStyle = ink; c.fillRect(x - 4, y - 13, Math.max(w, 120) + 8, 26); c.fillStyle = paper; c.font = font(700, 17, true); c.fillText(item.token, x + 4, y + 6); }
        else if (state === "found") { c.fillStyle = red; c.globalAlpha = 0.75; c.fillRect(x - 4, y - 11, w + 8, 22); c.globalAlpha = 1; c.strokeStyle = red; c.lineWidth = 3; c.strokeRect(x - 9, y - 16, w + 18, 32); }
      };
      c.strokeStyle = line; c.lineWidth = 3; c.strokeRect(150, 140, 226, 340);
      c.fillStyle = line; c.globalAlpha = 0.5; const rows = fakeText(c, 170, 190, 186, 8, 36, 9, seeded(7)); c.globalAlpha = 1;
      (st.msg || []).forEach((item, i) => { const r = rows[[1, 3, 5][i]]; if (r) tagBar(r.words[0][0], r.y, r.words[0][1] - r.words[0][0], item, st.msgState); });
      if (!st.att) { c.fillStyle = line; c.globalAlpha = 0.6; c.font = font(500, 24, true); c.fillText("brak załączników", 640, 300); c.globalAlpha = 1; }
      else {
        c.fillStyle = line; c.font = font(500, 18, true); c.fillText(st.att.name, 546, 148);
        const items = st.att.items; let n = 0;
        PAGE_FLAGS.forEach((flags, pIdx) => {
          const px = 552 + pIdx * 148, py = 170;
          c.strokeStyle = line; c.lineWidth = 2; c.strokeRect(px, py, 128, 176);
          c.fillStyle = red; c.fillRect(px + 8, py + 8, 40, 18); c.fillStyle = paper; c.font = font(800, 12); c.fillText("PDF", px + 14, py + 22);
          if (st.attState === "reading" || st.attState === "found" || st.attState === "masked") {
            c.fillStyle = line; c.globalAlpha = 0.5; const pr = fakeText(c, px + 10, py + 46, 108, 4, 30, 7, seeded(31 + pIdx)); c.globalAlpha = 1;
            for (const f of flags) { const it = items[n++]; if (it && pr[f]) tagBar(pr[f].words[0][0], pr[f].y, Math.min(70, pr[f].words[0][1] - pr[f].words[0][0]), { token: it.token.length > 9 ? it.token.slice(0, 8) + "]" : it.token }, st.attState); }
          }
        });
        if (st.attState === "found" || st.attState === "masked") {
          c.font = font(600, 17, true); let y = 384;
          for (const it of items) { c.fillStyle = st.attState === "masked" ? line : red; c.fillText((st.attState === "masked" ? it.token + "  " : "! ") + it.kind, 552, y); y += 26; }
        }
      }
      const total = (st.msg || []).length + (st.att ? st.att.items.length : 0);
      const status = st.view === "scanning" ? ["skanowanie treści…", line] : st.view === "clear" ? ["brak danych chronionych – pakiet może wyjść, jeśli wymaga tego zadanie", ok]
        : st.view === "found" ? ["wykryto: " + total + " fragmenty chronione", red] : ["zamaskowano " + total + " fragmenty · zakaz wyjścia poza organizację", red];
      c.fillStyle = status[1]; c.font = font(700, 24, true); c.fillText(status[0], 46, 560);
    }
    function buildGaugeAndSwitch() {
      box(GAUGE[0], 2.3, 0.08, 0.08, 0.36, "metal", FLOOR + 0.12);
      const dial = group(GAUGE[0], 0.74, 2.32);
      const disc = cylinder(0, 0, 0.27, 0.04, "paper", -0.02, dial, 0.27, 32); disc.rotation.x = Math.PI / 2;
      const zones = [["gaugeLow", Math.PI / 2 + 0.33, 0.8], ["gaugeMid", Math.PI / 2 - 0.33, 0.66], ["gaugeHigh", Math.PI / 2 - 1.13, 0.8]];
      for (const [c, start, len] of zones) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.235, 24, 1, start, len), own(c, { side: THREE.DoubleSide })); ring.position.z = 0.022; dial.add(ring);
      }
      refs.needle = group(0, 0, 0.03, dial); box(0, 0, 0.022, 0.012, 0.21, "ink", 0, refs.needle); sphere(0, 0, 0.008, 0.03, "ink", dial);
      cylinder(SWITCH[0], SWITCH[2], 0.22, 0.1, "metal", FLOOR + 0.12, undefined, 0.22, 28);
      refs.arrow = group(SWITCH[0], FLOOR + 0.225, SWITCH[2]);
      box(0.06, 0, 0.24, 0.05, 0.02, "accent", 0, refs.arrow); const head = box(0.2, 0, 0.1, 0.1, 0.02, "accent", 0, refs.arrow); head.rotation.y = Math.PI / 4;
      // rails out of the switch to the external ports
      for (const [a, b] of [...RAILS.apiq, ...RAILS.frontier]) strip(a, b, 0.2, 0.04, "belt", FLOOR + 0.12);
      // barriers + padlocks on the external ports
      refs.barriers = {}; refs.locks = {};
      for (const key of ["apiq", "frontier"]) {
        const x = PORT_X[key];
        box(x + 0.25, 2.0, 0.04, 0.04, 0.5, "metal", FLOOR + 0.12);
        const pivot = group(x + 0.25, FLOOR + 0.56, 2.0); box(-0.24, 0, 0.5, 0.035, 0.035, "hazard", -0.017, pivot); refs.barriers[key] = pivot;
        const lock = k.padlock(x, FLOOR + 0.78, 2.0, "lockMetal"); lock.scale.setScalar(0.001); refs.locks[key] = lock;
      }
    }
    // Organisation rules on a board mounted above the rack's back panel; one lamp + row highlight per rule.
    function buildRulesBoard() {
      const { g, W, rowY } = k.rackBoard(10.75, "POLITYKA ORGANIZACJI · REGUŁY KIEROWANIA", RULE_TEXT, (c, txt, y, w, i) => {
        c.fillStyle = colors.paper; c.beginPath(); c.arc(70, y, 26, 0, Math.PI * 2); c.fill();
        c.fillStyle = colors.ink; c.font = font(700, 30); c.fillText(String(i + 1), 61, y + 11);
        c.fillStyle = colors.paper; c.font = font(500, 29); c.fillText(txt, 118, y + 10);
      });
      refs.ruleLamps = []; refs.ruleRows = [];
      for (let i = 0; i < RULE_TEXT.length; i++) {
        const y = rowY(i);
        const lamp = own("chipMasked", { emissive: colors.chipMasked, emissiveIntensity: 0 });
        sphere(W / 2 - 0.07, y, 0.06, 0.035, lamp, g); refs.ruleLamps.push(lamp);
        const row = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, 0.13), own("ok", { emissive: colors.ok, emissiveIntensity: 0.8, transparent: true, opacity: 0, depthWrite: false }));
        row.position.set(0, y, 0.035); g.add(row); refs.ruleRows.push(row.material);
      }
    }
    // Light strips on the rails: chosen route green, blocked routes red.
    function buildTracks() {
      refs.tracks = {};
      for (const key of Object.keys(RAILS)) {
        const m = own("ok", { emissive: colors.ok, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
        const meshes = RAILS[key].map(([a, b]) => { const st = strip(a, b, 0.05, 0.012, m, FLOOR + 0.161); st.castShadow = false; st.visible = false; return st; });
        refs.tracks[key] = { m, meshes };
      }
    }
    // ─── Office: open space – a desk pod, a coffee point, a whiteboard and a lounge corner ───
    function buildOffice() {
      for (const x of [4.4, 5.7]) { k.deskAt(x, 1.55, undefined, Math.PI); k.deskAt(x, 2.21); k.chair(x, 0.92, 0); k.chair(x, 2.86, Math.PI); }
      // coffee point along the back wall
      box(1.1, 0.38, 1.5, 0.45, 0.7, "counter", 0, undefined, 0.02); box(1.1, 0.38, 1.56, 0.48, 0.04, "wood", 0.7, undefined, 0.02);
      for (let i = 0; i < 3; i++) box(0.6 + i * 0.5, 0.605, 0.44, 0.01, 0.6, "edge", 0.05);
      box(0.62, 0.32, 0.26, 0.26, 0.36, "ink", 0.74, undefined, 0.03); box(0.62, 0.46, 0.1, 0.02, 0.05, "accent", 0.9);
      for (const [x, c] of [[0.98, "paper"], [1.12, "accent"], [1.26, "paper"]]) cylinder(x, 0.44, 0.035, 0.08, c, 0.74);
      // whiteboard on the left wall
      box(0.14, 1.45, 0.03, 1.3, 0.62, "metal", 0.36); box(0.16, 1.45, 0.02, 1.22, 0.54, "paper", 0.4);
      for (const [dz, y, w, c] of [[-0.3, 0.82, 0.4, "accent"], [-0.25, 0.7, 0.5, "admin"], [0.25, 0.78, 0.36, "ink"], [0.2, 0.62, 0.46, "accent"], [-0.2, 0.52, 0.3, "ink"]]) box(0.175, 1.45 + dz, 0.01, w, 0.025, c, y);
      // lounge corner in front of the pod: sofa facing the room, an armchair and a round coffee table
      const L = [3.45, 4.6];
      box(L[0], L[1], 0.6, 1.3, 0.2, "sofa", 0.1, undefined, 0.05); box(L[0] - 0.24, L[1], 0.14, 1.3, 0.56, "sofa", 0.06, undefined, 0.04);
      for (const dz of [-0.63, 0.63]) box(L[0], L[1] + dz, 0.6, 0.12, 0.4, "sofa", 0.06, undefined, 0.04);
      for (const dz of [-0.3, 0.3]) box(L[0] + 0.04, L[1] + dz, 0.44, 0.5, 0.08, "sofa", 0.3, undefined, 0.04);
      box(4.85, L[1], 0.56, 0.6, 0.2, "sofa", 0.1, undefined, 0.05); box(5.07, L[1], 0.14, 0.6, 0.5, "sofa", 0.06, undefined, 0.04);
      for (const dz of [-0.27, 0.27]) box(4.85, L[1] + dz, 0.56, 0.1, 0.36, "sofa", 0.06, undefined, 0.04);
      cylinder(4.15, L[1], 0.3, 0.04, "wood", 0.32, undefined, 0.3, 28); cylinder(4.15, L[1], 0.03, 0.32, "metal");
      cylinder(4.08, L[1] - 0.06, 0.035, 0.07, "accent", 0.36); box(4.22, L[1] + 0.08, 0.2, 0.14, 0.012, "paper", 0.36);
      k.plant(0.42, 2.6, 1.1); k.plant(7.1, 1.2, 0.8);
    }
    function build() {
      buildXrayTunnel(); buildGaugeAndSwitch();
      refs.blades = k.localBay();
      buildRulesBoard();
      refs.drawXray = k.rackScreen(SCAN[0] - 0.02, "PODGLĄD SKANU · RENTGEN TREŚCI", drawXray);
      k.plates([[9.2, "1", "SKANER", "scan"], [10.0, "2", "ZŁOŻONOŚĆ", "accent"], [10.9, "3", "ZWROTNICA", "admin"], [12.25, "4", "MODELE LOKALNE", "ok"]]);
      buildTracks();
    }

    // ─── Build: inner paths ───
    function buildPaths() {
      const inside = [INLET, SCAN, GAUGE, SWITCH];
      // an external route: from the switch `via` its port, through the exit gate, then up to the cloud `c`
      const exit = (via, c) => [{ line: [SWITCH, ...via, [11.25, RIDE, 0.9], GATE, [11.25, RIDE, -0.5]] },
        { curve: [[11.25, RIDE, -0.5], [11.25, 1.6, -0.9], [c[0], c[1] + 1.35, c[2] + 0.75], [c[0], c[1] + 0.82, c[2]]] }];
      const out = {
        local: k.localRoute(SWITCH),
        apiq: exit([[PORT_X.apiq, RIDE, PORT_Z], [PORT_X.apiq, RIDE, 1.3]], CLOUD.apiq),
        frontier: exit([[PORT_X.frontier, RIDE, 2.2], [PORT_X.frontier, RIDE, PORT_Z], [PORT_X.frontier, RIDE, 1.3]], CLOUD.frontier)
      };
      [paths.inlet2scan, paths.scan2gauge, paths.gauge2switch] = k.legs(inside);
      for (const key of Object.keys(out)) {
        paths[key] = makePath(out[key]); paths["back_" + key] = k.returnPath(out[key], inside);
        // fraction of the outbound path at which the packet crosses the exit gate
        if (key !== "local") { const pts = paths[key].getSpacedPoints(400); let best = 0, bd = 1e9; pts.forEach((p, i) => { const dd = Math.hypot(p.x - GATE[0], p.z - GATE[2]) + Math.abs(p.y - GATE[1]); if (dd < bd) { bd = dd; best = i; } }); paths[key].gateU = best / 400; }
      }
      refs.trails = {};
      for (const key of ["apiq", "frontier"]) {
        const m = own("accent", { emissive: colors.accent, emissiveIntensity: 1.1, transparent: true, opacity: 0.7 });
        const tr = new THREE.Mesh(new THREE.TubeGeometry(paths[key], 220, 0.018, 6, false), m); tr.visible = false; tr.userData.noCollide = true; k.world.add(tr);
        refs.trails[key] = { mesh: tr, count: tr.geometry.index.count };
      }
    }

    // ─── Pose ───
    function pose(s, dt, { o }) {
      const id = s.sceneId, t = s.t, d = s.decision;
      const promptCount = s.prompt ? s.prompt.sensitive.length : 0, total = d ? d.protectedCount : 0;
      const target = d ? d.target : "local", external = target !== "local";
      // X-ray tunnel glows while the sheet is inside; the monitor shows message + attachment findings
      const scanning = id === "scan" && t > 0.4 && t < 0.88;
      refs.tunnelMat.emissiveIntensity = scanning ? 1.3 + 0.4 * Math.sin(t * 80) : 0.1; refs.beaconMat.emissiveIntensity = scanning ? 1.6 : 0;
      const promptItems = s.prompt ? s.prompt.sensitive : [], attItems = s.prompt && s.prompt.attachment ? s.prompt.attachment.sensitive : [];
      // protected data: found by the scanner (message words, then the attachment's pages once read), then masked
      const past = o > order("scan"), inScan = id === "scan";
      const found = past || (inScan && t > 0.5), docRead = past || (inScan && t > 0.62), masked = past || (inScan && t > 0.72);
      let xv = "idle", msgState = "none", attState = "none";
      if ((inScan && t >= 0.4) || (past && o <= order("return"))) {
        msgState = masked ? "masked" : found ? "found" : "none";
        attState = masked ? "masked" : docRead ? "found" : found ? "reading" : "none";
        const any = promptItems.length + attItems.length > 0;
        xv = !past && t < 0.5 ? "scanning" : !any ? (masked ? "clear" : "scanning") : masked ? "masked" : "found";
      }
      refs.drawXray({ view: xv, msg: xv === "idle" ? [] : promptItems.map(i => ({ token: i.token })), msgState,
        att: s.prompt && s.prompt.attachment && xv !== "idle" ? { name: s.prompt.attachment.name, items: attItems.map(i => ({ token: i.token, kind: i.kind })) } : null, attState });
      info.scanView = xv;
      // gauge needle
      const level = d ? K.COMPLEXITY[d.level].needle : 0;
      let needle = NEEDLE_REST;
      if (id === "gauge") needle = NEEDLE_REST + (-level - NEEDLE_REST) * easeOutBack(phase(t, 0.3, 0.85));
      else if (o > order("gauge")) needle = -level;
      refs.needle.rotation.z = needle;
      // switch arrow + barriers + padlocks
      const arrowU = id === "route" ? easeOutBack(phase(t, 0.62, 0.84)) : o > order("route") ? 1 : 0;
      refs.arrow.rotation.y = lerp(ARROW_ANGLE.neutral, ARROW_ANGLE[target], arrowU);
      info.arrow = arrowU >= 1 ? target : "neutral";
      const barrierU = id === "route" ? ease(phase(t, 0.42, 0.62)) : o > order("route") ? 1 : 0;
      let barriersDown = 0;
      for (const key of ["apiq", "frontier"]) {
        const st = d ? d.states[key] : "faded", down = (st === "blocked" || st === "off") ? barrierU : 0;
        refs.barriers[key].rotation.z = (1 - down) * 1.45; if (down >= 1) barriersDown++;
        refs.locks[key].scale.setScalar(st === "blocked" ? Math.max(0.001, easeOutBack(barrierU)) : 0.001);
      }
      info.barriers = barriersDown ? "down" : "up";
      // sheet position inside the server and back
      const ride = id === "scan" ? k.ride(paths.inlet2scan, t, 0.3, 0.5, "scan") : id === "gauge" ? k.ride(paths.scan2gauge, t, 0, 0.3, "gauge")
        : id === "route" ? k.ride(paths.gauge2switch, t, 0, 0.15, "switch") : id === "model" ? k.ride(paths[target], t, 0, external ? 0.72 : 0.4, target)
        : id === "return" ? k.ride(paths["back_" + target], t, 0, 0.82, "desk", "answer") : null;
      for (const key of ["apiq", "frontier"]) {
        const tr = refs.trails[key], u = target !== key ? 0 : id === "model" ? ease(phase(t, 0, 0.72)) : id === "return" ? 1 - phase(t, 0.2, 0.6) : 0;
        tr.mesh.visible = u > 0; tr.mesh.geometry.setDrawRange(0, Math.floor(tr.count * u / 3) * 3);
      }
      // the chosen GPU server swallows the sheet (model) and hands back the answer (return)
      const scale = external ? 1 : k.swallowScale(id, t);
      // on the sheet: words light up red when the scanner finds them, then turn into black redaction bars
      const pulse = id === "scan" && t > 0.5 && t < 0.72 ? 0.5 * Math.abs(Math.sin(t * 60)) : 0;
      const state = show => (show ? (masked ? "masked" : "found") : "none");
      refs.msgMarks.forEach((mk, i) => paintMark(mk, state(found && i < promptCount), pulse));
      const attachments = s.prompt && s.prompt.attachment ? [s.prompt.attachment] : [];
      const attCount = Math.max(0, total - promptCount);
      refs.pdfs.forEach((pdf, i) => { pdf.g.visible = i < attachments.length; pdf.marks.forEach((mk, n) => paintMark(mk, state(docRead && n < attCount), pulse)); });
      info.attachments = Math.min(attachments.length, refs.pdfs.length);
      // rules board: lamps light one after another in the route scene
      const rules = Array.isArray(s.rules) ? s.rules : [];
      refs.ruleLamps.forEach((m, i) => {
        const shown = rules[i] && (o > order("route") || (id === "route" && t > 0.15 + i * 0.15));
        const st = shown ? rules[i] : "idle", c = colors[st === "hit" ? RULE_HIT[i] : st === "pass" ? "paper" : "chipMasked"];
        m.color.set(c); m.emissive.set(c); m.emissiveIntensity = st === "hit" ? 1.6 : st === "pass" ? 0.25 : 0;
        refs.ruleRows[i].opacity = st === "hit" ? 0.28 : 0; refs.ruleRows[i].color.set(colors[RULE_HIT[i]]); refs.ruleRows[i].emissive.set(colors[RULE_HIT[i]]);
      });
      info.rules = rules.map((r, i) => (refs.ruleRows[i].opacity > 0 ? "H" : r[0])).join("");
      // lit tracks once the switch has thrown
      const trackOn = (id === "route" && t > 0.8) || (o > order("route") && o <= order("return"));
      for (const key of ["local", "apiq", "frontier"]) {
        const st = d ? d.states[key] : "faded", tr = refs.tracks[key], lit = trackOn && (st === "on" || st === "blocked" || st === "off");
        tr.meshes.forEach(m => { m.visible = lit; }); if (lit) { const c = colors[st === "on" ? "ok" : "danger"]; tr.m.color.set(c); tr.m.emissive.set(c); }
      }
      // local model at work (only when the route stays local)
      k.poseCabinet(refs.blades, id, t, { active: !external });
      const gateU = id === "model" && external ? 1 - clamp(Math.abs(phase(t, 0, 0.72) - paths[target].gateU) * 9) : 0;
      refs.gateMat.emissiveIntensity = gateU * 1.4;
      for (const key of ["apiq", "frontier"]) refs.cloudMats[key].emissiveIntensity = (id === "model" && target === key ? phase(t, 0.72, 0.85) : id === "return" && target === key ? 1 - phase(t, 0, 0.3) : 0) * 1.5;
      return ride ? { ...ride, scale } : { node: "none" };
    }

    // ─── Camera, labels, diagnostics ───
    function shot(s, poseOut, follow, SHOTS) {
      const id = s.sceneId, t = s.t, ext = s.decision && s.decision.target !== "local";
      if (id === "scan") return t < 0.3 ? SHOTS.rackOut : SHOTS.scan;
      if (id === "gauge") return SHOTS.gauge;
      if (id === "route") return SHOTS.route;
      if (id === "model") {
        if (!ext) return SHOTS.gpu;
        const c = CLOUD[s.decision.target];
        return t > 0.72 ? { target: [(c[0] + GATE[0]) / 2, 2.0, -1.3], span: 5.8, angle: 0.62, elev: 0.5 } : follow(3.4);
      }
      return null;
    }
    function labelVisible(l, s) {
      const d = s.decision;
      if (l.route && s.sceneId === "model") return !!(d && d.target === l.route);
      if (l.id === "gate" && s.sceneId !== "final") return !!(d && d.target !== "local") || s.sceneId === "route";
      return true;
    }
    function labelState(l, s) {
      const d = s.decision, routeScenes = order(s.sceneId) >= order("route");
      if (!d || !routeScenes) return "";
      if (l.route) return d.states[l.route];
      if (l.id === "gate") return d.target === "local" ? d.states.apiq : "on";
      return "";
    }
    function collisionRuns() {
      return [["attachment", "apiq"], ["complex", "apiq"], ["complex", "frontier"], ["routine", "apiq"]].map(([pid, pol]) => {
        const prompt = K.promptById(pid); return { prompt, decision: K.decide(prompt, { external: pol }), label: pid + "/" + pol };
      });
    }
    return {
      buildOffice, build, buildPaths, pose, shot, labelVisible, labelState, collisionRuns,
      sig: s => (s.decision ? s.decision.target + s.decision.states.apiq : ""),
      animating: s => s.sceneId === "model" || s.sceneId === "return"
    };
  }
};
