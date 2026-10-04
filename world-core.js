/* World core – the shared 3D engine of the "… od środka" apps (Three.js 0.180, loaded on demand from the CDN).
   A product module (KlaraStations, ZaglobaStations) adds the stations inside the rack, its inner paths and their pose.
   The world is a pure function of a snapshot: { sceneId, t (0..1), prompt, decision, callouts, reduced, ... }.
   API: WorldCore.create(product) → { init({ stage, labels, onReady, onFail }), frame(snapshot, dt), resetView(), debugCollisions(), info() }
   Product: { config: { sceneOrder, openScene, travelScenes, shots, labels, anchors, colorKeys, ports, clouds, office: { windows, rug }, ariaLabel },
              create(kit) → { buildOffice, build, buildPaths, pose, shot, labelVisible, labelState, sig, animating, collisionRuns } }
   Colours come from --world-* tokens in the HTML shell; nothing here hardcodes a colour. */
window.WorldCore = (() => {
  "use strict";

  // ─── Constants ───
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
  const CORE_COLORS = ["paper", "cream", "ink", "wood", "metal", "upholstery", "pot", "leaf", "leafLight", "screen", "wall", "wallServer",
    "glass", "foundation", "edge", "officeFloor", "serverFloor", "tileLine", "background", "light", "sky", "bounce", "brand", "admin", "accent",
    "accentTint", "rack", "rackDark", "rackFace", "rackLine", "belt", "scan", "gpu", "gpuLed", "cloud", "hazard", "ok", "danger", "chipMasked",
    "cable", "keyboard", "lockMetal", "rug", "xrayBg", "xrayLine"];
  // The local route leaves the last station (x 10.9) for a turn in front of the GPU server cabinet, runs along it, then into the chosen server.
  const LOCAL_TURN = [11.45, 3.45], CAB = { x: 12.25, z: 2.75, chosen: 1 };
  // Shared geometry. The sheet's centre rides RIDE high inside the rack and FLOOR_RIDE above the floor cable (half-height ~0.16).
  const G = {
    FLOOR: 0.02, RIDE: 0.48, FLOOR_RIDE: 0.23, LANE_Z: 0.55, HOLE_TOP: 0.74, PORT_W: 0.44, PORT_Z: 1.74,
    DESK: { x: 2.6, z: 2.25 }, STAND: [2.6, 3.0], DOOR: [0.8, 5.6], MON: [2.6, 0.99, 2.24], ADMIN: { x: 5.9, z: 4.15 },
    INLET: [8.58, 0.48, 2.8], RACK: { cx: 10.6, cz: 2.8, w: 4.6, d: 2.2, h: 1.1 }, GATE: [11.25, 0.48, 0.06], GATE_X: [10.92, 11.58],
    LOCAL_TURN, CAB, GPU_IN: [12.25, 0.49, 2.95], LOCAL_RAILS: [[[11.08, 2.98], LOCAL_TURN], [LOCAL_TURN, [CAB.x - 0.3, LOCAL_TURN[1]]]]
  };
  const BASE_SHOTS = {
    over: { target: [7.2, 1.0, 1.8], span: 8.4, angle: 0.62, elev: 0.6 },
    monitor: { target: [2.6, 0.97, 2.1], span: 1.2, angle: 0.22, elev: 0.3 },
    rackOut: { target: [10.5, 0.6, 2.7], span: 3.9, angle: 0.62, elev: 0.6 },
    admin: { target: [5.9, 1.02, 4.05], span: 1.15, angle: 0.18, elev: 0.28 },
    gpu: { target: [12.0, 0.62, 3.0], span: 2.5, angle: 0.55, elev: 0.55 },
    office: { target: [1.5, 0.6, 4.0], span: 4.6, angle: 0.62, elev: 0.6 }, // the robot waiting at the door and the desk it walks to
    officeTall: { target: [1.7, 0.6, 3.9], span: 6.6, angle: 0.62, elev: 0.6 } // the same on a portrait screen, nearer the door
  };
  const BASE_LABELS = [
    { id: "desk", text: "Stanowisko pracownika", color: "brand", pos: [2.6, 1.5, 2.1], scenes: ["login", "send", "final"] },
    { id: "admin", text: "Panel administratora", color: "admin", pos: [5.9, 1.55, 4.1], scenes: ["login", "final"] },
    { id: "server", text: "Quantica AI Server", color: "brand", pos: [10.6, 1.5, 3.2], scenes: ["send", "final"] }
  ];
  // The message is a sheet of paper; attachments are PDFs clipped onto it.
  const SHEET = { w: 0.26, h: 0.34, tex: [512, 668], tilt: -0.6, facing: 0.25, scale: 1.15 };
  const PDF = { w: 0.17, h: 0.22, tex: [256, 332], max: 2 };
  const MSG_MARK_ROWS = [1, 3, 5], PDF_MARK_ROWS = [0, 1, 2, 3];
  const LIGHT_LIFT = [0, 0.3, 0.15]; // the carrier's glow light hovers above and in front of the sheet

  function create(product) {
    const P = product.config;
    const SCENE_ORDER = P.sceneOrder, SHOTS = { ...BASE_SHOTS, ...P.shots }, LABELS = [...BASE_LABELS, ...P.labels], ANCHORS = { server: [10.6, 1.2, 3.4], local: [12.25, 1.1, 2.95], ...P.anchors };
    const COLOR_KEYS = [...new Set([...CORE_COLORS, ...(P.colorKeys || [])])];

    // ─── State ───
    let THREE = null, renderer, scene, camera, world, stage, labelsEl, resizeObserver, sun, S = null;
    let width = 1, height = 1, options = {};
    const fonts = { ui: "sans-serif", mono: "monospace" }; // resolved from --font-ui / --font-mono in init
    const colors = {}, materials = {}, geometries = new Map(), refs = {}, paths = {};
    const view = { target: null, span: 8.4, angle: 0.62, elev: 0.6 };
    const user = { yaw: 0, zoom: 1, drag: null };
    let labelItems = [], lastSig = "", settled = false, coSvg = null, scratch = null;
    const callouts = new Map();
    const info = { renderer: "loading", packetNode: "none", frames: 0, renders: 0, robot: "", rackOpen: 0, camera: "", callouts: 0, attachments: 0, redactions: 0, blade: 0 };

    // ─── Helpers ───
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const phase = (t, a, b) => clamp((t - a) / (b - a));
    const ease = u => u * u * (3 - 2 * u);
    const easeOutBack = u => { const c = 1.6; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
    const lerp = (a, b, k) => a + (b - a) * k;
    const v3 = p => new THREE.Vector3(p[0], p[1], p[2]);
    const order = id => SCENE_ORDER.indexOf(id);
    // A canvas font string from the UI or mono token, e.g. font(700, 34) or font(500, 24, true).
    const font = (weight, px, mono = false) => weight + " " + px + "px " + (mono ? fonts.mono : fonts.ui);

    function material(name) {
      if (materials[name]) return materials[name];
      const isScreen = name === "screen", isMetal = name === "metal" || name === "lockMetal";
      return (materials[name] = new THREE.MeshStandardMaterial({ color: colors[name] || colors.paper, roughness: isScreen ? 0.3 : 0.72, metalness: isMetal ? 0.42 : 0.03 }));
    }
    // A private material for anything that animates colour, glow or opacity.
    function own(name, extra = {}) {
      return new THREE.MeshStandardMaterial({ color: colors[name] || colors.paper, roughness: 0.6, metalness: 0.05, ...extra });
    }
    function mesh(geometry, mat, parent = world) {
      const m = new THREE.Mesh(geometry, typeof mat === "string" ? material(mat) : mat);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    function geo(kind, values, make) {
      const key = kind + ":" + values.join(",");
      if (!geometries.has(key)) geometries.set(key, make());
      return geometries.get(key);
    }
    function box(x, z, w, d, h, mat, y = 0, parent = world, bevel = 0) {
      let g;
      if (bevel) {
        const s = new THREE.Shape(), r = Math.min(bevel, w / 4, d / 4);
        s.moveTo(-w / 2 + r, -d / 2); s.lineTo(w / 2 - r, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
        s.lineTo(w / 2, d / 2 - r); s.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); s.lineTo(-w / 2 + r, d / 2);
        s.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); s.lineTo(-w / 2, -d / 2 + r); s.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
        g = geo("bevel", [w, d, h, r], () => { const e = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 }); e.rotateX(-Math.PI / 2); e.translate(0, -h / 2, 0); return e; });
      } else g = geo("box", [w, h, d], () => new THREE.BoxGeometry(w, h, d));
      const m = mesh(g, mat, parent); m.position.set(x, y + h / 2, z); return m;
    }
    function cylinder(x, z, r, h, mat, y = 0, parent = world, rTop = r, seg = 20) {
      const m = mesh(geo("cyl", [rTop, r, h, seg], () => new THREE.CylinderGeometry(rTop, r, h, seg)), mat, parent);
      m.position.set(x, y + h / 2, z); return m;
    }
    function sphere(x, y, z, r, mat, parent = world, sx = 1, sy = 1, sz = 1) {
      const m = mesh(geo("sph", [r], () => new THREE.SphereGeometry(r, 14, 10)), mat, parent);
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
    }
    function group(x = 0, y = 0, z = 0, parent = world) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
    // Flat strip between two floor points (rails, trenches).
    function strip(a, b, w, h, mat, y) {
      const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
      const m = box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len, w, h, mat, y);
      m.rotation.y = -Math.atan2(dz, dx); return m;
    }
    function canvasTexture(w, h, draw) {
      const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }
    function hexPath(ctx, cx, cy, r) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      ctx.closePath();
    }
    // The Quantica Q mark: a hexagon ring with a tail, white on brand pink.
    function drawQ(ctx, x, y, s) {
      ctx.fillStyle = colors.brand; ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = colors.paper; ctx.lineWidth = s * 0.11; ctx.lineJoin = "round"; ctx.lineCap = "round";
      hexPath(ctx, x + s * 0.47, y + s * 0.45, s * 0.27); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s * 0.58, y + s * 0.62); ctx.lineTo(x + s * 0.8, y + s * 0.8); ctx.stroke();
    }
    // Polyline + optional smooth flight segments; `segments` = [{ line: [...pts] } | { curve: [...pts] }].
    function makePath(segments) {
      const cp = new THREE.CurvePath();
      for (const seg of segments) {
        if (seg.curve) cp.add(new THREE.CatmullRomCurve3(seg.curve.map(v3)));
        else for (let i = 0; i < seg.line.length - 1; i++) cp.add(new THREE.LineCurve3(v3(seg.line[i]), v3(seg.line[i + 1])));
      }
      return cp;
    }
    const reverseSegments = segs => segs.slice().reverse().map(s => s.curve ? { curve: s.curve.slice().reverse() } : { line: s.line.slice().reverse() });
    // Deterministic pseudo-random numbers so fake text looks the same on every load.
    function seeded(seed) {
      return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }
    function pill(c, x, y, w, h) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, h / 2); else c.rect(x, y, w, h); c.fill(); }
    // Unreadable "text": rows of rounded word strokes. Returns the rows so highlights can sit on real words.
    function fakeText(c, x, y, widthPx, count, gap, thick, rnd) {
      const rows = [];
      for (let i = 0; i < count; i++) {
        const lineW = i === count - 1 ? widthPx * (0.35 + rnd() * 0.25) : widthPx * (0.84 + rnd() * 0.16), words = [];
        for (let cx = x; cx < x + lineW - 12;) { const ww = Math.min(x + lineW - cx, 22 + rnd() * 70); pill(c, cx, y + i * gap - thick / 2, ww, thick); words.push([cx, cx + ww]); cx += ww + 11 + rnd() * 7; }
        rows.push({ y: y + i * gap, words });
      }
      return rows;
    }
    // Paint a highlight bar: state none | found (red) | masked (black) | keyword (accent).
    function paintMark(mk, state, pulse = 0) {
      mk.bar.visible = state !== "none"; if (!mk.bar.visible) return;
      const c = colors[state === "masked" ? "ink" : state === "keyword" ? "accent" : "danger"];
      mk.m.color.set(c); mk.m.emissive.set(c); mk.m.emissiveIntensity = state === "masked" ? 0 : 0.45 + pulse;
    }

    // ─── Build: room shell ───
    function buildRooms() {
      const { FLOOR, HOLE_TOP, LANE_Z, GATE_X } = G;
      box(7.0, 3.0, 14.5, 6.5, 0.24, "foundation", -0.24, world, 0.06);
      box(3.75, 3.0, 7.5, 6.0, FLOOR, "officeFloor");
      box(10.85, 3.0, 6.7, 6.0, FLOOR, "serverFloor");
      for (let x = 8.1; x < 14.2; x += 0.6) box(x, 3.0, 0.012, 6.0, 0.004, "tileLine", FLOOR);
      for (let z = 0.6; z < 6; z += 0.6) box(10.85, z, 6.7, 0.012, 0.004, "tileLine", FLOOR);
      const rug = P.office && "rug" in P.office ? P.office.rug : [2.6, 2.95, 4.6, 2.3];
      if (rug) box(rug[0], rug[1], rug[2], rug[3], 0.006, "rug", FLOOR);
      // walls: office back + left, server back with an opening to the outside world
      box(3.75, 0.06, 7.5, 0.12, 1.1, "wall");
      box(0.06, 3.0, 0.12, 6.0, 1.1, "wall");
      const win = { count: 4, w: 1.15, h: 0.5, y: 0.4, ...(P.office && P.office.windows) }, pitch = 7.0 / win.count;
      for (let i = 0; i < win.count; i++) box(0.12 + pitch * (i + 0.5), 0.125, win.w, 0.02, win.h, "glass", win.y);
      const [gx0, gx1] = GATE_X;
      box((7.5 + gx0) / 2, 0.06, gx0 - 7.5, 0.12, 1.1, "wallServer");
      box((gx1 + 14.2) / 2, 0.06, 14.2 - gx1, 0.12, 1.1, "wallServer");
      box((gx0 + gx1) / 2, 0.06, gx1 - gx0, 0.12, 1.1 - HOLE_TOP, "wallServer", HOLE_TOP);
      // glass partition between office and server room (door gap at z 4.4–5.4), with a cable pass-through in the lane
      const glass = own("glass", { transparent: true, opacity: 0.32, depthWrite: false });
      const pass = [LANE_Z - 0.26, LANE_Z + 0.26], passTop = 0.52;
      for (const [z0, z1] of [[0.12, pass[0]], [pass[1], 4.4], [5.4, 6.0]]) {
        box(7.55, (z0 + z1) / 2, 0.04, z1 - z0, 1.0, glass);
        for (const z of [z0, z1]) box(7.55, z, 0.07, 0.07, 1.05, "metal");
      }
      box(7.55, LANE_Z, 0.04, pass[1] - pass[0], 1.0 - passTop, glass, passTop);
      box(7.55, LANE_Z, 0.07, pass[1] - pass[0], 0.04, "metal", passTop - 0.04);
      box(7.55, 3.0, 0.07, 5.88, 0.05, "metal", 1.0);
      // gate frame in the server back wall
      refs.gateMat = own("ok", { emissive: colors.ok, emissiveIntensity: 0 });
      box(gx0 + 0.03, 0.16, 0.06, 0.12, HOLE_TOP, refs.gateMat); box(gx1 - 0.03, 0.16, 0.06, 0.12, HOLE_TOP, refs.gateMat);
      box((gx0 + gx1) / 2, 0.16, gx1 - gx0, 0.12, 0.06, refs.gateMat, HOLE_TOP);
    }

    // ─── Build: office ───
    // A desk with a monitor; the user sits on the +z side (rot turns it around its centre).
    function deskAt(x, z, screenMat, rot = 0) {
      screenMat = screenMat || (refs.deskScreenMat ??= own("screen", { emissive: colors.screen, emissiveIntensity: 0.2 }));
      const g = group(x, 0, z); g.rotation.y = rot;
      box(0, 0, 1.3, 0.66, 0.05, "wood", 0.7, g, 0.03);
      for (const dx of [-0.6, 0.6]) for (const dz of [-0.28, 0.28]) box(dx, dz, 0.05, 0.05, 0.7, "metal", 0, g);
      cylinder(0, -0.18, 0.012, 0.12, "metal", 0.75, g);
      box(0, -0.2, 0.64, 0.04, 0.4, "ink", 0.84, g, 0.015);
      const screen = new THREE.Mesh(geo("plane", [0.58, 0.34], () => new THREE.PlaneGeometry(0.58, 0.34)), screenMat);
      screen.position.set(0, 1.04, -0.177); g.add(screen);
      box(0, 0.06, 0.42, 0.14, 0.015, "keyboard", 0.75, g);
      return screen;
    }
    function plant(x, z, s = 1) {
      cylinder(x, z, 0.13 * s, 0.24 * s, "pot", 0, world, 0.16 * s);
      sphere(x, 0.42 * s, z, 0.17 * s, "leaf", world, 1, 1.3); sphere(x + 0.08 * s, 0.55 * s, z + 0.04, 0.12 * s, "leafLight", world);
      sphere(x - 0.07 * s, 0.6 * s, z - 0.03, 0.1 * s, "leaf", world);
    }
    function chair(x, z, rot = 0) {
      const g = group(x, 0, z); g.rotation.y = rot;
      cylinder(0, 0, 0.13, 0.04, "metal", 0.02, g); cylinder(0, 0, 0.03, 0.26, "metal", 0.04, g);
      box(0, 0, 0.32, 0.32, 0.06, "upholstery", 0.3, g, 0.03); box(0, -0.15, 0.32, 0.05, 0.34, "upholstery", 0.36, g, 0.02);
    }
    // The engine builds the employee's desk and the admin console; the product furnishes the rest (S.buildOffice).
    function buildOffice() {
      const { DESK, ADMIN } = G;
      refs.screenMat = own("screen", { emissive: colors.screen, emissiveIntensity: 0.25, roughness: 0.3 });
      refs.mainScreen = deskAt(DESK.x, DESK.z, refs.screenMat);
      plant(7.1, 5.6, 1.15); plant(7.15, 3.4, 0.9); // by the glass partition
      if (S.buildOffice) S.buildOffice();
      box(ADMIN.x, ADMIN.z, 0.5, 0.36, 0.78, "rack", 0, world, 0.04);
      const head = group(ADMIN.x, 0.86, ADMIN.z); head.rotation.x = -0.5;
      box(0, 0, 0.62, 0.05, 0.4, "ink", -0.2, head, 0.015);
      refs.adminMat = own("admin", { emissive: colors.admin, emissiveIntensity: 0.3 });
      const scr = new THREE.Mesh(geo("plane", [0.56, 0.34], () => new THREE.PlaneGeometry(0.56, 0.34)), refs.adminMat); scr.position.set(0, 0, 0.028); head.add(scr);
    }
    // ─── Build: robots (port of the Explore the Floor concierge) ───
    function buildRobot(accent) {
      const g = group(); const limbs = [];
      box(0, 0, 0.25, 0.17, 0.25, accent, 0.26, g, 0.04); box(0, 0, 0.29, 0.21, 0.21, "paper", 0.54, g, 0.04);
      box(0, 0.111, 0.22, 0.012, 0.105, "ink", 0.592, g, 0.022);
      for (const s of [-1, 1]) sphere(s * 0.06, 0.647, 0.124, 0.02, "screen", g);
      cylinder(0, 0, 0.045, 0.035, "metal", 0.515, g); cylinder(0, 0, 0.012, 0.085, "metal", 0.74, g); sphere(0, 0.834, 0, 0.025, accent, g);
      for (const s of [-1, 1]) {
        const leg = group(s * 0.074, 0.27, 0, g); box(0, 0, 0.075, 0.09, 0.19, "ink", -0.19, leg, 0.018); box(0, 0.027, 0.085, 0.15, 0.055, "paper", -0.255, leg, 0.02); limbs.push(leg);
        const arm = group(s * 0.17, 0.49, 0, g); box(0, 0, 0.065, 0.08, 0.19, "paper", -0.19, arm, 0.025); limbs.push(arm);
      }
      return { g, limbs };
    }

    // ─── Build: Quantica AI Server shell (cutaway rack with real openings) ───
    function buildRackShell() {
      const { FLOOR, HOLE_TOP, PORT_W, RACK } = G, { cx, cz, w, d, h } = RACK;
      box(cx, cz, w, d, 0.12, "rackDark", FLOOR, world, 0.03);
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, base = FLOOR + 0.12;
      // back panel with port openings (product-defined)
      const ports = (P.ports || []).map(x => [x - PORT_W / 2, x + PORT_W / 2]).sort((a, b) => a[0] - b[0]);
      let start = x0;
      for (const [a, b] of ports) { box((start + a) / 2, z0 + 0.04, a - start, 0.08, h, "rack", FLOOR); start = b; }
      box((start + x1) / 2, z0 + 0.04, x1 - start, 0.08, h, "rack", FLOOR);
      for (const [a, b] of ports) {
        box((a + b) / 2, z0 + 0.04, b - a, 0.08, FLOOR + h - HOLE_TOP, "rack", HOLE_TOP);
        box((a + b) / 2, z0 + 0.04, b - a, 0.08, base - FLOOR, "rack", FLOOR);
        box((a + b) / 2, z0 + 0.085, b - a + 0.04, 0.012, 0.03, "metal", HOLE_TOP - 0.03);
      }
      // left side panel with the cable inlet
      const inlet = [cz - 0.25, cz + 0.25];
      for (const [a, b] of [[z0, inlet[0]], [inlet[1], z1]]) box(x0 + 0.04, (a + b) / 2, 0.08, b - a, h, "rack", FLOOR);
      box(x0 + 0.04, cz, 0.08, inlet[1] - inlet[0], FLOOR + h - HOLE_TOP, "rack", HOLE_TOP);
      box(x0 + 0.04, cz, 0.08, inlet[1] - inlet[0], base - FLOOR, "rack", FLOOR);
      box(x0 - 0.005, cz, 0.012, inlet[1] - inlet[0] + 0.04, 0.03, "metal", HOLE_TOP - 0.03);
      box(x1 - 0.04, cz, 0.08, d, h, "rack", FLOOR);
      // lid + front cover open when the journey goes inside
      refs.lidMat = own("rackFace", { transparent: true, opacity: 1 });
      refs.lid = box(cx, cz, w + 0.02, d + 0.02, 0.06, refs.lidMat, FLOOR + h); refs.lidY = refs.lid.position.y;
      const face = canvasTexture(1024, 256, (c, W, H) => {
        c.fillStyle = colors.rackFace; c.fillRect(0, 0, W, H);
        c.strokeStyle = colors.rackLine; c.lineWidth = 7;
        for (let row = -1; row < 4; row++) for (let col = -1; col < 14; col++) { hexPath(c, col * 86 + (row % 2 ? 43 : 0), row * 74 + 40, 46); c.stroke(); }
        c.fillStyle = colors.rackFace; c.fillRect(W / 2 - 112, 22, 224, 212);
        drawQ(c, W / 2 - 96, 38, 180);
        c.fillStyle = colors.scan; c.fillRect(34, 70, 10, 110);
        c.fillStyle = colors.ink; c.fillRect(W - 300, H - 70, 262, 44);
        c.fillStyle = colors.paper; c.font = font(600, 26); c.fillText("Quantica AI Server", W - 286, H - 39);
      });
      const side = own("rackFace", { transparent: true, opacity: 1 }), front = own("paper", { map: face, transparent: true, opacity: 1 });
      refs.frontMats = [side, side, side, side, front, side];
      refs.front = mesh(geo("box", [w + 0.02, h, 0.06], () => new THREE.BoxGeometry(w + 0.02, h, 0.06)), refs.frontMats);
      refs.front.position.set(cx, FLOOR + h / 2, z1 + 0.01); refs.frontZ = refs.front.position.z; // closed places: pose() opens from them
      // the belt from the inlet, and two spare racks behind the GPU bay
      belt(8.475, 10.925);
      for (const x of [13.55, 13.9]) box(x, 0.6, 0.32, 0.7, 1.0, "rack", FLOOR, world, 0.02);
    }
    // A monitor or board perched on the rack's back panel: a clamp over the panel's top edge and a neck under the screen's centre,
    // so the screen can turn towards the viewer without its mount leaving the panel. The face (faceMat on a W × H plane) sits in the frame.
    function rackMonitor(x, W, H, rot, faceMat) {
      const { FLOOR, RACK } = G, top = FLOOR + RACK.h, wallZ = RACK.cz - RACK.d / 2 + 0.04, lift = 0.17;
      box(x, wallZ, 0.24, 0.14, 0.03, "rackDark", top, world, 0.01);
      for (const dz of [-0.065, 0.065]) box(x, wallZ + dz, 0.24, 0.012, 0.09, "rackDark", top - 0.06);
      cylinder(x, wallZ, 0.026, lift, "metal", top + 0.03);
      const g = group(x, top + lift, wallZ); g.rotation.y = rot;
      box(0, -0.035, 0.16, 0.05, 0.1, "metal", -0.01, g);
      box(0, 0, W + 0.06, 0.05, H + 0.06, "rackDark", -0.03, g, 0.02);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), faceMat); face.position.set(0, H / 2, 0.03); g.add(face);
      return g;
    }
    // Live preview screen on the rack: a mono title and divider on the screen background; the product draws the body.
    // Returns update(state), which redraws only when the state changed.
    function rackScreen(x, title, drawBody) {
      const tex = canvasTexture(1024, 610, () => {}), c = tex.image.getContext("2d"), { width: W, height: H } = tex.image;
      rackMonitor(x, 1.3, 0.775, 0.32, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      let last = "";
      return st => {
        const key = JSON.stringify(st); if (key === last) return; last = key;
        c.fillStyle = colors.xrayBg; c.fillRect(0, 0, W, H);
        c.fillStyle = colors.xrayLine; c.font = font(700, 30, true); c.fillText(title, 30, 48);
        c.globalAlpha = 0.25; c.fillRect(30, 64, W - 60, 2); c.globalAlpha = 1;
        drawBody(c, st, W); tex.needsUpdate = true;
      };
    }
    // Static board on the rack: an admin header bar, then one framed row per item (drawRow(c, row, y, w, i) fills it in).
    // rowY(i) is a row's centre height in g, for lamps and highlights.
    function rackBoard(x, title, rows, drawRow) {
      const W = 1.56, H = 0.66, TH = 432, rowPx = i => 140 + i * 104;
      const tex = canvasTexture(1024, TH, (c, w) => {
        c.fillStyle = colors.rackFace; c.fillRect(0, 0, w, TH);
        c.fillStyle = colors.admin; c.fillRect(0, 0, w, 74);
        c.fillStyle = colors.paper; c.font = font(700, 34); c.fillText(title, 32, 49);
        rows.forEach((row, i) => { const y = rowPx(i); c.strokeStyle = colors.rackLine; c.lineWidth = 2; c.strokeRect(20, y - 44, w - 40, 88); drawRow(c, row, y, w, i); });
      });
      const g = rackMonitor(x, W, H, 0, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
      return { g, W, H, rowY: i => H / 2 - (rowPx(i) - TH / 2) / TH * H };
    }
    // A padlock: a body and a half-ring shackle, scaled by size.
    function padlock(x, y, z, tone, size = 1, parent = world) {
      const lock = group(x, y, z, parent); box(0, 0, 0.11 * size, 0.05 * size, 0.09 * size, tone, -0.045 * size, lock, 0.015 * size);
      const shackle = new THREE.Mesh(geo("lockArc", [size], () => new THREE.TorusGeometry(0.035 * size, 0.01 * size, 8, 16, Math.PI)), material(tone));
      shackle.position.y = 0.045 * size; lock.add(shackle); return lock;
    }
    // Belt from the inlet along the rack's centre line.
    function belt(x0, x1) {
      const { FLOOR, RACK } = G;
      box((x0 + x1) / 2, RACK.cz, x1 - x0, 0.34, 0.1, "belt", FLOOR + 0.12);
      for (const z of [RACK.cz - 0.18, RACK.cz + 0.18]) box((x0 + x1) / 2, z, x1 - x0, 0.03, 0.14, "metal", FLOOR + 0.12);
      for (let x = x0 + 0.13; x < x1; x += 0.3) box(x, RACK.cz, 0.02, 0.34, 0.003, "rackLine", FLOOR + 0.22);
    }
    // Numbered floor plates in front of stations: [x, n, title, tone].
    function plates(list) {
      for (const [x, n, title, tone] of list) {
        const tex = canvasTexture(512, 192, (c, w, h) => {
          c.fillStyle = colors.rackFace; c.fillRect(0, 0, w, h);
          c.fillStyle = colors[tone]; c.fillRect(0, 0, 14, h); c.beginPath(); c.arc(86, h / 2, 52, 0, Math.PI * 2); c.fill();
          c.fillStyle = colors.paper; c.font = font(700, 64); c.fillText(n, 68, h / 2 + 23);
          c.font = font(700, title.length > 13 ? 40 : 46); c.fillText(title, 160, h / 2 + 16, w - 170);
        });
        const plate = new THREE.Mesh(geo("plane", [0.72, 0.27], () => new THREE.PlaneGeometry(0.72, 0.27)), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
        plate.rotation.x = -Math.PI / 2; plate.position.set(x, G.FLOOR + 0.125, 3.52); plate.receiveShadow = true; world.add(plate);
      }
    }
    // The local GPU bay: rails from the last station to the cabinet of GPU servers (one local model each, fronts facing
    // the viewer; the chosen server slides out), and the cabinet itself. Returns its blades.
    function localBay() {
      for (const [a, b] of G.LOCAL_RAILS) strip(a, b, 0.2, 0.04, "belt", G.FLOOR + 0.12);
      const { x, z } = CAB, base = G.FLOOR + 0.12;
      for (const [dx, dz] of [[-0.39, -0.32], [0.39, -0.32], [-0.39, 0.32], [0.39, 0.32]]) box(x + dx, z + dz, 0.05, 0.05, 0.95, "metal", base);
      box(x, z, 0.84, 0.7, 0.04, "rackDark", base + 0.91); box(x, z, 0.84, 0.7, 0.04, "rackDark", base);
      box(x, z - 0.33, 0.84, 0.03, 0.91, "rackDark", base);
      return [0, 1, 2, 3].map(i => {
        const g = group(x, base + 0.06 + i * 0.21, z);
        box(0, 0, 0.7, 0.6, 0.16, "gpu", 0, g, 0.02);
        const led = own("gpuLed", { emissive: colors.gpuLed, emissiveIntensity: 0.15 });
        box(0, 0.302, 0.62, 0.01, 0.025, led, 0.02, g);
        const tex = canvasTexture(512, 64, (c, w) => { c.fillStyle = colors.gpu; c.fillRect(0, 0, w, 64); c.fillStyle = colors.rackLine; c.font = font(700, 34); c.textAlign = "center"; c.fillText("MODEL LOKALNY " + (i + 1), w / 2, 44); });
        const lab = new THREE.Mesh(geo("plane", [0.6, 0.075], () => new THREE.PlaneGeometry(0.6, 0.075)), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); lab.position.set(0, 0.11, 0.304); g.add(lab);
        // the chosen server swallows the sheet, so it is exempt from the collision check
        if (i === CAB.chosen) g.traverse(o => { o.userData.noCollide = true; });
        return { g, led, z };
      });
    }
    // Segments of the local route from the last station into the chosen server.
    const localRoute = from => [{ line: [from, [LOCAL_TURN[0], G.RIDE, LOCAL_TURN[1]], [CAB.x, G.RIDE, LOCAL_TURN[1]], G.GPU_IN] }];
    // Straight legs between consecutive stations, e.g. legs([INLET, A, B]) → [INLET→A, A→B].
    const legs = pts => pts.slice(1).map((p, i) => makePath([{ line: [pts[i], p] }]));
    // Way back for the answer: the outbound segments, the stations (inside, a point list) and the send path, all reversed.
    const returnPath = (out, inside) => makePath([...reverseSegments(out), ...reverseSegments([{ line: inside }]), ...reverseSegments(paths.sendSegments)]);

    // ─── Pose helpers for products ───
    // The sheet rides `path` between t = a and b, then rests at `node`.
    const ride = (path, t, a, b, node, carrier = "packet") => ({ pos: path.getPointAt(clamp(ease(phase(t, a, b)))), carrier, node: t >= b ? node : "moving" });
    // The chosen GPU server swallows the sheet (model) and hands back the answer (return).
    const swallowScale = (id, t) => (id === "model" ? 1 - 0.97 * ease(phase(t, 0.28, 0.4)) : id === "return" ? 0.03 + 0.97 * ease(phase(t, 0.02, 0.14)) : 1);
    // Local model at work: the chosen server slides out, takes the sheet in, its LED works (in ledTone). Inactive = the route went elsewhere.
    function poseCabinet(blades, id, t, { active = true, ledTone = "gpuLed" } = {}) {
      const work = !active ? 0 : id === "model" ? phase(t, 0.4, 0.55) : id === "return" ? 1 - phase(t, 0, 0.3) : 0;
      const slide = !active ? 0 : id === "model" ? ease(phase(t, 0.05, 0.25)) * (1 - ease(phase(t, 0.5, 0.65))) : id === "return" ? 1 - ease(phase(t, 0.3, 0.42)) : 0;
      blades.forEach((b, i) => {
        const chosen = i === CAB.chosen, c = colors[chosen && work > 0 ? ledTone : "gpuLed"];
        b.g.position.z = b.z + (chosen ? slide * 0.3 : 0); b.led.color.set(c); b.led.emissive.set(c);
        b.led.emissiveIntensity = chosen ? 0.15 + Math.max(work, active && id === "model" && t > 0.4 ? 1 : 0) * 1.6 : 0.15 + 0.1 * (i % 2);
      });
      info.blade = +slide.toFixed(2);
      return slide;
    }

    // ─── Build: clouds outside the building (external models or data sources) ───
    function buildClouds() {
      refs.cloudMats = {}; refs.clouds = {};
      for (const c of P.clouds || []) {
        const [x, y, z] = c.pos, g = group(x, y, z);
        for (const [dx, dy, dz, r] of [[0, 0, 0, 0.55], [0.5, -0.05, 0.1, 0.42], [-0.5, -0.05, -0.05, 0.4], [0.15, 0.15, -0.3, 0.45], [-0.2, -0.1, 0.35, 0.38]])
          sphere(dx, dy, dz, r, "cloud", g, 1, 0.62, 1);
        box(0, 0.05, 0.5, 0.42, 0.26, "rackDark", 0.2, g, 0.04);
        if (c.emblem === "q") {
          const tex = canvasTexture(128, 128, ctx => drawQ(ctx, 0, 0, 128));
          const tile = new THREE.Mesh(geo("plane", [0.28, 0.28], () => new THREE.PlaneGeometry(0.28, 0.28)), new THREE.MeshStandardMaterial({ map: tex }));
          tile.rotation.x = -Math.PI / 2; tile.position.set(0, 0.465, 0.05); g.add(tile);
        } else if (c.emblem === "docs") {
          for (let i = 0; i < 3; i++) { const d = box(-0.08 + i * 0.08, 0.05 - i * 0.02, 0.16, 0.2, 0.02, i === 2 ? c.ring : "paper", 0.46 + i * 0.022, g, 0.01); d.rotation.y = (i - 1) * 0.15; }
        } else (c.cubes || []).forEach((col, i) => box(-0.14 + i * 0.14, 0.05, 0.1, 0.1, 0.1, col, 0.46, g, 0.02));
        refs.cloudMats[c.key] = own(c.ring, { emissive: colors[c.ring], emissiveIntensity: 0, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(geo("ring", [0.62, 0.7, 40], () => new THREE.RingGeometry(0.62, 0.7, 40)), refs.cloudMats[c.key]); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.2; g.add(ring);
        refs.clouds[c.key] = g;
      }
    }

    // ─── Build: send path, cable, walk ───
    function buildSendPath() {
      const { MON, FLOOR_RIDE, LANE_Z, RIDE, INLET, FLOOR } = G;
      const hop = [MON, [2.6, 1.46, MON[2]], [2.6, 1.46, 1.6]];
      const send = [{ line: [...hop, [2.6, FLOOR_RIDE, 1.6], [2.6, FLOOR_RIDE, LANE_Z], [7.95, FLOOR_RIDE, LANE_Z], [7.95, FLOOR_RIDE, 2.8], [7.95, RIDE, 2.8], INLET] }];
      const cablePts = [[2.6, 0.92, 2.0], [2.6, 0.92, 1.6], [2.6, 0.06, 1.6], [2.6, 0.06, LANE_Z], [7.95, 0.06, LANE_Z], [7.95, 0.06, 2.8], [8.1, 0.06, 2.8], [8.1, 0.3, 2.8], [8.45, 0.3, 2.8]];
      paths.sendSegments = send; paths.send = makePath(send);
      const cable = makePath([{ line: cablePts }]);
      mesh(new THREE.TubeGeometry(cable, 260, 0.024, 6, false), "cable").userData.noCollide = true;
      refs.glowMat = own("accent", { emissive: colors.accent, emissiveIntensity: 1.1, transparent: true, opacity: 0.85 });
      refs.glow = new THREE.Mesh(new THREE.TubeGeometry(cable, 260, 0.032, 6, false), refs.glowMat); refs.glow.userData.noCollide = true; world.add(refs.glow);
      refs.glowCount = refs.glow.geometry.index.count; refs.sendLen = paths.send.getLength(); refs.hopLen = makePath([{ line: hop }]).getLength();
      paths.walk = makePath([{ line: [[G.DOOR[0], FLOOR, G.DOOR[1]], [1.5, FLOOR, 4.7], [2.6, FLOOR, 3.75], [G.STAND[0], FLOOR, G.STAND[1]]] }]);
    }

    // ─── Build: the message sheet, attachments and the answer ───
    const toPlane = (px, py, [tw, th], w, h) => [(px / tw - 0.5) * w, (0.5 - py / th) * h];
    function sheetTexture(accent, rows, seed) {
      let layout = null;
      const tex = canvasTexture(SHEET.tex[0], SHEET.tex[1], (c, w, h) => {
        c.fillStyle = colors.paper; c.fillRect(0, 0, w, h);
        c.fillStyle = colors[accent]; c.fillRect(0, 0, w, 16); c.beginPath(); c.arc(62, 72, 22, 0, Math.PI * 2); c.fill();
        c.fillStyle = colors.ink; pill(c, 100, 60, 190, 24);
        c.fillStyle = colors.rackLine; layout = fakeText(c, 40, 150, w - 80, rows, 60, 16, seeded(seed));
      });
      return { tex, layout };
    }
    function pdfTexture(seed) {
      let layout = null;
      const tex = canvasTexture(PDF.tex[0], PDF.tex[1], (c, w) => {
        c.fillStyle = colors.paper; c.fillRect(0, 0, w, PDF.tex[1]);
        c.fillStyle = colors.cream; c.beginPath(); c.moveTo(w - 54, 0); c.lineTo(w, 54); c.lineTo(w - 54, 54); c.closePath(); c.fill();
        c.fillStyle = colors.danger; c.beginPath(); if (c.roundRect) c.roundRect(18, 22, 86, 40, 8); else c.rect(18, 22, 86, 40); c.fill();
        c.fillStyle = colors.paper; c.font = font(800, 26); c.fillText("PDF", 33, 52);
        c.fillStyle = colors.rackLine; layout = fakeText(c, 20, 104, w - 40, 6, 36, 11, seeded(seed));
      });
      return { tex, layout };
    }
    // Highlight bars over chosen words: painted by the product (found, masked, keyword).
    function markBars(parent, layout, rowIdx, texSize, w, h, thick) {
      return rowIdx.map(r => {
        const row = layout[Math.min(r, layout.length - 1)], word = row.words.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
        const [x0] = toPlane(word[0] - 5, row.y, texSize, w, h), [x1, y] = toPlane(word[1] + 5, row.y, texSize, w, h);
        const m = own("danger", { emissive: colors.danger, emissiveIntensity: 0.4 });
        const bar = box((x0 + x1) / 2, 0.0025, x1 - x0, 0.002, thick, m, y - thick / 2, parent); bar.castShadow = false; bar.visible = false;
        return { bar, m };
      });
    }
    function paperclip(parent, x, y) {
      const pts = [[0, -0.05], [0, 0.03], [0.009, 0.042], [0.018, 0.03], [0.018, -0.038], [0.012, -0.046], [0.006, -0.038], [0.006, 0.018]].map(([px, py]) => new THREE.Vector3(px, py, 0));
      const clip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0028, 6, false), material("metal"));
      clip.position.set(x, y, 0.004); parent.add(clip);
    }
    function buildSheet(accent, edgeMat, seed, rows) {
      const g = group(), tilt = group(0, 0, 0, g); tilt.rotation.x = SHEET.tilt;
      const edge = new THREE.Mesh(geo("plane", [SHEET.w + 0.024, SHEET.h + 0.024], () => new THREE.PlaneGeometry(SHEET.w + 0.024, SHEET.h + 0.024)), edgeMat);
      edge.position.z = -0.003; tilt.add(edge);
      const { tex, layout } = sheetTexture(accent, rows, seed);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(SHEET.w, SHEET.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
      face.castShadow = true; tilt.add(face);
      return { g, tilt, layout };
    }
    function buildPacket() {
      refs.packetMat = own("accent", { emissive: colors.accent, emissiveIntensity: 0.9 });
      const msg = buildSheet("accent", refs.packetMat, 7, 8);
      refs.packet = msg.g;
      refs.msgMarks = markBars(msg.tilt, msg.layout, MSG_MARK_ROWS, SHEET.tex, SHEET.w, SHEET.h, 0.026);
      refs.pdfs = [];
      for (let i = 0; i < PDF.max; i++) {
        const pg = group(0.075 + i * 0.03, -0.07 - i * 0.025, 0.008 - i * 0.004, msg.tilt); pg.rotation.z = -0.12 + i * 0.1;
        const shadow = new THREE.Mesh(geo("plane", [PDF.w + 0.01, PDF.h + 0.01], () => new THREE.PlaneGeometry(PDF.w + 0.01, PDF.h + 0.01)), material("chipMasked"));
        shadow.position.set(0.004, -0.004, -0.001); pg.add(shadow);
        const { tex, layout } = pdfTexture(31 + i * 17);
        pg.add(new THREE.Mesh(new THREE.PlaneGeometry(PDF.w, PDF.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })));
        paperclip(pg, 0.004, PDF.h / 2 - 0.01);
        refs.pdfs.push({ g: pg, marks: i === 0 ? markBars(pg, layout, PDF_MARK_ROWS, PDF.tex, PDF.w, PDF.h, 0.018) : [] });
      }
      const answerEdge = own("ok", { emissive: colors.ok, emissiveIntensity: 0.9 });
      refs.answer = buildSheet("ok", answerEdge, 11, 6).g;
      refs.allMarks = [...refs.msgMarks, ...refs.pdfs.flatMap(pdf => pdf.marks)];
      refs.light = new THREE.PointLight(colors.accent, 0, 1.6, 1.6); world.add(refs.light);
      refs.packet.visible = refs.answer.visible = false;
    }

    function buildLabels() {
      labelsEl.replaceChildren(); labelItems = []; callouts.clear();
      coSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); coSvg.setAttribute("class", "co-lines"); coSvg.setAttribute("aria-hidden", "true");
      labelsEl.appendChild(coSvg);
      for (const l of LABELS) {
        const el = document.createElement("div"); el.className = "wl"; el.dataset.label = l.id; el.style.setProperty("--wl", "var(--world-" + l.color + ")");
        const dot = document.createElement("i"), b = document.createElement("b"); b.textContent = l.text; el.append(dot, b); el.hidden = true;
        labelsEl.appendChild(el); labelItems.push({ def: l, el, pos: v3(l.pos), lastX: null, lastY: null, lastHidden: true, lastState: "" });
      }
    }

    // ─── Pose: the whole world as a function of the snapshot ───
    function pose(s, dt) {
      const id = s.sceneId, t = s.t, o = order(id), { FLOOR, STAND } = G;
      // employee robot walks to the desk in the login scene, then types
      const emp = refs.employee;
      let ex = STAND[0], ez = STAND[1], heading = Math.PI, walk = 0;
      if (id === "login") {
        const u = ease(phase(t, 0.04, 0.42)), p = paths.walk.getPointAt(u), q = paths.walk.getPointAt(Math.min(1, u + 0.01));
        ex = p.x; ez = p.z; if (u < 1) heading = Math.atan2(q.x - p.x, q.z - p.z); walk = u * paths.walk.getLength() * 16 * (u < 1 ? 1 : 0);
      }
      emp.g.position.set(ex, FLOOR, ez); emp.g.rotation.y = heading;
      info.robot = id !== "login" ? "desk" : t < 0.04 ? "waiting" : t < 0.42 ? "walking" : "desk";
      const typing = id === "login" && t > 0.6 ? Math.sin(t * 60) * 0.2 : 0, reach = (id === "login" && t > 0.44) || id === "chat" ? -0.75 : 0;
      emp.limbs.forEach((limb, i) => {
        const leg = i % 2 === 0, side = i < 2 ? 1 : -1;
        limb.rotation.x = leg ? Math.sin(walk) * 0.55 * side : (walk ? -Math.sin(walk) * 0.45 * side : reach + typing * side);
      });
      refs.adminBot.limbs.forEach((limb, i) => { limb.rotation.x = i % 2 ? (id === "admin" ? -0.8 + Math.sin(t * 20) * 0.15 * (i < 2 ? 1 : -1) : 0) : 0; });
      const screenState = id === "login" ? (t > 0.45 ? "accentTint" : "screen") : (id === "chat" || id === "send") ? "accentTint" : id === "return" ? (t > 0.82 ? "accentTint" : "screen") : "screen";
      refs.screenMat.color.set(colors[screenState]); refs.screenMat.emissive.set(colors[screenState]); refs.screenMat.emissiveIntensity = screenState === "screen" ? 0.25 : 0.55;
      refs.adminMat.emissiveIntensity = id === "admin" || id === "final" ? 0.9 : 0.3;
      // rack opens in the first scene inside the server
      const oo = order(P.openScene), open = o < oo ? 0 : o === oo ? ease(phase(t, 0, 0.3)) : 1;
      refs.lid.position.y = refs.lidY + open * 1.6; refs.lidMat.opacity = 1 - open; refs.lid.visible = open < 0.99;
      refs.front.position.z = refs.frontZ + open * 0.7; refs.frontMats.forEach(m => { m.opacity = 1 - open; m.depthWrite = open < 0.5; }); refs.front.visible = open < 0.99;
      refs.lid.castShadow = refs.front.castShadow = open < 0.5;
      info.rackOpen = +open.toFixed(2);
      // cable glow
      let glowU = 0;
      if (id === "send") glowU = clamp((ease(phase(t, 0.05, 0.95)) * refs.sendLen - refs.hopLen) / (refs.sendLen - refs.hopLen));
      else if (o > order("send") && o <= order("return")) glowU = 1;
      refs.glow.visible = glowU > 0; refs.glow.geometry.setDrawRange(0, Math.floor(refs.glowCount * clamp(glowU) / 3) * 3);
      // the sheet: core moves it on the send leg, the product everywhere inside and back
      refs.packet.visible = refs.answer.visible = false;
      let out = { pos: null, carrier: null, scale: 1, node: "none" };
      if (id === "send") out = { pos: paths.send.getPointAt(ease(phase(t, 0.05, 0.95))), carrier: t > 0.02 ? "packet" : null, scale: 1, node: t >= 0.95 ? "inlet" : "moving" };
      const prod = S.pose(s, dt, { o }) || {};
      if (id !== "send") out = { ...out, ...prod };
      info.packetNode = out.node || "none";
      const carrier = out.carrier === "packet" ? refs.packet : out.carrier === "answer" ? refs.answer : null;
      if (carrier && out.pos) {
        carrier.visible = true; carrier.position.copy(out.pos);
        carrier.rotation.y = SHEET.facing + Math.sin(t * 9) * 0.04; carrier.scale.setScalar(SHEET.scale * (out.scale ?? 1));
      }
      refs.light.intensity = carrier ? 1.0 : 0; if (carrier && out.pos) refs.light.position.set(out.pos.x + LIGHT_LIFT[0], out.pos.y + LIGHT_LIFT[1], out.pos.z + LIGHT_LIFT[2]);
      info.redactions = refs.allMarks.reduce((n, mk) => n + (mk.bar.visible ? 1 : 0), 0);
      return { packetPos: out.pos, carrier };
    }

    // ─── Camera ───
    function desiredShot(s, poseOut) {
      const id = s.sceneId, t = s.t;
      const follow = (span, p = poseOut.packetPos) => ({ target: [p.x, p.y + 0.15, p.z], span, angle: 0.62, elev: 0.62 });
      if (id === "login") { if (t > 0.44) return SHOTS.monitor; if (t < 0.1) return width < height ? SHOTS.officeTall : SHOTS.office; const e = refs.employee.g.position; return { target: [e.x, 0.6, e.z], span: 3.4, angle: 0.62, elev: 0.6 }; }
      if (id === "chat") return SHOTS.monitor;
      if (id === "send") return t > 0.9 || !poseOut.packetPos ? SHOTS.rackOut : follow(2.8);
      const custom = S.shot && S.shot(s, poseOut, follow, SHOTS);
      if (custom) return custom;
      if (id === "return") return t > 0.84 || !poseOut.packetPos ? SHOTS.monitor : follow(3.4);
      if (id === "admin") return SHOTS.admin;
      return SHOTS.over;
    }
    function updateCamera(shot, dt, snap) {
      const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
      const tgt = shot.target;
      if (!view.target) view.target = v3(SHOTS.over.target);
      // per-component steps: a sum of all six could cancel opposite moves and report a moving camera as settled
      const dx = (tgt[0] - view.target.x) * k, dy = (tgt[1] - view.target.y) * k, dz = (tgt[2] - view.target.z) * k;
      const ds = (shot.span - view.span) * k, da = (shot.angle - view.angle) * k, de = (shot.elev - view.elev) * k;
      view.target.x += dx; view.target.y += dy; view.target.z += dz; view.span += ds; view.angle += da; view.elev += de;
      settled = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz), Math.abs(ds), Math.abs(da), Math.abs(de)) < 1e-4;
      const a = view.angle + user.yaw, e = view.elev, aspect = width / height, span = view.span / user.zoom;
      camera.position.set(view.target.x + Math.sin(a) * Math.cos(e) * 30, view.target.y + Math.sin(e) * 30, view.target.z + Math.cos(a) * Math.cos(e) * 30);
      camera.lookAt(view.target);
      camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      info.camera = shot === SHOTS.monitor ? "monitor" : shot === SHOTS.admin ? "admin" : shot === SHOTS.over ? "over" : "scene";
    }
    function updateLabels(s) {
      const v = scratch;
      for (const item of labelItems) {
        const l = item.def;
        let show = l.scenes.includes(s.sceneId) && !(s.callouts || []).some(c => c.anchor === l.id);
        if (show && S.labelVisible) { const r = S.labelVisible(l, s); if (r === false) show = false; }
        v.copy(item.pos).project(camera);
        const x = (v.x + 1) / 2 * width, y = (1 - v.y) / 2 * height;
        const hidden = !show || v.z > 1 || x < 20 || x > width - 20 || y < 24 || y > height - 4;
        if (hidden !== item.lastHidden) { item.el.hidden = hidden; item.lastHidden = hidden; }
        if (hidden) continue;
        const rx = Math.round(x), ry = Math.round(y);
        if (rx !== item.lastX || ry !== item.lastY) { item.el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -100%)`; item.lastX = rx; item.lastY = ry; }
        const st = (S.labelState && S.labelState(l, s)) || "";
        if (st !== item.lastState) { item.el.dataset.state = st; item.lastState = st; }
      }
    }
    // Explanation cards anchored to 3D points; content (kicker, title, lines) comes from the app.
    function updateCallouts(s) {
      const list = Array.isArray(s.callouts) ? s.callouts : [], seen = new Set(), v = scratch;
      for (const c of list) {
        const anchor = ANCHORS[c.anchor];
        if (!anchor) continue;
        seen.add(c.id);
        let item = callouts.get(c.id);
        if (!item) {
          const el = document.createElement("div"); el.className = "co"; el.dataset.callout = c.id;
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line"), dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("r", "4"); coSvg.append(line, dot); labelsEl.appendChild(el);
          item = { el, line, dot, sig: "", key: "", shown: true }; callouts.set(c.id, item);
        }
        const sig = JSON.stringify(c);
        if (sig !== item.sig) {
          item.sig = sig; item.key = ""; const el = item.el; el.replaceChildren(); el.dataset.tone = c.tone || "accent";
          for (const node of [item.line, item.dot]) node.dataset.tone = c.tone || "accent";
          if (c.kicker) { const k = document.createElement("span"); k.className = "co-k"; k.textContent = c.kicker; el.appendChild(k); }
          const b = document.createElement("b"); b.textContent = c.title; el.appendChild(b);
          if (c.lines && c.lines.length) {
            const ul = document.createElement("ul");
            for (const ln of c.lines) { const li = document.createElement("li"); li.dataset.state = ln.state || "muted"; li.textContent = ln.text; ul.appendChild(li); }
            el.appendChild(ul);
          }
          // a hidden card ([hidden] is display:none) measures 0 × 0: show it before measuring
          el.hidden = false; item.w = el.offsetWidth; item.h = el.offsetHeight;
        }
        v.set(anchor[0], anchor[1], anchor[2]).project(camera);
        const ax = (v.x + 1) / 2 * width, ay = (1 - v.y) / 2 * height, gap = 34, w = item.w, h = item.h, side = c.side || "right";
        let x = side === "left" ? ax - gap - w : side === "right" ? ax + gap : ax - w / 2;
        let y = side === "top" ? ay - gap - h : side === "bottom" ? ay + gap : ay - h / 2;
        x = clamp(x, 8, Math.max(8, width - w - 8)); y = clamp(y, 8, Math.max(8, height - h - 8));
        if (!item.shown) { item.el.hidden = false; item.line.style.display = item.dot.style.display = ""; item.shown = true; }
        // skip the DOM writes while the card and its leader line stay put
        const rx = Math.round(x), ry = Math.round(y), sax = ax.toFixed(1), say = ay.toFixed(1), key = rx + "," + ry + "," + sax + "," + say;
        if (key === item.key) continue;
        item.key = key; item.el.style.transform = `translate(${rx}px, ${ry}px)`;
        const ex = clamp(ax, x, x + w), ey = clamp(ay, y, y + h);
        item.line.setAttribute("x1", sax); item.line.setAttribute("y1", say); item.line.setAttribute("x2", ex.toFixed(1)); item.line.setAttribute("y2", ey.toFixed(1));
        item.dot.setAttribute("cx", sax); item.dot.setAttribute("cy", say);
      }
      for (const [cid, item] of callouts) if (!seen.has(cid) && item.shown) { item.el.hidden = true; item.line.style.display = item.dot.style.display = "none"; item.shown = false; }
      info.callouts = seen.size;
    }

    // ─── Frame ───
    function frame(s, dt) {
      if (info.renderer !== "webgl" || !s) return;
      info.frames++;
      // the end state (t = 1) must always get its own frame: rounding alone would merge it with t = 0.99996
      const sig = [s.sceneId, s.t >= 1 ? "end" : s.t.toFixed(5), S.sig ? S.sig(s) : "", s.prompt ? s.prompt.id : "", s.calloutsSig || "", width, height, user.yaw, user.zoom].join("|");
      const animating = S.animating ? S.animating(s) : false;
      if (sig === lastSig && settled && !animating) return;
      lastSig = sig;
      const p = pose(s, dt);
      updateCamera(desiredShot(s, p), dt, s.reduced);
      updateLabels(s); updateCallouts(s);
      renderer.render(scene, camera); info.renders++;
    }

    // ─── Diagnostics: does the travelling sheet pass through scene geometry? ───
    // Replays every travelling scene in small steps, samples points on the sheet/PDF/answer planes and reports
    // the visible meshes whose world bounding box contains a sample point.
    function debugCollisions(step = 0.02) {
      if (info.renderer !== "webgl") return { ok: false, error: "no webgl" };
      const key = c => Object.keys(colors).find(k => colors[k] && new THREE.Color(colors[k]).getHex() === c.getHex()) || "#" + c.getHexString();
      const carriers = new Set(); [refs.packet, refs.answer].forEach(c => c.traverse(o => carriers.add(o)));
      const shown = o => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
      const scenes = ["send", ...P.travelScenes, "return"], hits = new Map(), bx = new THREE.Box3(), pt = new THREE.Vector3(), samples = [];
      for (const run of S.collisionRuns()) {
        for (const sceneId of scenes) for (let t = 0; t <= 1.0001; t += step) {
          pose({ sceneId, t, ...run, rules: run.rules || [], callouts: [] }, 0); world.updateMatrixWorld(true);
          const carrier = refs.packet.visible ? refs.packet : refs.answer.visible ? refs.answer : null;
          if (!carrier) continue;
          samples.length = 0;
          carrier.traverse(o => {
            if (!o.isMesh || !shown(o) || o.geometry.type !== "PlaneGeometry") return;
            const { width: w, height: h } = o.geometry.parameters;
            for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) samples.push(pt.set((i / 4 - 0.5) * w, (j / 4 - 0.5) * h, 0).applyMatrix4(o.matrixWorld).clone());
          });
          world.traverse(o => {
            if (!o.isMesh || carriers.has(o) || o.userData.noCollide || !shown(o)) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            if (mats.every(m => m.transparent && m.opacity < 0.05)) return;
            bx.setFromObject(o).expandByScalar(-0.004);
            if (bx.isEmpty() || !samples.some(p => bx.containsPoint(p))) return;
            const c = bx.getCenter(new THREE.Vector3()), id = `${o.geometry.type}:${key(mats[0].color)}@${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`;
            const hk = sceneId + "|" + id, prev = hits.get(hk), label = run.label || "run";
            hits.set(hk, prev ? { ...prev, t1: +t.toFixed(2), runs: prev.runs.add(label) } : { scene: sceneId, mesh: id, t0: +t.toFixed(2), t1: +t.toFixed(2), runs: new Set([label]) });
          });
        }
      }
      lastSig = "";
      const list = [...hits.values()].map(h => ({ ...h, runs: [...h.runs].join(" ") }));
      return { ok: list.length === 0, count: list.length, hits: list };
    }

    // ─── Listeners ───
    function bindInput(canvas) {
      canvas.addEventListener("contextmenu", e => e.preventDefault());
      canvas.addEventListener("pointerdown", e => { user.drag = { x: e.clientX, yaw: user.yaw }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener("pointermove", e => { if (user.drag) { user.yaw = clamp(user.drag.yaw - (e.clientX - user.drag.x) * 0.006, -1.2, 1.2); lastSig = ""; } });
      const end = () => { user.drag = null; };
      canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
      canvas.addEventListener("wheel", e => { e.preventDefault(); user.zoom = clamp(user.zoom * (e.deltaY < 0 ? 1.1 : 0.91), 0.6, 2.2); lastSig = ""; }, { passive: false });
      canvas.addEventListener("dblclick", () => resetView());
      canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); fail("Utracono grafikę 3D. Aktywny widok schematu."); });
    }
    function resetView() { user.yaw = 0; user.zoom = 1; lastSig = ""; }
    function resize() {
      const r = stage.getBoundingClientRect(); width = Math.max(1, r.width); height = Math.max(1, r.height);
      renderer.setSize(width, height, false); lastSig = "";
      // the 768px breakpoint changes the cards' max-width: measure every callout again
      for (const item of callouts.values()) item.sig = "";
    }

    // ─── Init ───
    async function init(config) {
      options = config; stage = config.stage; labelsEl = config.labels; info.renderer = "loading";
      try {
        let timer;
        try { THREE = await Promise.race([import(THREE_URL), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("3D library timeout")), 10000); })]); }
        finally { clearTimeout(timer); }
        const css = getComputedStyle(document.documentElement);
        for (const k of COLOR_KEYS) colors[k] = css.getPropertyValue("--world-" + k).trim() || css.getPropertyValue("--world-paper").trim();
        fonts.ui = css.getPropertyValue("--font-ui").trim() || "sans-serif"; fonts.mono = css.getPropertyValue("--font-mono").trim() || "monospace";
        if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
        renderer.domElement.className = "world-canvas"; renderer.domElement.setAttribute("role", "img");
        renderer.domElement.setAttribute("aria-label", P.ariaLabel || "Świat 3D. Przeciągnij, aby obrócić; kółko przybliża; dwuklik resetuje widok.");
        stage.prepend(renderer.domElement);
        scene = new THREE.Scene(); scene.background = new THREE.Color(colors.background);
        camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 90);
        scene.add(new THREE.HemisphereLight(colors.sky, colors.bounce, 2.0));
        sun = new THREE.DirectionalLight(colors.light, 3.0); sun.position.set(3, 14, 9); sun.target.position.set(7, 0, 2);
        sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, far: 40 }); sun.shadow.normalBias = 0.03; sun.shadow.bias = -0.0002;
        scene.add(sun, sun.target);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: colors.background, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -0.25; ground.receiveShadow = true; scene.add(ground);
        world = new THREE.Group(); scene.add(world); scratch = new THREE.Vector3();
        S = product.create({
          THREE, G, colors, refs, paths, info, world,
          clamp, phase, ease, easeOutBack, lerp, v3, order, font, own, box, cylinder, sphere, group, strip, canvasTexture,
          makePath, seeded, fakeText, paintMark, plates, rackScreen, rackBoard, padlock, localBay, localRoute, legs, returnPath,
          ride, swallowScale, poseCabinet, deskAt, chair, plant
        });
        buildRooms(); buildOffice(); buildRackShell(); buildClouds(); buildSendPath();
        S.build(); S.buildPaths();
        buildPacket();
        refs.employee = buildRobot("brand"); refs.adminBot = buildRobot("admin");
        refs.adminBot.g.position.set(G.ADMIN.x, G.FLOOR, G.ADMIN.z + 0.62); refs.adminBot.g.rotation.y = Math.PI;
        buildLabels();
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); resize();
        bindInput(renderer.domElement);
        info.renderer = "webgl";
        if (config.onReady) config.onReady();
      } catch (err) {
        console.warn("3D unavailable, using the schematic view.", err);
        fail("Widok uproszczony: grafika 3D niedostępna. Demo działa na schemacie.");
      }
    }
    function fail(message) {
      info.renderer = "fallback";
      if (resizeObserver) resizeObserver.disconnect();
      if (renderer) { renderer.domElement.remove(); renderer.dispose(); }
      if (labelsEl) labelsEl.replaceChildren();
      if (options.onFail) options.onFail(message);
    }

    return { init, frame, resetView, debugCollisions, info: () => ({ ...info }) };
  }

  return { create };
})();
