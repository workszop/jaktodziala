/* Zagłoba od środka – stations inside the Quantica AI Server for the shared world engine (world-core.js):
   knowledge index (shelves of document cards), hybrid search, access gate, relevance podium, GPU server cabinet
   (local model), results monitor, connectors board and sync pipes from SharePoint / OneDrive / Amazon S3. */
window.ZaglobaStations = {
  config: {
    sceneOrder: ["login", "chat", "send", "search", "access", "rank", "model", "return", "admin", "final"],
    openScene: "search",
    travelScenes: ["search", "access", "rank", "model"],
    colorKeys: ["srcA", "srcB", "srcC", "xrayBg", "xrayLine", "podium", "tube", "lockRed"],
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
      gpu: { target: [12.0, 0.62, 3.0], span: 2.5, angle: 0.55, elev: 0.55 },
      sources: { target: [10.9, 2.2, -1.5], span: 5.4, angle: 0.5, elev: 0.3 }
    },
    labels: [
      { id: "monitor", text: "Podgląd wyszukiwania", color: "accent", pos: [9.18, 2.08, 1.66], scenes: ["search", "access", "rank"] },
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
      monitor: [8.62, 1.6, 1.9], index: [8.75, 0.9, 2.05], search: [9.2, 0.75, 3.1], gate: [10.05, 0.9, 3.2], skipped: [9.95, 0.42, 3.45],
      podium: [11.2, 0.75, 2.3], local: [12.25, 1.1, 2.95], connectors: [10.75, 1.82, 1.72], sharepoint: [9.0, 3.5, -2.7]
    },
    ariaLabel: "Świat 3D: biuro, kabel do serwerowni, Quantica AI Server z bazą wiedzy i źródła danych organizacji. Przeciągnij, aby obrócić; kółko przybliża; dwuklik resetuje widok."
  },

  create(k) {
    "use strict";
    // ─── Constants ───
    const { THREE, G, colors, refs, paths, info, options } = k;
    const { box, cylinder, sphere, group, strip, own, canvasTexture, makePath, reverseSegments, fakeText, seeded, paintMark } = k;
    const { clamp, phase, ease, easeOutBack, lerp, order } = k;
    const { FLOOR, RIDE } = G;
    const Z = window.ZaglobaData;
    const SEARCH = [9.2, RIDE, 2.8], ACCESS = [10.05, RIDE, 2.8], RANK = [10.9, RIDE, 2.8], INLET = G.INLET;
    const LOCAL_TURN = [11.45, 3.45], CAB = { x: 12.25, z: 2.75, chosen: 1 }, GPU_IN = [12.25, 0.49, 2.95];
    const STAGE_Z = 2.42, CARD = { w: 0.15, h: 0.2 };
    const TRAY = [9.95, 0.32, 3.45];
    const PODIUM = [{ x: 10.9, h: 0.3 }, { x: 10.6, h: 0.22 }, { x: 11.2, h: 0.15 }], PODIUM_Z = 2.3;
    const SRC_TONE = { sharepoint: "srcA", onedrive: "srcB", s3: "srcC" };
    const CLOUD = { sharepoint: [9.0, 3.1, -2.7], onedrive: [11.25, 3.45, -3.1], s3: [13.5, 3.1, -2.7] };
    const DOC_IDS = Object.keys(Z.DOCS);
    Object.assign(info, { candidates: 0, skippedShown: 0, podium: 0, keywords: 0, monitorView: "idle", blade: 0 });

    // ─── Build: knowledge index (two shelf units with binders and document cards) ───
    function buildIndex() {
      refs.slots = {};
      const units = [8.88, 9.56], levels = [0.22, 0.47, 0.72];
      for (const ux of units) {
        for (const dx of [-0.31, 0.31]) box(ux + dx, 2.0, 0.04, 0.3, 0.86, "wood", FLOOR + 0.12);
        for (const ly of [...levels, 0.97]) box(ux, 2.0, 0.66, 0.3, 0.025, "wood", ly - 0.025);
        box(ux, 1.87, 0.66, 0.02, 0.86, "wood", FLOOR + 0.12);
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
          if (doc.fresh) { c.fillStyle = colors.ok; c.fillRect(w - 70, 34, 60, 22); c.fillStyle = colors.paper; c.font = "800 15px " + (options.font || "sans-serif"); c.fillText("NOWY", w - 62, 50); }
        });
        const g = group(...refs.slots[id]);
        const tint = own("paper", { map: tex, emissive: colors.paper, emissiveIntensity: 0, side: THREE.DoubleSide, transparent: true });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), tint); face.castShadow = true; g.add(face);
        const lock = group(0, CARD.h / 2 + 0.06, 0.01, g); box(0, 0, 0.07, 0.03, 0.055, "lockRed", -0.027, lock, 0.01);
        const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 8, 16, Math.PI), k.material("lockRed")); shackle.position.y = 0.03; lock.add(shackle); lock.visible = false;
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
      refs.beams = [0, 1, 2, 3].map(i => {
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
      const tex = n => canvasTexture(128, 96, (c, w, h) => { c.fillStyle = colors.accent; c.fillRect(0, 0, w, h); c.fillStyle = colors.paper; c.font = "800 64px " + (options.font || "sans-serif"); c.textAlign = "center"; c.fillText(String(n), w / 2, h / 2 + 22); });
      PODIUM.forEach((p, i) => {
        box(p.x, PODIUM_Z, 0.28, 0.3, p.h, "podium", FLOOR + 0.12, undefined, 0.02);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshStandardMaterial({ map: tex(i + 1) })); plate.position.set(p.x, FLOOR + 0.12 + p.h / 2, PODIUM_Z + 0.152); k.world.add(plate);
      });
    }
    // Connectors board above the back panel: one lamp per source system.
    function buildConnectors() {
      const W = 1.56, H = 0.66, g = group(10.75, FLOOR + 1.12, 1.66);
      box(0, 0, W + 0.06, 0.05, H + 0.06, "rackDark", -0.03, g, 0.02);
      for (const x of [-0.5, 0.5]) box(x, 0.02, 0.05, 0.05, 0.14, "metal", -0.14, g);
      const tex = canvasTexture(1024, 432, (c, w) => {
        c.fillStyle = colors.rackFace; c.fillRect(0, 0, w, 432);
        c.fillStyle = colors.admin; c.fillRect(0, 0, w, 74);
        c.fillStyle = colors.paper; c.font = "700 34px " + (options.font || "sans-serif"); c.fillText("KONEKTORY ŹRÓDEŁ · SYNCHRONIZACJA W TLE", 32, 49);
        Z.SOURCE_IDS.forEach((sid, i) => {
          const y = 140 + i * 104; c.strokeStyle = colors.rackLine; c.lineWidth = 2; c.strokeRect(20, y - 44, w - 40, 88);
          c.fillStyle = colors[SRC_TONE[sid]]; c.fillRect(40, y - 26, 52, 52);
          c.fillStyle = colors.paper; c.font = "600 34px " + (options.font || "sans-serif"); c.fillText(Z.SOURCES[sid].title, 118, y + 4);
          c.font = "400 24px " + (options.font || "sans-serif"); c.fillStyle = colors.rackLine; c.fillText("dokumenty pozostają w źródle · uprawnienia zachowane", 118, y + 34);
        });
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); face.position.set(0, H / 2, 0.03); g.add(face);
      refs.srcLamps = Z.SOURCE_IDS.map((_, i) => { const y = H / 2 - (140 + i * 104 - 216) / 432 * H, m = own("ok", { emissive: colors.ok, emissiveIntensity: 0.3 }); sphere(W / 2 - 0.07, y, 0.06, 0.035, m, g); return m; });
    }
    // Results monitor above the back panel: candidates, scores, access, rank.
    function buildMonitor() {
      const W = 1.3, H = 0.775, g = group(SEARCH[0] - 0.02, FLOOR + 1.12, 1.66); g.rotation.y = 0.32;
      box(0, 0, W + 0.06, 0.05, H + 0.06, "rackDark", -0.03, g, 0.02);
      for (const dx of [-0.45, 0.45]) box(dx, 0.02, 0.05, 0.05, 0.14, "metal", -0.14, g);
      refs.monCanvas = document.createElement("canvas"); refs.monCanvas.width = 1024; refs.monCanvas.height = 610;
      refs.monTex = new THREE.CanvasTexture(refs.monCanvas); refs.monTex.colorSpace = THREE.SRGBColorSpace; refs.monTex.anisotropy = 4;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: refs.monTex, toneMapped: false })); screen.position.set(0, H / 2, 0.03); g.add(screen);
      refs.monKey = ""; drawMonitor({ view: "idle" });
    }
    function drawMonitor(st) {
      const key = JSON.stringify(st); if (key === refs.monKey) return; refs.monKey = key;
      const c = refs.monCanvas.getContext("2d"), W = 1024, mono = "Geist Mono, monospace", line = colors.xrayLine;
      c.fillStyle = colors.xrayBg; c.fillRect(0, 0, W, 610);
      c.fillStyle = line; c.font = "700 30px " + mono; c.fillText("PODGLĄD WYSZUKIWANIA · BAZA WIEDZY", 30, 48);
      c.globalAlpha = 0.25; c.fillRect(30, 64, W - 60, 2); c.globalAlpha = 1;
      if (st.view === "idle") {
        c.globalAlpha = 0.7; c.font = "500 24px " + mono; c.fillText("indeks gotowy · " + Z.SOURCE_IDS.length + " źródła · synchronizacja w tle", 46, 130);
        c.fillText("oczekiwanie na pytanie…", 46, 560); c.globalAlpha = 1; refs.monTex.needsUpdate = true; return;
      }
      const cols = [46, 96, 540, 690, 790, 890];
      c.font = "700 20px " + mono; ["#", "DOKUMENT", "ŹRÓDŁO", "SEM.", "SŁOWA", "DOSTĘP"].forEach((h, i) => c.fillText(h, cols[i], 112));
      st.rows.forEach((r, i) => {
        const y = 160 + i * 66;
        const dim = r.state === "dropped" || r.state === "skipped";
        c.globalAlpha = dim ? 0.45 : 1;
        if (r.rank) { c.fillStyle = colors.accent; c.fillRect(30, y - 34, W - 60, 52); }
        c.fillStyle = r.state === "skipped" ? colors.danger : colors.paper; c.font = "700 22px " + mono; c.fillText(r.rank ? String(r.rank) : "·", cols[0], y);
        c.font = "500 21px " + mono; c.fillText(r.title.length > 32 ? r.title.slice(0, 31) + "…" : r.title, cols[1], y);
        c.fillStyle = colors[SRC_TONE[r.source]]; c.fillRect(cols[2], y - 18, 14, 22); c.fillStyle = colors.paper; c.fillText(Z.SOURCES[r.source].title, cols[2] + 22, y);
        if (r.scored) { c.fillText(String(Math.round(r.semantic * 100)), cols[3], y); c.fillText(String(Math.round(r.keyword * 100)), cols[4], y); }
        if (r.access) { c.fillStyle = r.access === "ok" ? colors.ok : colors.danger; c.font = "700 21px " + mono; c.fillText(r.access === "ok" ? "tak" : "BRAK", cols[5], y); }
        c.globalAlpha = 1;
      });
      c.fillStyle = st.tone === "danger" ? colors.danger : st.tone === "ok" ? colors.ok : line; c.font = "700 23px " + mono; c.fillText(st.status, 46, 565);
      refs.monTex.needsUpdate = true;
    }
    // Sync pipes from the source clouds through the wall opening into the index.
    function buildPipes() {
      refs.pipes = {}; refs.pipePulses = [];
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
      for (let i = 0; i < 3; i++) { const m = own(Object.values(SRC_TONE)[i], { emissive: colors[Object.values(SRC_TONE)[i]], emissiveIntensity: 1.4 }); const p = sphere(0, 0, 0, 0.035, m); p.visible = false; p.userData.noCollide = true; refs.pipePulses.push(p); }
    }
    function build() {
      k.belt(8.475, 10.925);
      buildIndex(); buildCards(); buildSearch(); buildGate(); buildPodium(); buildConnectors(); buildMonitor(); buildPipes();
      strip([11.08, 2.98], LOCAL_TURN, 0.2, 0.04, "belt", FLOOR + 0.12); strip(LOCAL_TURN, [CAB.x - 0.3, LOCAL_TURN[1]], 0.2, 0.04, "belt", FLOOR + 0.12);
      refs.blades = k.serverCabinet({ x: CAB.x, z: CAB.z, chosen: CAB.chosen });
      k.plates([[9.2, "1", "WYSZUKIWANIE", "accent"], [10.05, "2", "UPRAWNIENIA", "admin"], [10.9, "3", "TRAFNOŚĆ", "accent"], [12.25, "4", "MODEL LOKALNY", "ok"]]);
      for (const x of [13.55, 13.9]) box(x, 0.6, 0.32, 0.7, 1.0, "rack", FLOOR, undefined, 0.02);
    }

    // ─── Build: inner paths ───
    function buildPaths() {
      const inside = [{ line: [INLET, SEARCH, ACCESS, RANK] }];
      const local = [{ line: [RANK, [LOCAL_TURN[0], RIDE, LOCAL_TURN[1]], [CAB.x, RIDE, LOCAL_TURN[1]], GPU_IN] }];
      paths.inlet2search = makePath([{ line: [INLET, SEARCH] }]); paths.search2access = makePath([{ line: [SEARCH, ACCESS] }]);
      paths.access2rank = makePath([{ line: [ACCESS, RANK] }]); paths.local = makePath(local);
      paths.back = makePath([...reverseSegments(local), ...reverseSegments(inside), ...reverseSegments(paths.sendSegments)]);
    }

    // ─── Pose ───
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    function cardPlan(s, d, o, sheetX) {
      // Where every candidate card is in this scene and moment; non-candidates stay in their shelf slots.
      const id = s.sceneId, t = s.t, plan = {}, cand = d ? d.candidates : [], n = cand.length;
      const stage = (i, x) => V(x + (i - (n - 1) / 2) * 0.22, 0.66, STAGE_Z);
      const slot = cid => V(...refs.slots[cid]);
      const rankIdx = cid => (d ? d.ranked.indexOf(cid) : -1);
      const podiumPos = r => V(PODIUM[r].x, FLOOR + 0.12 + PODIUM[r].h + CARD.h / 2 + 0.01, PODIUM_Z);
      cand.forEach((cid, i) => {
        const skipped = d.skipped.includes(cid), r = rankIdx(cid);
        let pos = slot(cid), vis = true, scale = 1, red = 0, lock = false;
        if (id === "search") { const u = ease(phase(t, 0.55 + i * 0.07, 0.75 + i * 0.07)); pos = slot(cid).lerp(stage(i, sheetX), u); }
        else if (id === "access") {
          const tc = 0.32 + i * 0.13;
          if (skipped) { const stop = V(9.8, 0.66, STAGE_Z); pos = stage(i, sheetX < 9.8 ? sheetX : 9.8); if (t > tc) pos = stop.clone(); red = t > tc ? 1 : 0; lock = t > tc + 0.05; if (t > tc + 0.12) pos = stop.lerp(V(...TRAY).add(V(0, 0.12, 0)), ease(phase(t, tc + 0.12, tc + 0.3))); }
          else pos = stage(i, Math.min(sheetX, 9.85)).lerp(V(10.3 + (i - (n - 1) / 2) * 0.22, 0.66, STAGE_Z), ease(phase(t, tc, tc + 0.1)));
        }
        else if (id === "rank") {
          if (skipped) { pos = V(...TRAY).add(V((i - 1) * 0.05, 0.12, 0)); red = 1; lock = true; }
          else { const from = V(10.3 + (i - (n - 1) / 2) * 0.22, 0.66, STAGE_Z), u = ease(phase(t, 0.3 + i * 0.06, 0.55 + i * 0.06)); pos = r >= 0 ? from.lerp(podiumPos(r), u) : from; if (r < 0) scale = 1 - 0.97 * u; }
        }
        else if (id === "model") {
          if (skipped) { pos = V(...TRAY).add(V((i - 1) * 0.05, 0.12, 0)); red = 1; lock = true; }
          else if (r >= 0) { const u = ease(phase(t, 0.05 + r * 0.04, 0.38)); pos = podiumPos(r).lerp(V(...GPU_IN), u); scale = 1 - 0.97 * ease(phase(t, 0.28, 0.4)); }
          else vis = false;
        }
        else if (o > order("model") || o < order("search")) { pos = slot(cid); }
        plan[cid] = { pos, vis: vis && scale > 0.04, scale, red, lock };
      });
      return plan;
    }
    function pose(s, dt, { o }) {
      const id = s.sceneId, t = s.t, d = s.decision, p = s.prompt;
      // sheet position inside the server and back
      let pos = null, carrier = null, node = "none";
      const at = (path, u) => path.getPointAt(clamp(u));
      if (id === "search") { pos = at(paths.inlet2search, ease(phase(t, 0.2, 0.4))); carrier = "packet"; node = t >= 0.4 ? "search" : "moving"; }
      else if (id === "access") { pos = at(paths.search2access, ease(phase(t, 0, 0.25))); carrier = "packet"; node = t >= 0.25 ? "access" : "moving"; }
      else if (id === "rank") { pos = at(paths.access2rank, ease(phase(t, 0, 0.2))); carrier = "packet"; node = t >= 0.2 ? "rank" : "moving"; }
      else if (id === "model") { pos = at(paths.local, ease(phase(t, 0, 0.4))); carrier = "packet"; node = t >= 0.4 ? "local" : "moving"; }
      else if (id === "return") { pos = at(paths.back, ease(phase(t, 0, 0.82))); carrier = "answer"; node = t >= 0.82 ? "desk" : "moving"; }
      const scale = id === "model" ? 1 - 0.97 * ease(phase(t, 0.28, 0.4)) : id === "return" ? 0.03 + 0.97 * ease(phase(t, 0.02, 0.14)) : 1;
      // keywords highlighted on the question while searching (keyword half of the hybrid search)
      const kw = (id === "search" && t > 0.45) || (o > order("search") && o <= order("model"));
      refs.msgMarks.forEach(mk => paintMark(mk, kw ? "keyword" : "none"));
      refs.pdfs.forEach(pdf => { pdf.g.visible = false; });
      info.keywords = kw ? refs.msgMarks.length : 0; info.attachments = 0;
      // search hub: ring pulses, beams to candidate slots
      const searching = id === "search" && t > 0.4 && t < 0.8;
      refs.ringMat.emissiveIntensity = searching ? 1.4 : 0.1;
      const pr = searching ? (t * 3) % 1 : 0; refs.pulse.scale.setScalar(1 + pr * 1.6); refs.pulseMat.opacity = searching ? 0.8 * (1 - pr) : 0;
      const cand = d ? d.candidates : [];
      refs.beams.forEach((b, i) => {
        const cid = cand[i], show = searching && cid && t > 0.45 && t < 0.62 + i * 0.07;
        b.visible = !!show; if (!show) return;
        const a = V(SEARCH[0], RIDE + 0.1, SEARCH[2]), z = V(...refs.slots[cid]), mid = a.clone().add(z).multiplyScalar(0.5), len = a.distanceTo(z);
        b.position.copy(mid); b.scale.set(1, len, 1); b.quaternion.setFromUnitVectors(V(0, 1, 0), z.clone().sub(a).normalize());
      });
      // fresh document arrives through the SharePoint pipe at the start of the search
      const freshId = d && d.fresh.length ? d.fresh[0] : null;
      // cards
      const sheetX = pos ? pos.x : SEARCH[0], plan = d ? cardPlan(s, d, o, sheetX) : {};
      let shownCandidates = 0, inTray = 0, onPodium = 0;
      for (const cid of DOC_IDS) {
        const card = refs.cards[cid], pl = plan[cid];
        let cpos = V(...refs.slots[cid]), vis = true, sc = 1, red = 0, lock = false;
        if (pl) ({ pos: cpos, vis, scale: sc, red, lock } = pl);
        // the changed document only reaches the index through the sync pipe during this search
        if (cid === freshId && o < order("search")) vis = false;
        else if (cid === freshId && id === "search" && t < 0.3) {
          const pipe = refs.pipes.sharepoint;
          cpos = t < 0.22 ? pipe.getPointAt(clamp(ease(phase(t, 0, 0.22)))) : pipe.getPointAt(1).lerp(V(...refs.slots[cid]), ease(phase(t, 0.22, 0.3)));
          sc = t < 0.22 ? 2.2 : lerp(2.2, 1, ease(phase(t, 0.22, 0.3)));
        }
        card.g.position.copy(cpos); card.g.visible = vis; card.g.scale.setScalar(sc); card.g.rotation.set(-0.25, 0.25, 0);
        const arriving = cid === freshId && id === "search" && t < 0.3;
        card.tint.emissive.set(colors[red ? "danger" : arriving ? "accent" : "paper"]); card.tint.emissiveIntensity = red ? 0.5 : arriving ? 0.6 : 0; card.lock.visible = lock;
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
          return { title: Z.DOCS[cid].title, source: Z.DOCS[cid].source, semantic: d.scores[cid].semantic, keyword: d.scores[cid].keyword, scored: true,
            access: accessKnown ? (sk ? "no" : "ok") : "", rank: rankKnown && r >= 0 ? r + 1 : 0, state: accessKnown && sk ? "skipped" : rankKnown && r < 0 ? "dropped" : "" };
        });
        const status = !accessKnown ? ["znaleziono " + d.candidates.length + " dokumenty kandydujące · wyszukiwanie hybrydowe", "line"]
          : !rankKnown ? (d.skipped.length ? ["pominięto " + d.skipped.length + " dokument – brak uprawnień użytkownika", "danger"] : ["użytkownik ma dostęp do wszystkich kandydatów", "ok"])
          : d.outcome === "nodata" ? ["brak wystarczających informacji – bez odpowiedzi spekulatywnej", "danger"] : ["do odpowiedzi: " + d.ranked.length + " najtrafniejsze dokumenty", "ok"];
        mv = { view: "results", rows, status: status[0], tone: status[1] };
      }
      drawMonitor(mv); info.monitorView = mv.view;
      // connectors: lamps blink while syncing; pulses travel down the pipes in the admin scene and for the fresh document
      const syncing = id === "admin" || (freshId && id === "search" && t < 0.3);
      refs.pipeGlow.opacity = syncing ? 0.9 : 0; refs.pipeGlow.emissiveIntensity = syncing ? 1.2 : 0;
      refs.srcLamps.forEach((m, i) => { m.emissiveIntensity = syncing ? 0.8 + 0.6 * Math.abs(Math.sin(t * 20 + i)) : 0.3; });
      refs.pipePulses.forEach((pulse, i) => {
        const sid = Z.SOURCE_IDS[i], on = id === "admin";
        pulse.visible = on; if (on) pulse.position.copy(refs.pipes[sid].getPointAt(((t * 1.6) + i / 3) % 1));
      });
      for (const sid of Z.SOURCE_IDS) refs.cloudMats[sid].emissiveIntensity = id === "admin" || (sid === "sharepoint" && syncing) ? 1.2 : 0;
      // local model at work: the chosen server slides out, takes question + sources in, its LED works (amber when abstaining)
      const work = id === "model" ? phase(t, 0.4, 0.55) : id === "return" ? 1 - phase(t, 0, 0.3) : 0;
      const slide = id === "model" ? ease(phase(t, 0.05, 0.25)) * (1 - ease(phase(t, 0.5, 0.65))) : id === "return" ? 1 - ease(phase(t, 0.3, 0.42)) : 0;
      const abstain = d && d.outcome === "nodata";
      refs.blades.forEach((b, i) => {
        const chosen = i === CAB.chosen;
        b.g.position.z = CAB.z + (chosen ? slide * 0.3 : 0);
        const c = colors[chosen && abstain && work > 0 ? "srcC" : "gpuLed"]; b.led.color.set(c); b.led.emissive.set(c);
        b.led.emissiveIntensity = chosen ? 0.15 + Math.max(work, id === "model" && t > 0.4 ? 1 : 0) * 1.6 : 0.15 + 0.1 * (i % 2);
      });
      info.blade = +slide.toFixed(2);
      refs.gateMat.emissiveIntensity = id === "admin" ? 0.8 : 0;
      return pos ? { pos, carrier, scale, node } : { node: "none" };
    }

    // ─── Camera, labels, diagnostics ───
    function shot(s, poseOut, follow, SHOTS) {
      const id = s.sceneId, t = s.t;
      if (id === "search") return t < 0.3 ? (s.decision && s.decision.fresh.length && t > 0.02 ? SHOTS.sources : SHOTS.rackOut) : SHOTS.search;
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
      build, buildPaths, pose, shot, labelVisible, collisionRuns,
      sig: s => (s.decision ? s.decision.ranked.join(",") + "|" + s.decision.skipped.join(",") : ""),
      animating: s => s.sceneId === "admin" || s.sceneId === "model" || s.sceneId === "return"
    };
  }
};
