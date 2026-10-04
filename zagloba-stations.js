/* Zagłoba od środka – stations inside the Quantica AI Server for the shared world engine (world-core.js):
   knowledge index (shelves of document cards), hybrid search, access gate, relevance podium, GPU server cabinet
   (local model), results monitor, connectors board and sync pipes from SharePoint / OneDrive / Amazon S3. */
window.ZaglobaStations = {
  config: {
    sceneOrder: ["login", "chat", "send", "search", "access", "rank", "model", "return", "admin", "final"],
    openScene: "search",
    travelScenes: ["search", "access", "rank", "model"],
    colorKeys: ["srcA", "srcB", "srcC", "podium", "tube", "lockRed", "cabinet", "lampShade", "shelf"],
    // library-like office: three tall windows, a rug under the reading table
    office: { windows: { count: 3, w: 1.55, h: 0.56, y: 0.4 }, rug: [5.0, 2.1, 2.5, 2.1] },
    ports: [9.2],
    clouds: [
      { key: "sharepoint", pos: [9.0, 3.1, -2.7], ring: "srcA", emblem: "docs" },
      { key: "onedrive", pos: [11.25, 3.45, -3.1], ring: "srcB", emblem: "docs" },
      { key: "s3", pos: [13.5, 3.1, -2.7], ring: "srcC", emblem: "docs" }
    ],
    shots: {
      search: { target: [9.3, 0.95, 2.3], span: 2.9, angle: 0.4, elev: 0.46 },
      access: { target: [10.0, 0.6, 2.75], span: 2.5, angle: 0.45, elev: 0.55 },
      rank: { target: [10.85, 0.62, 2.6], span: 2.4, angle: 0.42, elev: 0.5 },
      sources: { target: [10.9, 2.2, -1.5], span: 5.4, angle: 0.5, elev: 0.3 }
    },
    labels: [
      { id: "monitor", text: "Podgląd wyszukiwania", color: "accent", pos: [9.18, 2.13, 1.74], scenes: ["search", "access", "rank"] },
      { id: "index", text: "Baza wiedzy · indeks", color: "srcA", pos: [9.2, 1.1, 2.0], scenes: ["search"] },
      { id: "gate", text: "Kontrola uprawnień", color: "admin", pos: [10.05, 1.08, 2.7], scenes: ["access"] },
      { id: "skipped", text: "Pominięte · brak uprawnień", color: "lockRed", pos: [9.95, 0.6, 3.45], scenes: ["access", "rank"] },
      { id: "podium", text: "Ocena trafności", color: "accent", pos: [10.9, 0.95, 2.3], scenes: ["rank"] },
      { id: "local", text: "Model lokalny · serwery GPU", color: "ok", pos: [12.25, 1.22, 2.75], scenes: ["model", "final"] },
      { id: "connectors", text: "Konektory źródeł", color: "admin", pos: [10.75, 1.86, 1.72], scenes: ["admin", "final"] },
      { id: "sharepoint", text: "SharePoint", color: "srcA", pos: [9.0, 3.95, -2.7], scenes: ["send", "admin", "final"] },
      { id: "onedrive", text: "OneDrive", color: "srcB", pos: [11.25, 4.3, -3.1], scenes: ["send", "admin", "final"] },
      { id: "s3", text: "Amazon S3", color: "srcC", pos: [13.5, 3.95, -2.7], scenes: ["send", "admin", "final"] }
    ],
    anchors: {
      search: [9.2, 0.75, 3.1], gate: [10.05, 0.9, 3.2], podium: [11.2, 0.75, 2.3]
    },
    ariaLabel: "Świat 3D: biuro, kabel do serwerowni, Quantica AI Server z bazą wiedzy i źródła danych organizacji. Przeciągnij, aby obrócić; kółko przybliża; dwuklik resetuje widok."
  },

  create(k) {
    "use strict";
    // ─── Constants ───
    const { THREE, G, colors, refs, paths, info, font } = k;
    const { box, cylinder, sphere, group, own, canvasTexture, makePath, fakeText, seeded, paintMark } = k;
    const { clamp, phase, ease, lerp, v3, order } = k;
    const { FLOOR, RIDE, GPU_IN } = G;
    const Z = window.ZaglobaData, CFG = window.ZaglobaStations.config;
    const SEARCH = [9.2, RIDE, 2.8], ACCESS = [10.05, RIDE, 2.8], RANK = [10.9, RIDE, 2.8], INLET = G.INLET;
    const STAGE_Z = 2.42, CARD = { w: 0.15, h: 0.2 };
    const TRAY = [9.95, 0.32, 3.45];
    const PODIUM = [{ x: 10.9, h: 0.3 }, { x: 10.6, h: 0.22 }, { x: 11.2, h: 0.15 }], PODIUM_Z = 2.3;
    const SRC_TONE = Object.fromEntries(Z.SOURCE_IDS.map(sid => [sid, Z.SOURCES[sid].tone]));
    const CLOUD = Object.fromEntries(CFG.clouds.map(c => [c.key, c.pos]));
    const DOC_IDS = Object.keys(Z.DOCS);
    Object.assign(info, { candidates: 0, skippedShown: 0, podium: 0, keywords: 0, monitorView: "idle" });

    // ─── Build: knowledge index (two shelf units with binders and document cards) ───
    function buildIndex() {
      refs.slots = {};
      const units = [8.88, 9.56], levels = [0.22, 0.47, 0.72];
      for (const ux of units) {
        for (const dx of [-0.31, 0.31]) box(ux + dx, 2.0, 0.04, 0.3, 0.86, "shelf", FLOOR + 0.12);
        for (const ly of [...levels, 0.97]) box(ux, 2.0, 0.66, 0.3, 0.025, "shelf", ly - 0.025);
        box(ux, 1.87, 0.66, 0.02, 0.86, "shelf", FLOOR + 0.12);
        // decorative binders coloured by source
        const rnd = seeded(Math.round(ux * 100));
        levels.forEach((ly, li) => { for (let i = 0; i < 9; i++) { const tone = ["srcA", "srcB", "srcC", "paper"][Math.floor(rnd() * 4)]; box(ux - 0.26 + i * 0.065, 1.96, 0.05, 0.16, 0.16 + rnd() * 0.05, tone, ly); } });
      }
      // one slot per real document (front edge of the shelves)
      DOC_IDS.forEach((id, i) => { const ux = units[i % 2], li = Math.floor(i / 2) % 3, slotX = ux - 0.15 + (Math.floor(i / 6)) * 0.3; refs.slots[id] = [slotX, levels[li] + 0.11, 2.12]; });
    }
    // Document cards: a paper card with a coloured source stripe, used for search results.
    function buildCards() {
      refs.cards = {};
      for (const id of DOC_IDS) {
        const doc = Z.DOCS[id], tone = SRC_TONE[doc.source];
        const tex = canvasTexture(192, 256, (c, w, h) => {
          c.fillStyle = colors.paper; c.fillRect(0, 0, w, h);
          c.fillStyle = colors[tone]; c.fillRect(0, 0, w, 26);
          c.fillStyle = colors.rackLine; fakeText(c, 16, 60, w - 32, 6, 30, 8, seeded(id.length * 13));
        });
        const g = group(...refs.slots[id]);
        const tint = own("paper", { map: tex, emissive: colors.paper, emissiveIntensity: 0, side: THREE.DoubleSide, transparent: true });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), tint); face.castShadow = true; g.add(face);
        const lock = k.padlock(0, CARD.h / 2 + 0.06, 0.01, "lockRed", 0.63, g); lock.visible = false;
        g.traverse(o => { o.userData.noCollide = true; });
        refs.cards[id] = { g, tint, lock };
      }
    }
    // Search hub: a ring around the question that pulses while searching, plus beams to the candidates.
    function buildSearch() {
      refs.ringMat = own("accent", { emissive: colors.accent, emissiveIntensity: 0.1, transparent: true, opacity: 0.9 });
      refs.ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 8, 48), refs.ringMat); refs.ring.rotation.x = Math.PI / 2; refs.ring.position.set(SEARCH[0], FLOOR + 0.24, SEARCH[2]); k.world.add(refs.ring);
      refs.pulseMat = own("accent", { emissive: colors.accent, emissiveIntensity: 1, transparent: true, opacity: 0 });
      refs.pulse = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 6, 48), refs.pulseMat); refs.pulse.rotation.x = Math.PI / 2; refs.pulse.position.copy(refs.ring.position); k.world.add(refs.pulse);
      // one beam per candidate, for the question with the most candidates
      const beams = Math.max(...Z.PROMPTS.map(p => p.candidates.length));
      refs.beams = Array.from({ length: beams }, (_, i) => {
        const m = own(i % 2 ? "admin" : "accent", { emissive: colors[i % 2 ? "admin" : "accent"], emissiveIntensity: 1.3, transparent: true, opacity: 0.75 });
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), m); b.visible = false; b.userData.noCollide = true; k.world.add(b); return b;
      });
    }
    // Access gate with a badge reader; a tray at the front for skipped documents.
    function buildGate() {
      const x = ACCESS[0];
      for (const z of [2.25, 3.25]) box(x, z, 0.07, 0.07, 0.72, "admin", FLOOR + 0.12, undefined, 0.02);
      box(x, 2.75, 0.1, 1.07, 0.07, "admin", FLOOR + 0.84, undefined, 0.02);
      box(x + 0.06, 3.25, 0.05, 0.12, 0.16, "chipMasked", 0.5);
      refs.readerMat = own("ok", { emissive: colors.ok, emissiveIntensity: 0.1 });
      sphere(x + 0.09, 0.62, 3.25, 0.025, refs.readerMat);
      box(TRAY[0], TRAY[2], 0.36, 0.26, 0.05, "rackDark", FLOOR + 0.12, undefined, 0.02);
      box(TRAY[0], TRAY[2] + 0.12, 0.36, 0.02, 0.09, "lockRed", FLOOR + 0.12);
    }
    function buildPodium() {
      const tex = n => canvasTexture(128, 96, (c, w, h) => { c.fillStyle = colors.accent; c.fillRect(0, 0, w, h); c.fillStyle = colors.paper; c.font = font(800, 64); c.textAlign = "center"; c.fillText(String(n), w / 2, h / 2 + 22); });
      PODIUM.forEach((p, i) => {
        box(p.x, PODIUM_Z, 0.28, 0.3, p.h, "podium", FLOOR + 0.12, undefined, 0.02);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ map: tex(i + 1) })); plate.position.set(p.x, FLOOR + 0.12 + p.h / 2, PODIUM_Z + 0.152); k.world.add(plate);
      });
    }
    // Connectors board above the back panel: one lamp per source system.
    function buildConnectors() {
      const { g, W, rowY } = k.rackBoard(10.75, "KONEKTORY ŹRÓDEŁ · SYNCHRONIZACJA W TLE", Z.SOURCE_IDS, (c, sid, y) => {
        c.fillStyle = colors[SRC_TONE[sid]]; c.fillRect(40, y - 26, 52, 52);
        c.fillStyle = colors.paper; c.font = font(600, 34); c.fillText(Z.SOURCES[sid].title, 118, y + 4);
        c.font = font(400, 24); c.fillStyle = colors.rackLine; c.fillText("dokumenty pozostają w źródle · uprawnienia zachowane", 118, y + 34);
      });
      refs.srcLamps = Z.SOURCE_IDS.map((_, i) => { const m = own("ok", { emissive: colors.ok, emissiveIntensity: 0.3 }); sphere(W / 2 - 0.07, rowY(i), 0.06, 0.035, m, g); return m; });
    }
    // What the results monitor (above the back panel) shows: candidates, scores, access, rank.
    function drawMonitor(c, st, W) {
      const line = colors.xrayLine;
      c.fillStyle = line;
      if (st.view === "idle") {
        c.globalAlpha = 0.7; c.font = font(500, 24, true); c.fillText("indeks gotowy · " + Z.SOURCE_IDS.length + " źródła · synchronizacja w tle", 46, 130);
        c.fillText("oczekiwanie na pytanie…", 46, 560); c.globalAlpha = 1; return;
      }
      const cols = [46, 96, 540, 690, 790, 890];
      c.font = font(700, 20, true); ["#", "DOKUMENT", "ŹRÓDŁO", "SEM.", "SŁOWA", "DOSTĘP"].forEach((h, i) => c.fillText(h, cols[i], 112));
      st.rows.forEach((r, i) => {
        const y = 160 + i * 66;
        const dim = r.state === "dropped" || r.state === "skipped";
        c.globalAlpha = dim ? 0.45 : 1;
        if (r.rank) { c.fillStyle = colors.accent; c.fillRect(30, y - 34, W - 60, 52); }
        c.fillStyle = r.state === "skipped" ? colors.danger : colors.paper; c.font = font(700, 22, true); c.fillText(r.rank ? String(r.rank) : "·", cols[0], y);
        c.font = font(500, 21, true); c.fillText(r.title.length > 32 ? r.title.slice(0, 31) + "…" : r.title, cols[1], y);
        c.fillStyle = colors[SRC_TONE[r.source]]; c.fillRect(cols[2], y - 18, 14, 22); c.fillStyle = colors.paper; c.fillText(Z.SOURCES[r.source].title, cols[2] + 22, y);
        c.fillText(String(Math.round(r.semantic * 100)), cols[3], y); c.fillText(String(Math.round(r.keyword * 100)), cols[4], y);
        if (r.access) { c.fillStyle = r.access === "ok" ? colors.ok : colors.danger; c.font = font(700, 21, true); c.fillText(r.access === "ok" ? "tak" : "BRAK", cols[5], y); }
        c.globalAlpha = 1;
      });
      c.fillStyle = st.tone === "danger" ? colors.danger : st.tone === "ok" ? colors.ok : line; c.font = font(700, 23, true); c.fillText(st.status, 46, 565);
    }
    // Sync pipes from the source clouds through the wall opening into the index.
    function buildPipes() {
      refs.pipes = {};
      const glass = own("tube", { transparent: true, opacity: 0.35, depthWrite: false });
      refs.pipeGlow = own("accent", { emissive: colors.accent, emissiveIntensity: 0, transparent: true, opacity: 0 });
      const common = [[11.25, 1.2, -0.6], [11.25, 0.45, 0.06], [11.25, 0.45, 0.9], [9.2, 0.45, 1.2], [9.2, 0.45, 1.95]];
      for (const sid of Z.SOURCE_IDS) {
        const [x, y, z] = CLOUD[sid];
        const curve = makePath([{ curve: [[x, y - 0.25, z], [x, y - 1.0, z + 0.6], [11.25, 1.8, -1.0], common[0]] }, { line: common }]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.045, 8, false), glass); tube.userData.noCollide = true; tube.castShadow = false; k.world.add(tube);
        const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.016, 6, false), refs.pipeGlow); core.userData.noCollide = true; core.castShadow = false; k.world.add(core);
        refs.pipes[sid] = curve;
      }
      refs.pipePulses = Z.SOURCE_IDS.map(sid => { const tone = SRC_TONE[sid], p = sphere(0, 0, 0, 0.035, own(tone, { emissive: colors[tone], emissiveIntensity: 1.4 })); p.visible = false; p.userData.noCollide = true; return p; });
    }
    // ─── Office: a knowledge office – bookcases, a low file cabinet, a reading table and a floor lamp ───
    function buildOffice() {
      const rnd = seeded(7), SPINES = ["srcA", "srcB", "srcC", "accent", "paper", "admin"];
      // tall bookcases along the left wall, books facing the room
      for (const cz of [1.0, 2.12]) {
        box(0.3, cz, 0.4, 1.06, 1.06, "wood", 0, undefined, 0.02);
        for (let row = 0; row < 4; row++) {
          const y = 0.06 + row * 0.25; box(0.51, cz, 0.02, 1.0, 0.02, "wood", y);
          for (let z = cz - 0.47; z < cz + 0.44;) { const w = 0.05 + rnd() * 0.05, h = 0.13 + rnd() * 0.07; if (rnd() > 0.12) box(0.51, z + w / 2, 0.035, w - 0.008, h, SPINES[Math.floor(rnd() * SPINES.length)], y + 0.02); z += w; }
        }
      }
      // low file cabinet under the first window, binders on top
      box(1.45, 0.34, 1.5, 0.4, 0.44, "cabinet", 0, undefined, 0.02);
      for (let i = 0; i < 3; i++) for (let r = 0; r < 2; r++) box(0.98 + i * 0.47, 0.545, 0.16, 0.015, 0.02, "metal", 0.12 + r * 0.18);
      for (let i = 0; i < 7; i++) box(0.95 + i * 0.075, 0.32, 0.06, 0.26, 0.2, SPINES[i % 4], 0.44);
      // reading table with four chairs, books and a laptop
      const T = [5.0, 2.1];
      cylinder(T[0], T[1], 0.24, 0.03, "metal"); cylinder(T[0], T[1], 0.04, 0.7, "metal"); cylinder(T[0], T[1], 0.56, 0.04, "wood", 0.7, undefined, 0.56, 28);
      for (const a of [0.6, 2.2, 3.75, 5.35]) { const dx = Math.cos(a) * 0.82, dz = Math.sin(a) * 0.82; k.chair(T[0] + dx, T[1] + dz, Math.atan2(-dx, -dz)); }
      box(4.82, 2.0, 0.32, 0.22, 0.015, "ink", 0.74); box(4.82, 1.9, 0.32, 0.02, 0.2, "ink", 0.74);
      box(5.2, 2.25, 0.22, 0.16, 0.04, "srcA", 0.74); box(5.21, 2.24, 0.2, 0.15, 0.03, "srcC", 0.78);
      // a desk by the partition and a floor lamp next to the reading table
      k.deskAt(6.4, 1.12); k.chair(6.4, 1.8, Math.PI);
      cylinder(3.85, 3.0, 0.13, 0.02, "metal"); cylinder(3.85, 3.0, 0.014, 1.18, "metal");
      cylinder(3.85, 3.0, 0.17, 0.16, own("lampShade", { emissive: colors.lampShade, emissiveIntensity: 0.35 }), 1.12, undefined, 0.1);
      k.plant(0.45, 3.1, 1.2);
    }
    function build() {
      buildIndex(); buildCards(); buildSearch(); buildGate(); buildPodium(); buildConnectors();
      refs.drawMonitor = k.rackScreen(SEARCH[0] - 0.02, "PODGLĄD WYSZUKIWANIA · BAZA WIEDZY", drawMonitor);
      buildPipes();
      k.plates([[9.2, "1", "WYSZUKIWANIE", "accent"], [10.05, "2", "UPRAWNIENIA", "admin"], [10.9, "3", "TRAFNOŚĆ", "accent"], [12.25, "4", "MODEL LOKALNY", "ok"]]);
    }

    // ─── Build: inner paths ───
    function buildPaths() {
      const inside = [INLET, SEARCH, ACCESS, RANK], local = k.localRoute(RANK);
      [paths.inlet2search, paths.search2access, paths.access2rank] = k.legs(inside);
      paths.local = makePath(local); paths.back = k.returnPath(local, inside);
    }

    // ─── Pose ───
    function cardPlan(s, d, sheetX) {
      // Where every candidate card is in this scene and moment; non-candidates stay in their shelf slots.
      const id = s.sceneId, t = s.t, plan = {}, cand = d.candidates, n = cand.length;
      const stage = (i, x) => v3([x + (i - (n - 1) / 2) * 0.22, 0.66, STAGE_Z]);
      const tray = i => v3(TRAY).add(v3([(i - 1) * 0.05, 0.12, 0])); // a skipped card's place in the tray, the same in every scene
      const slot = cid => v3(refs.slots[cid]);
      const podiumPos = r => v3([PODIUM[r].x, FLOOR + 0.12 + PODIUM[r].h + CARD.h / 2 + 0.01, PODIUM_Z]);
      cand.forEach((cid, i) => {
        const skipped = d.skipped.includes(cid), r = d.ranked.indexOf(cid);
        let pos = slot(cid), vis = true, scale = 1, red = 0, lock = false;
        if (id === "search") { const u = ease(phase(t, 0.55 + i * 0.07, 0.75 + i * 0.07)); pos = slot(cid).lerp(stage(i, sheetX), u); }
        else if (id === "access") {
          const tc = 0.32 + i * 0.13;
          if (skipped) { const stop = v3([9.8, 0.66, STAGE_Z]); pos = stage(i, sheetX < 9.8 ? sheetX : 9.8); if (t > tc) pos = stop.clone(); red = t > tc ? 1 : 0; lock = t > tc + 0.05; if (t > tc + 0.12) pos = stop.lerp(tray(i), ease(phase(t, tc + 0.12, tc + 0.3))); }
          else pos = stage(i, Math.min(sheetX, 9.85)).lerp(stage(i, 10.3), ease(phase(t, tc, tc + 0.1)));
        }
        else if (id === "rank") {
          if (skipped) { pos = tray(i); red = 1; lock = true; }
          else { const from = stage(i, 10.3), u = ease(phase(t, 0.3 + i * 0.06, 0.55 + i * 0.06)); pos = r >= 0 ? from.lerp(podiumPos(r), u) : from; if (r < 0) scale = 1 - 0.97 * u; }
        }
        else if (id === "model") {
          if (skipped) { pos = tray(i); red = 1; lock = true; }
          else if (r >= 0) { const u = ease(phase(t, 0.05 + r * 0.04, 0.38)); pos = podiumPos(r).lerp(v3(GPU_IN), u); scale = k.swallowScale(id, t); }
          else vis = false;
        }
        plan[cid] = { pos, vis: vis && scale > 0.04, scale, red, lock };
      });
      return plan;
    }
    function pose(s, dt, { o }) {
      const id = s.sceneId, t = s.t, d = s.decision;
      // sheet position inside the server and back
      const ride = id === "search" ? k.ride(paths.inlet2search, t, 0.2, 0.4, "search") : id === "access" ? k.ride(paths.search2access, t, 0, 0.25, "access")
        : id === "rank" ? k.ride(paths.access2rank, t, 0, 0.2, "rank") : id === "model" ? k.ride(paths.local, t, 0, 0.4, "local")
        : id === "return" ? k.ride(paths.back, t, 0, 0.82, "desk", "answer") : null;
      const pos = ride && ride.pos, scale = k.swallowScale(id, t);
      // keywords highlighted on the question while searching (keyword half of the hybrid search)
      const kw = (id === "search" && t > 0.45) || (o > order("search") && o <= order("model"));
      refs.msgMarks.forEach(mk => paintMark(mk, kw ? "keyword" : "none"));
      info.keywords = kw ? refs.msgMarks.length : 0;
      // search hub: ring pulses, beams to candidate slots
      const searching = id === "search" && t > 0.4 && t < 0.8;
      refs.ringMat.emissiveIntensity = searching ? 1.4 : 0.1;
      const pr = searching ? (t * 3) % 1 : 0; refs.pulse.scale.setScalar(1 + pr * 1.6); refs.pulseMat.opacity = searching ? 0.8 * (1 - pr) : 0;
      const cand = d ? d.candidates : [];
      refs.beams.forEach((b, i) => {
        const cid = cand[i], show = searching && cid && t > 0.45 && t < 0.62 + i * 0.07;
        b.visible = !!show; if (!show) return;
        const a = v3([SEARCH[0], RIDE + 0.1, SEARCH[2]]), z = v3(refs.slots[cid]), mid = a.clone().add(z).multiplyScalar(0.5), len = a.distanceTo(z);
        b.position.copy(mid); b.scale.set(1, len, 1); b.quaternion.setFromUnitVectors(v3([0, 1, 0]), z.clone().sub(a).normalize());
      });
      // cards
      const sheetX = pos ? pos.x : SEARCH[0], plan = d ? cardPlan(s, d, sheetX) : {};
      let shownCandidates = 0, inTray = 0, onPodium = 0;
      for (const cid of DOC_IDS) {
        const card = refs.cards[cid], pl = plan[cid];
        let cpos = v3(refs.slots[cid]), vis = true, sc = 1, red = 0, lock = false;
        if (pl) ({ pos: cpos, vis, scale: sc, red, lock } = pl);
        card.g.position.copy(cpos); card.g.visible = vis; card.g.scale.setScalar(sc); card.g.rotation.set(-0.25, 0.25, 0);
        card.tint.emissive.set(colors[red ? "danger" : "paper"]); card.tint.emissiveIntensity = red ? 0.5 : 0; card.lock.visible = lock;
        if (pl && id === "search" && t > 0.75) shownCandidates++;
        if (pl && lock && (id === "access" || id === "rank")) inTray++;
        if (pl && id === "rank" && t >= 1 && d.ranked.includes(cid)) onPodium++;
      }
      info.candidates = shownCandidates; info.skippedShown = inTray; info.podium = onPodium;
      // access gate reader: green while passing, red when a document is stopped
      const stopped = id === "access" && d && d.skipped.length && t > 0.32 && t < 0.62;
      refs.readerMat.color.set(colors[stopped ? "danger" : "ok"]); refs.readerMat.emissive.set(colors[stopped ? "danger" : "ok"]); refs.readerMat.emissiveIntensity = id === "access" ? 1.4 : 0.1;
      // results monitor
      let mv = { view: "idle" };
      if (d && ((id === "search" && t > 0.5) || (o > order("search") && o <= order("return")))) {
        const accessKnown = o > order("access") || (id === "access" && t > 0.3), rankKnown = o > order("rank") || (id === "rank" && t > 0.4);
        const rows = d.candidates.map(cid => {
          const sk = d.skipped.includes(cid), r = d.ranked.indexOf(cid);
          return { title: Z.DOCS[cid].title, source: Z.DOCS[cid].source, semantic: d.scores[cid].semantic, keyword: d.scores[cid].keyword,
            access: accessKnown ? (sk ? "no" : "ok") : "", rank: rankKnown && r >= 0 ? r + 1 : 0, state: accessKnown && sk ? "skipped" : rankKnown && r < 0 ? "dropped" : "" };
        });
        const status = !accessKnown ? ["znaleziono " + d.candidates.length + " dokumenty kandydujące · wyszukiwanie hybrydowe", "line"]
          : !rankKnown ? (d.skipped.length ? ["pominięto " + d.skipped.length + " dokument – brak uprawnień użytkownika", "danger"] : ["użytkownik ma dostęp do wszystkich kandydatów", "ok"])
          : d.outcome === "nodata" ? ["brak wystarczających informacji – bez odpowiedzi spekulatywnej", "danger"] : ["do odpowiedzi: " + d.ranked.length + " najtrafniejsze dokumenty", "ok"];
        mv = { view: "results", rows, status: status[0], tone: status[1] };
      }
      refs.drawMonitor(mv); info.monitorView = mv.view;
      // connectors: lamps blink and pulses travel down the pipes while syncing in the admin scene
      const syncing = id === "admin";
      refs.pipeGlow.opacity = syncing ? 0.9 : 0; refs.pipeGlow.emissiveIntensity = syncing ? 1.2 : 0;
      refs.srcLamps.forEach((m, i) => { m.emissiveIntensity = syncing ? 0.8 + 0.6 * Math.abs(Math.sin(t * 20 + i)) : 0.3; });
      refs.pipePulses.forEach((pulse, i) => {
        const sid = Z.SOURCE_IDS[i], on = id === "admin";
        pulse.visible = on; if (on) pulse.position.copy(refs.pipes[sid].getPointAt(((t * 1.6) + i / Z.SOURCE_IDS.length) % 1));
      });
      for (const sid of Z.SOURCE_IDS) refs.cloudMats[sid].emissiveIntensity = syncing ? 1.2 : 0;
      // local model at work: takes question + sources in, its LED works (amber when abstaining)
      k.poseCabinet(id, t, { ledTone: d && d.outcome === "nodata" ? "srcC" : "gpuLed" });
      refs.gateMat.emissiveIntensity = id === "admin" ? 0.8 : 0;
      return ride ? { ...ride, scale } : { node: "none" };
    }

    // ─── Camera, labels, diagnostics ───
    function shot(s, poseOut, follow, SHOTS) {
      const id = s.sceneId, t = s.t;
      if (id === "search") return t < 0.3 ? SHOTS.rackOut : SHOTS.search;
      if (id === "access") return SHOTS.access;
      if (id === "rank") return SHOTS.rank;
      if (id === "model") return SHOTS.gpu;
      if (id === "admin" && t < 0.35) return SHOTS.sources;
      return null;
    }
    function labelVisible(l, s) {
      if (l.id === "skipped") return !!(s.decision && s.decision.skipped.length);
      return true;
    }
    function collisionRuns() {
      return Z.PROMPTS.map(p => ({ prompt: p, decision: Z.decide(p, {}), label: p.id }));
    }
    return {
      buildOffice, build, buildPaths, pose, shot, labelVisible, collisionRuns,
      sig: s => (s.decision ? s.decision.ranked.join(",") + "|" + s.decision.skipped.join(",") : ""),
      animating: s => s.sceneId === "admin" || s.sceneId === "model" || s.sceneId === "return"
    };
  }
};
