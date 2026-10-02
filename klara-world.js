/* Klara od środka – 3D world (Three.js 0.180, loaded on demand from the CDN).
   The world is a pure function of a snapshot: { sceneId, t (0..1), prompt, decision, rules, callouts, reduced }.
   Callout content comes from the app; the world only anchors it to 3D points and draws the leader lines.
   API: KlaraWorld.init({ stage, labels, onReady, onFail }) · KlaraWorld.frame(snapshot, dt) · KlaraWorld.info()
   Colours come from --world-* tokens in index.html; nothing here hardcodes a colour. */
window.KlaraWorld = (() => {
  "use strict";

  // ─── Constants ───
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
  const COLOR_KEYS = ["paper", "cream", "ink", "wood", "metal", "upholstery", "pot", "soil", "leaf", "leafLight", "screen", "wall", "wallServer",
    "glass", "foundation", "edge", "officeFloor", "serverFloor", "tileLine", "background", "light", "sky", "bounce", "brand", "admin", "klara",
    "klaraTint", "rack", "rackDark", "rackFace", "rackLine", "belt", "scan", "gpu", "gpuLed", "cloud", "hazard", "ok", "danger", "chipMasked",
    "cable", "keyboard", "lockMetal", "providerA", "providerB", "providerC", "rug", "gaugeLow", "gaugeMid", "gaugeHigh", "blocked", "xrayShell", "xrayBg", "xrayLine"];
  const FLOOR = 0.02, BELT_Y = 0.33;
  // The sheet's centre rides this high inside the rack and this high above the floor cable (its half-height is ~0.16).
  const RIDE = 0.48, FLOOR_RIDE = 0.23, LANE_Z = 0.55;
  const DESK = { x: 2.6, z: 2.25 }, STAND = [2.6, 3.0], DOOR = [0.8, 5.6];
  const MON = [2.6, 0.99, 2.24];
  const INLET = [8.58, RIDE, 2.8], SCAN = [9.2, RIDE, 2.8], GAUGE = [10.0, RIDE, 2.8], SWITCH = [10.9, RIDE, 2.8], GPU_IN = [12.25, 0.49, 2.95];
  const PORT_X = { apiq: 10.9, frontier: 11.5 }, PORT_Z = 1.74, PORT_W = 0.44, GATE = [11.25, RIDE, 0.06];
  const HOLE_TOP = 0.74; // openings in the rack panels and walls reach this high
  const CLOUD = { apiq: [9.3, 3.1, -2.7], frontier: [13.2, 3.1, -2.7] };
  const ADMIN = { x: 5.9, z: 4.15 };
  // The local route turns towards the GPU server cabinet: switch → front of the cabinet → into the chosen server.
  const LOCAL_TURN = [11.45, 3.45], CAB = { x: 12.25, z: 2.75, chosen: 1 };
  const ARROW_ANGLE = { local: Math.atan2(-(LOCAL_TURN[1] - 2.8), LOCAL_TURN[0] - 10.9), apiq: Math.PI / 2, frontier: Math.PI / 4, neutral: -Math.PI / 2 };
  const NEEDLE_REST = 1.15;
  const SHOTS = {
    over: { target: [7.2, 1.0, 1.8], span: 8.4, angle: 0.62, elev: 0.6 },
    monitor: { target: [2.6, 0.97, 2.1], span: 1.2, angle: 0.22, elev: 0.3 },
    rackOut: { target: [10.5, 0.6, 2.7], span: 3.9, angle: 0.62, elev: 0.6 },
    scan: { target: [9.3, 1.05, 2.3], span: 2.75, angle: 0.4, elev: 0.42 },
    gauge: { target: [10.05, 0.55, 2.7], span: 2.3, angle: 0.42, elev: 0.6 },
    route: { target: [11.2, 0.75, 2.45], span: 3.4, angle: 0.5, elev: 0.66 },
    gpu: { target: [12.0, 0.62, 3.0], span: 2.5, angle: 0.55, elev: 0.55 },
    admin: { target: [5.9, 1.02, 4.05], span: 1.15, angle: 0.18, elev: 0.28 }
  };
  // Labels: which scenes show them; `route` ties the label to a routing state.
  const LABELS = [
    { id: "desk", text: "Stanowisko pracownika", color: "brand", pos: [2.6, 1.5, 2.1], scenes: ["login", "send", "final"] },
    { id: "admin", text: "Panel administratora", color: "admin", pos: [5.9, 1.55, 4.1], scenes: ["login", "final"] },
    { id: "monitor", text: "Podgląd skanu", color: "scan", pos: [9.18, 2.08, 1.66], scenes: ["scan", "gauge"] },
    { id: "server", text: "Quantica AI Server", color: "brand", pos: [10.6, 1.5, 3.2], scenes: ["send", "final"] },
    { id: "scan", text: "Skaner rentgenowy", color: "scan", pos: [9.2, 1.06, 2.8], scenes: ["scan"] },
    { id: "gauge", text: "Miernik złożoności", color: "klara", pos: [10.0, 1.18, 2.25], scenes: ["gauge"] },
    { id: "switch", text: "Zwrotnica", color: "klara", pos: [10.9, 0.8, 2.85], scenes: ["route"] },
    { id: "policy", text: "Polityka organizacji", color: "admin", pos: [10.75, 1.86, 1.72], scenes: [] },
    { id: "local", text: "Modele lokalne · serwery GPU", color: "ok", pos: [12.25, 1.22, 2.75], scenes: ["route", "model", "final"], route: "local" },
    { id: "gate", text: "Wyjście z organizacji", color: "ok", pos: [11.25, 1.1, 0.06], scenes: ["route", "model", "final"] },
    { id: "apiq", text: "Quantica APIQ", color: "brand", pos: [9.3, 3.95, -2.7], scenes: ["model", "final"], route: "apiq" },
    { id: "frontier", text: "Frontier API", color: "admin", pos: [13.2, 3.95, -2.7], scenes: ["model", "final"], route: "frontier" }
  ];
  const SCENE_ORDER = ["login", "chat", "send", "scan", "gauge", "route", "model", "return", "admin", "final"];
  // Callout anchors share ids with labels: an active callout replaces the plain label.
  const ANCHORS = {
    server: [10.6, 1.2, 3.4], monitor: [8.62, 1.6, 1.9], scan: [9.2, 0.9, 3.3], gauge: [10.27, 0.76, 2.34], switch: [10.9, 0.4, 2.8],
    policy: [10.75, 1.82, 1.72], local: [12.25, 1.1, 2.95], gate: [11.25, 0.7, 0.06], apiq: [9.3, 3.5, -2.7], frontier: [13.2, 3.5, -2.7]
  };
  const RULE_TEXT = ["Dane chronione (także w załącznikach) → tylko model lokalny", "Zadanie proste lub standardowe → model lokalny", "Zadanie złożone → model zewnętrzny wg polityki"];
  const RULE_HIT = ["danger", "ok", "klara"];
  const PAGE_FLAGS = [[0, 2], [1], [3]];
  // The message is a sheet of paper; attachments are PDFs clipped onto it.
  const SHEET = { w: 0.26, h: 0.34, tex: [512, 668], tilt: -0.6, facing: 0.25, scale: 1.15 };
  const PDF = { w: 0.17, h: 0.22, tex: [256, 332], max: 2 };
  const MSG_MARK_ROWS = [1, 3, 5], PDF_MARK_ROWS = [0, 1, 2, 3];

  // ─── State ───
  let THREE = null, renderer, scene, camera, world, stage, labelsEl, resizeObserver, sun;
  let width = 1, height = 1, options = {};
  const colors = {}, materials = {}, geometries = new Map(), refs = {}, paths = {};
  const view = { target: null, span: 8.4, angle: 0.62, elev: 0.6 };
  const user = { yaw: 0, zoom: 1, drag: null };
  let labelItems = [], lastSig = "", settled = false, coSvg = null;
  const callouts = new Map();
  const info = { renderer: "loading", packetNode: "none", frames: 0, renders: 0, rackOpen: 0, arrow: "neutral", barriers: "up", camera: "", callouts: 0, rules: "", scanView: "idle", blade: 0, attachments: 0, redactions: 0 };

  // ─── Helpers ───
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const phase = (t, a, b) => clamp((t - a) / (b - a));
  const ease = u => u * u * (3 - 2 * u);
  const easeOutBack = u => { const c = 1.6; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const v3 = p => new THREE.Vector3(p[0], p[1], p[2]);
  const order = id => SCENE_ORDER.indexOf(id);

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
  function geo(kind, values, create) {
    const key = kind + ":" + values.join(",");
    if (!geometries.has(key)) geometries.set(key, create());
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

  // ─── Build: room shell ───
  function buildRooms() {
    box(7.0, 3.0, 14.5, 6.5, 0.24, "foundation", -0.24, world, 0.06);
    box(3.75, 3.0, 7.5, 6.0, FLOOR, "officeFloor");
    box(10.85, 3.0, 6.7, 6.0, FLOOR, "serverFloor");
    for (let x = 8.1; x < 14.2; x += 0.6) box(x, 3.0, 0.012, 6.0, 0.004, "tileLine", FLOOR);
    for (let z = 0.6; z < 6; z += 0.6) box(10.85, z, 6.7, 0.012, 0.004, "tileLine", FLOOR);
    box(2.6, 2.95, 4.6, 2.3, 0.006, "rug", FLOOR);
    // walls: office back + left, server back with the exit opening
    box(3.75, 0.06, 7.5, 0.12, 1.1, "wall");
    box(0.06, 3.0, 0.12, 6.0, 1.1, "wall");
    for (let i = 0; i < 4; i++) box(1.0 + i * 1.75, 0.125, 1.15, 0.02, 0.5, "glass", 0.4);
    const gx0 = 10.92, gx1 = 11.58; // exit opening in the server back wall
    box((7.5 + gx0) / 2, 0.06, gx0 - 7.5, 0.12, 1.1, "wallServer");
    box((gx1 + 14.2) / 2, 0.06, 14.2 - gx1, 0.12, 1.1, "wallServer");
    box((gx0 + gx1) / 2, 0.06, gx1 - gx0, 0.12, 1.1 - HOLE_TOP, "wallServer", HOLE_TOP);
    // glass partition between office and server room (door gap at z 4.4–5.4)
    const glass = own("glass", { transparent: true, opacity: 0.32, depthWrite: false });
    const pass = [LANE_Z - 0.26, LANE_Z + 0.26], passTop = 0.52; // cable pass-through near the floor
    for (const [z0, z1] of [[0.12, pass[0]], [pass[1], 4.4], [5.4, 6.0]]) {
      box(7.55, (z0 + z1) / 2, 0.04, z1 - z0, 1.0, glass);
      for (const z of [z0, z1]) box(7.55, z, 0.07, 0.07, 1.05, "metal");
    }
    box(7.55, LANE_Z, 0.04, pass[1] - pass[0], 1.0 - passTop, glass, passTop);
    box(7.55, LANE_Z, 0.07, pass[1] - pass[0], 0.04, "metal", passTop - 0.04);
    box(7.55, 3.0, 0.07, 5.88, 0.05, "metal", 1.0);
    // exit gate in the server back wall
    refs.gateMat = own("ok", { emissive: colors.ok, emissiveIntensity: 0 });
    box(gx0 + 0.03, 0.16, 0.06, 0.12, HOLE_TOP, refs.gateMat); box(gx1 - 0.03, 0.16, 0.06, 0.12, HOLE_TOP, refs.gateMat);
    box((gx0 + gx1) / 2, 0.16, gx1 - gx0, 0.12, 0.06, refs.gateMat, HOLE_TOP);
  }

  // ─── Build: office ───
  function deskAt(x, z, screenMat) {
    box(x, z, 1.3, 0.66, 0.05, "wood", 0.7, world, 0.03);
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.28, 0.28]) box(x + dx, z + dz, 0.05, 0.05, 0.7, "metal");
    cylinder(x, z - 0.18, 0.012, 0.12, "metal", 0.75);
    box(x, z - 0.2, 0.64, 0.04, 0.4, "ink", 0.84, world, 0.015);
    const screen = new THREE.Mesh(geo("plane", [0.58, 0.34], () => new THREE.PlaneGeometry(0.58, 0.34)), screenMat);
    screen.position.set(x, 1.04, z - 0.177); world.add(screen);
    box(x, z + 0.06, 0.42, 0.14, 0.015, "keyboard", 0.75);
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
  function buildOffice() {
    refs.screenMat = own("screen", { emissive: colors.screen, emissiveIntensity: 0.25, roughness: 0.3 });
    refs.mainScreen = deskAt(DESK.x, DESK.z, refs.screenMat);
    deskAt(4.75, 2.25, own("screen", { emissive: colors.screen, emissiveIntensity: 0.2 })); chair(4.75, 2.95, Math.PI);
    deskAt(4.75, 0.95 + 0.3, own("screen", { emissive: colors.screen, emissiveIntensity: 0.2 }));
    box(0.42, 1.4, 0.5, 0.9, 1.0, "wood", 0, world, 0.02);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) box(0.68, 1.08 + k * 0.2, 0.02, 0.14, 0.22, ["upholstery", "klara", "admin", "metal"][k], 0.08 + i * 0.32);
    plant(0.55, 0.5); plant(7.1, 5.6, 1.15); plant(7.15, 3.4, 0.9);
    // admin console: pedestal + tilted screen
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

  // ─── Build: Quantica AI Server (cutaway rack) ───
  function buildRack() {
    const cx = 10.6, cz = 2.8, w = 4.6, d = 2.2, h = 1.1;
    box(cx, cz, w, d, 0.12, "rackDark", FLOOR, world, 0.03);
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, base = FLOOR + 0.12;
    // back panel with two port openings
    const ports = [PORT_X.apiq, PORT_X.frontier].map(x => [x - PORT_W / 2, x + PORT_W / 2]);
    const solid = [[x0, ports[0][0]], [ports[0][1], ports[1][0]], [ports[1][1], x1]];
    for (const [a, b] of solid) box((a + b) / 2, z0 + 0.04, b - a, 0.08, h, "rack", FLOOR);
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
    box(cx + w / 2 - 0.04, cz, 0.08, d, h, "rack", FLOOR);
    // lid + front cover open in the scan scene
    refs.lidMat = own("rackFace", { transparent: true, opacity: 1 });
    refs.lid = box(cx, cz, w + 0.02, d + 0.02, 0.06, refs.lidMat, FLOOR + h);
    const face = canvasTexture(1024, 256, (c, W, H) => {
      c.fillStyle = colors.rackFace; c.fillRect(0, 0, W, H);
      c.strokeStyle = colors.rackLine; c.lineWidth = 7;
      for (let row = -1; row < 4; row++) for (let col = -1; col < 14; col++) { hexPath(c, col * 86 + (row % 2 ? 43 : 0), row * 74 + 40, 46); c.stroke(); }
      c.fillStyle = colors.rackFace; c.fillRect(W / 2 - 112, 22, 224, 212);
      drawQ(c, W / 2 - 96, 38, 180);
      c.fillStyle = colors.scan; c.fillRect(34, 70, 10, 110);
      c.fillStyle = colors.ink; c.fillRect(W - 300, H - 70, 262, 44);
      c.fillStyle = colors.paper; c.font = "600 26px " + (options.font || "sans-serif"); c.fillText("Quantica AI Server", W - 286, H - 39);
    });
    const side = own("rackFace", { transparent: true, opacity: 1 }), front = own("paper", { map: face, transparent: true, opacity: 1 });
    refs.frontMats = [side, side, side, side, front, side];
    refs.front = mesh(geo("box", [w + 0.02, h, 0.06], () => new THREE.BoxGeometry(w + 0.02, h, 0.06)), refs.frontMats);
    refs.front.position.set(cx, FLOOR + h / 2, cz + d / 2 + 0.01);

    // belt from the inlet to the switch
    box(9.7, 2.8, 2.45, 0.34, 0.1, "belt", FLOOR + 0.12);
    for (const z of [2.62, 2.98]) box(9.7, z, 2.45, 0.03, 0.14, "metal", FLOOR + 0.12);
    for (let x = 8.6; x < 10.9; x += 0.3) box(x, 2.8, 0.02, 0.34, 0.003, "rackLine", FLOOR + 0.22);
    buildXrayTunnel();
    // gauge: dial with low / mid / high zones and a needle
    box(GAUGE[0], 2.3, 0.08, 0.08, 0.36, "metal", FLOOR + 0.12);
    const dial = group(GAUGE[0], 0.74, 2.32);
    const disc = mesh(geo("cyl", [0.27, 0.27, 0.04, 32], () => new THREE.CylinderGeometry(0.27, 0.27, 0.04, 32)), "paper", dial); disc.rotation.x = Math.PI / 2;
    const zones = [["gaugeLow", Math.PI / 2 + 0.33, 0.8], ["gaugeMid", Math.PI / 2 - 0.33, 0.66], ["gaugeHigh", Math.PI / 2 - 1.13, 0.8]];
    for (const [c, start, len] of zones) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.235, 24, 1, start, len), own(c, { side: THREE.DoubleSide })); ring.position.z = 0.022; dial.add(ring);
    }
    refs.needle = group(0, 0, 0.03, dial); box(0, 0, 0.022, 0.012, 0.21, "ink", 0, refs.needle); sphere(0, 0, 0.008, 0.03, "ink", dial);
    // switch: turntable with a pointing arrow
    cylinder(SWITCH[0], SWITCH[2], 0.22, 0.1, "metal", FLOOR + 0.12, world, 0.22, 28);
    refs.arrow = group(SWITCH[0], FLOOR + 0.225, SWITCH[2]);
    box(0.06, 0, 0.24, 0.05, 0.02, "klara", 0, refs.arrow); const head = box(0.2, 0, 0.1, 0.1, 0.02, "klara", 0, refs.arrow); head.rotation.y = Math.PI / 4;
    // rails out of the switch
    strip([11.08, 2.98], LOCAL_TURN, 0.2, 0.04, "belt", FLOOR + 0.12); strip(LOCAL_TURN, [CAB.x - 0.3, LOCAL_TURN[1]], 0.2, 0.04, "belt", FLOOR + 0.12);
    strip([10.9, 2.58], [10.9, 1.82], 0.2, 0.04, "belt", FLOOR + 0.12);
    strip([11.05, 2.65], [11.5, 2.2], 0.2, 0.04, "belt", FLOOR + 0.12);
    strip([11.5, 2.2], [11.5, 1.82], 0.2, 0.04, "belt", FLOOR + 0.12);
    // barriers + padlocks on the external ports
    refs.barriers = {}; refs.locks = {};
    for (const key of ["apiq", "frontier"]) {
      const x = PORT_X[key];
      box(x + 0.25, 2.0, 0.04, 0.04, 0.5, "metal", FLOOR + 0.12);
      const pivot = group(x + 0.25, FLOOR + 0.56, 2.0); box(-0.24, 0, 0.5, 0.035, 0.035, "hazard", -0.017, pivot); refs.barriers[key] = pivot;
      const lock = group(x, FLOOR + 0.78, 2.0); box(0, 0, 0.11, 0.05, 0.09, "lockMetal", -0.045, lock, 0.015);
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 16, Math.PI), material("lockMetal")); shackle.position.y = 0.045; lock.add(shackle);
      lock.scale.setScalar(0.001); refs.locks[key] = lock;
    }
    buildServerCabinet();
    buildRulesBoard(); buildXrayMonitor(); buildPlates(); buildTracks();
    // a couple of plain racks along the wall for context
    for (const x of [13.55, 13.9]) box(x, 0.6, 0.32, 0.7, 1.0, "rack", FLOOR, world, 0.02);
  }

  // Organisation rules on a board mounted above the rack's back panel; one lamp + row highlight per rule.
  function buildRulesBoard() {
    const W = 1.56, H = 0.66, g = group(10.75, FLOOR + 1.12, 1.66);
    box(0, 0, W + 0.06, 0.05, H + 0.06, "rackDark", -0.03, g, 0.02);
    for (const x of [-0.5, 0.5]) box(x, 0.02, 0.05, 0.05, 0.14, "metal", -0.14, g);
    const tex = canvasTexture(1024, 432, (c, w, h) => {
      c.fillStyle = colors.rackFace; c.fillRect(0, 0, w, h);
      c.fillStyle = colors.admin; c.fillRect(0, 0, w, 74);
      c.fillStyle = colors.paper; c.font = "700 34px " + (options.font || "sans-serif"); c.fillText("POLITYKA ORGANIZACJI · REGUŁY KIEROWANIA", 32, 49);
      RULE_TEXT.forEach((txt, i) => {
        const y = 140 + i * 104;
        c.strokeStyle = colors.rackLine; c.lineWidth = 2; c.strokeRect(20, y - 44, w - 40, 88);
        c.fillStyle = colors.paper; c.beginPath(); c.arc(70, y, 26, 0, Math.PI * 2); c.fill();
        c.fillStyle = colors.ink; c.font = "700 30px " + (options.font || "sans-serif"); c.fillText(String(i + 1), 61, y + 11);
        c.fillStyle = colors.paper; c.font = "500 29px " + (options.font || "sans-serif"); c.fillText(txt, 118, y + 10);
      });
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    face.position.set(0, H / 2, 0.03); g.add(face);
    refs.ruleLamps = []; refs.ruleRows = [];
    for (let i = 0; i < 3; i++) {
      const y = H / 2 - (140 + i * 104 - 216) / 432 * H;
      const lamp = own("chipMasked", { emissive: colors.chipMasked, emissiveIntensity: 0 });
      sphere(W / 2 - 0.07, y, 0.06, 0.035, lamp, g); refs.ruleLamps.push(lamp);
      const row = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, 0.13), own("ok", { emissive: colors.ok, emissiveIntensity: 0.8, transparent: true, opacity: 0, depthWrite: false }));
      row.position.set(0, y, 0.035); g.add(row); refs.ruleRows.push(row.material);
    }
  }
  // X-ray tunnel over the belt: the sheet passes through flexible curtains; an inner light glows while scanning.
  function buildXrayTunnel() {
    const x = SCAN[0], L = 0.9, z0 = 2.31, z1 = 3.29, base = FLOOR + 0.12, top = 0.82;
    box(x, (z0 + z1) / 2, L, z1 - z0, 0.1, "xrayShell", top, world, 0.04);
    for (const z of [z0 + 0.03, z1 - 0.03]) box(x, z, L, 0.06, top - base, "xrayShell", base);
    refs.tunnelMat = own("scan", { emissive: colors.scan, emissiveIntensity: 0.1 });
    box(x, 2.8, L - 0.14, 0.3, 0.02, refs.tunnelMat, top - 0.02);
    const curtain = own("ink", { transparent: true, opacity: 0.5 });
    for (const cx of [x - L / 2 - 0.02, x + L / 2 + 0.02]) for (let z = z0 + 0.11; z < z1 - 0.08; z += 0.12) {
      const strip = box(cx, z, 0.012, 0.1, 0.4, curtain, top - 0.4); strip.castShadow = false;
      strip.userData.noCollide = true; // flexible strips the sheet pushes through
    }
    refs.beaconMat = own("scan", { emissive: colors.scan, emissiveIntensity: 0 });
    cylinder(x + 0.3, 3.1, 0.04, 0.06, refs.beaconMat, top + 0.1);
  }
  // Preview monitor above the back panel: the message on the left, attachments on the right.
  function buildXrayMonitor() {
    const W = 1.3, H = 0.775, g = group(SCAN[0] - 0.02, FLOOR + 1.12, 1.66); g.rotation.y = 0.32;
    box(0, 0, W + 0.06, 0.05, H + 0.06, "rackDark", -0.03, g, 0.02);
    for (const dx of [-0.45, 0.45]) box(dx, 0.02, 0.05, 0.05, 0.14, "metal", -0.14, g);
    refs.xrayCanvas = document.createElement("canvas"); refs.xrayCanvas.width = 1024; refs.xrayCanvas.height = 610;
    refs.xrayTex = new THREE.CanvasTexture(refs.xrayCanvas); refs.xrayTex.colorSpace = THREE.SRGBColorSpace; refs.xrayTex.anisotropy = 4;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: refs.xrayTex, toneMapped: false }));
    screen.position.set(0, H / 2, 0.03); g.add(screen);
    refs.xrayKey = ""; drawXray({ view: "idle" });
  }
  // What the X-ray screen shows: view = idle | scanning | found | masked | clear.
  function drawXray(st) {
    const key = JSON.stringify(st); if (key === refs.xrayKey) return; refs.xrayKey = key;
    const c = refs.xrayCanvas.getContext("2d"), W = refs.xrayCanvas.width, H = refs.xrayCanvas.height, font = options.font || "sans-serif", mono = "Geist Mono, monospace";
    const line = colors.xrayLine, red = colors.danger, ink = colors.ink, paper = colors.paper, ok = colors.ok;
    c.fillStyle = colors.xrayBg; c.fillRect(0, 0, W, H);
    c.fillStyle = line; c.font = "700 30px " + mono; c.fillText("PODGLĄD SKANU · RENTGEN TREŚCI", 30, 48);
    c.globalAlpha = 0.25; c.fillRect(30, 64, W - 60, 2); c.globalAlpha = 1;
    const pane = (x, title) => { c.strokeStyle = line; c.globalAlpha = 0.35; c.lineWidth = 2; c.strokeRect(x, 84, 466, 420); c.globalAlpha = 1; c.fillStyle = line; c.font = "700 22px " + mono; c.fillText(title, x + 16, 116); };
    pane(30, "WIADOMOŚĆ"); pane(528, "ZAŁĄCZNIK");
    if (st.view === "idle") { c.fillStyle = line; c.globalAlpha = 0.6; c.font = "500 24px " + mono; c.fillText("oczekiwanie na polecenie…", 46, 560); c.globalAlpha = 1; refs.xrayTex.needsUpdate = true; return; }
    const tagBar = (x, y, w, item, state) => {
      if (state === "masked") { c.fillStyle = ink; c.fillRect(x - 4, y - 13, Math.max(w, 120) + 8, 26); c.fillStyle = paper; c.font = "700 17px " + mono; c.fillText(item.token, x + 4, y + 6); }
      else if (state === "found") { c.fillStyle = red; c.globalAlpha = 0.75; c.fillRect(x - 4, y - 11, w + 8, 22); c.globalAlpha = 1; c.strokeStyle = red; c.lineWidth = 3; c.strokeRect(x - 9, y - 16, w + 18, 32); }
    };
    // message: a sheet silhouette with rows of text; protected rows tagged
    c.strokeStyle = line; c.lineWidth = 3; c.strokeRect(150, 140, 226, 340);
    c.fillStyle = line; c.globalAlpha = 0.5; const rows = fakeText(c, 170, 190, 186, 8, 36, 9, seeded(7)); c.globalAlpha = 1;
    (st.msg || []).forEach((item, i) => { const r = rows[[1, 3, 5][i]]; if (r) tagBar(r.words[0][0], r.y, r.words[0][1] - r.words[0][0], item, st.msgState); });
    // attachment: PDF pages with their protected lines
    if (!st.att) { c.fillStyle = line; c.globalAlpha = 0.6; c.font = "500 24px " + mono; c.fillText("brak załączników", 640, 300); c.globalAlpha = 1; }
    else {
      c.fillStyle = line; c.font = "500 18px " + mono; c.fillText(st.att.name, 546, 148);
      const items = st.att.items; let k = 0;
      PAGE_FLAGS.forEach((flags, pIdx) => {
        const px = 552 + pIdx * 148, py = 170;
        c.strokeStyle = line; c.lineWidth = 2; c.strokeRect(px, py, 128, 176);
        c.fillStyle = red; c.fillRect(px + 8, py + 8, 40, 18); c.fillStyle = paper; c.font = "800 12px " + font; c.fillText("PDF", px + 14, py + 22);
        if (st.attState === "reading" || st.attState === "found" || st.attState === "masked") {
          c.fillStyle = line; c.globalAlpha = 0.5; const pr = fakeText(c, px + 10, py + 46, 108, 4, 30, 7, seeded(31 + pIdx)); c.globalAlpha = 1;
          for (const f of flags) { const it = items[k++]; if (it && pr[f]) tagBar(pr[f].words[0][0], pr[f].y, Math.min(70, pr[f].words[0][1] - pr[f].words[0][0]), { token: it.token.length > 9 ? it.token.slice(0, 8) + "]" : it.token }, st.attState); }
        }
      });
      if (st.attState === "found" || st.attState === "masked") {
        c.font = "600 17px " + mono; let y = 384;
        for (const it of items) { c.fillStyle = st.attState === "masked" ? line : red; c.fillText((st.attState === "masked" ? it.token + "  " : "! ") + it.kind, 552, y); y += 26; }
      }
    }
    // status line
    const n = (st.msg || []).length + (st.att ? st.att.items.length : 0);
    const status = st.view === "scanning" ? ["skanowanie treści…", line] : st.view === "clear" ? ["brak danych chronionych – pakiet może wyjść, jeśli wymaga tego zadanie", ok]
      : st.view === "found" ? ["wykryto: " + n + " fragmenty chronione", red] : ["zamaskowano " + n + " fragmenty · zakaz wyjścia poza organizację", red];
    c.fillStyle = status[1]; c.font = "700 24px " + mono; c.fillText(status[0], 46, 560);
    refs.xrayTex.needsUpdate = true;
  }
  // Cabinet of GPU servers (one local model each), fronts facing the viewer; the chosen server slides out.
  function buildServerCabinet() {
    const { x, z } = CAB, base = FLOOR + 0.12;
    for (const [dx, dz] of [[-0.39, -0.32], [0.39, -0.32], [-0.39, 0.32], [0.39, 0.32]]) box(x + dx, z + dz, 0.05, 0.05, 0.95, "metal", base);
    box(x, z, 0.84, 0.7, 0.04, "rackDark", base + 0.91); box(x, z, 0.84, 0.7, 0.04, "rackDark", base);
    box(x, z - 0.33, 0.84, 0.03, 0.91, "rackDark", base);
    refs.blades = [0, 1, 2, 3].map(i => {
      const g = group(x, base + 0.06 + i * 0.21, z);
      box(0, 0, 0.7, 0.6, 0.16, "gpu", 0, g, 0.02);
      const led = own("gpuLed", { emissive: colors.gpuLed, emissiveIntensity: 0.15 });
      box(0, 0.302, 0.62, 0.01, 0.025, led, 0.02, g);
      const tex = canvasTexture(512, 64, (c, w, h) => { c.fillStyle = colors.gpu; c.fillRect(0, 0, w, h); c.fillStyle = colors.rackLine; c.font = "700 34px " + (options.font || "sans-serif"); c.textAlign = "center"; c.fillText("MODEL LOKALNY " + (i + 1), w / 2, 44); });
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.075), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); label.position.set(0, 0.11, 0.304); g.add(label);
      // the chosen server swallows the sheet, so it is exempt from the collision check
      if (i === CAB.chosen) g.traverse(o => { o.userData.noCollide = true; });
      return { g, led };
    });
  }
  // Numbered floor plates in front of each station.
  function buildPlates() {
    const plates = [[9.2, "1", "SKANER", "scan"], [10.0, "2", "ZŁOŻONOŚĆ", "klara"], [10.9, "3", "ZWROTNICA", "admin"], [12.25, "4", "MODELE LOKALNE", "ok"]];
    for (const [x, n, title, tone] of plates) {
      const tex = canvasTexture(512, 192, (c, w, h) => {
        c.fillStyle = colors.rackFace; c.fillRect(0, 0, w, h);
        c.fillStyle = colors[tone]; c.fillRect(0, 0, 14, h); c.beginPath(); c.arc(86, h / 2, 52, 0, Math.PI * 2); c.fill();
        c.fillStyle = colors.paper; c.font = "700 64px " + (options.font || "sans-serif"); c.fillText(n, 68, h / 2 + 23);
        c.font = "700 46px " + (options.font || "sans-serif"); c.fillText(title, 160, h / 2 + 16);
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.27), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      plate.rotation.x = -Math.PI / 2; plate.position.set(x, FLOOR + 0.125, 3.52); plate.receiveShadow = true; world.add(plate);
    }
  }
  // Light strips on the rails: chosen route green, blocked routes red.
  function buildTracks() {
    const segs = { local: [[[11.08, 2.98], LOCAL_TURN], [LOCAL_TURN, [CAB.x - 0.3, LOCAL_TURN[1]]]], apiq: [[[10.9, 2.58], [10.9, 1.82]]], frontier: [[[11.05, 2.65], [11.5, 2.2]], [[11.5, 2.2], [11.5, 1.82]]] };
    refs.tracks = {};
    for (const k of Object.keys(segs)) {
      const m = own("ok", { emissive: colors.ok, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
      const meshes = segs[k].map(([a, b]) => { const st = strip(a, b, 0.05, 0.012, m, FLOOR + 0.161); st.castShadow = false; st.visible = false; return st; });
      refs.tracks[k] = { m, meshes };
    }
  }

  // ─── Build: clouds (external models) ───
  function buildClouds() {
    refs.cloudMats = {};
    for (const key of ["apiq", "frontier"]) {
      const [x, y, z] = CLOUD[key], g = group(x, y, z);
      for (const [dx, dy, dz, r] of [[0, 0, 0, 0.55], [0.5, -0.05, 0.1, 0.42], [-0.5, -0.05, -0.05, 0.4], [0.15, 0.15, -0.3, 0.45], [-0.2, -0.1, 0.35, 0.38]])
        sphere(dx, dy, dz, r, "cloud", g, 1, 0.62, 1);
      box(0, 0.05, 0.5, 0.42, 0.26, "rackDark", 0.2, g, 0.04);
      if (key === "apiq") {
        const tex = canvasTexture(128, 128, (c) => drawQ(c, 0, 0, 128));
        const tile = new THREE.Mesh(geo("plane", [0.28, 0.28], () => new THREE.PlaneGeometry(0.28, 0.28)), new THREE.MeshStandardMaterial({ map: tex }));
        tile.rotation.x = -Math.PI / 2; tile.position.set(0, 0.465, 0.05); g.add(tile);
      } else ["providerA", "providerB", "providerC"].forEach((c, i) => box(-0.14 + i * 0.14, 0.05, 0.1, 0.1, 0.1, c, 0.46, g, 0.02));
      refs.cloudMats[key] = own(key === "apiq" ? "brand" : "admin", { emissive: colors[key === "apiq" ? "brand" : "admin"], emissiveIntensity: 0, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 40), refs.cloudMats[key]); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.2; g.add(ring);
    }
  }

  // ─── Build: packet, cable, paths ───
  function buildPaths() {
    const hop = [MON, [2.6, 1.46, MON[2]], [2.6, 1.46, 1.6]];
    const send = [{ line: [...hop, [2.6, FLOOR_RIDE, 1.6], [2.6, FLOOR_RIDE, LANE_Z], [7.95, FLOOR_RIDE, LANE_Z], [7.95, FLOOR_RIDE, 2.8], [7.95, RIDE, 2.8], INLET] }];
    const cablePts = [[2.6, 0.92, 2.0], [2.6, 0.92, 1.6], [2.6, 0.06, 1.6], [2.6, 0.06, LANE_Z], [7.95, 0.06, LANE_Z], [7.95, 0.06, 2.8], [8.1, 0.06, 2.8], [8.1, 0.3, 2.8], [8.45, 0.3, 2.8]];
    const inside = [{ line: [INLET, SCAN, GAUGE, SWITCH] }];
    const out = {
      local: [{ line: [SWITCH, [LOCAL_TURN[0], RIDE, LOCAL_TURN[1]], [CAB.x, RIDE, LOCAL_TURN[1]], GPU_IN] }],
      apiq: [{ line: [SWITCH, [10.9, RIDE, PORT_Z], [10.9, RIDE, 1.3], [11.25, RIDE, 0.9], GATE, [11.25, RIDE, -0.5]] },
        { curve: [[11.25, RIDE, -0.5], [11.25, 1.6, -0.9], [CLOUD.apiq[0], CLOUD.apiq[1] + 1.35, CLOUD.apiq[2] + 0.75], [CLOUD.apiq[0], CLOUD.apiq[1] + 0.82, CLOUD.apiq[2]]] }],
      frontier: [{ line: [SWITCH, [11.5, RIDE, 2.2], [11.5, RIDE, PORT_Z], [11.5, RIDE, 1.3], [11.25, RIDE, 0.9], GATE, [11.25, RIDE, -0.5]] },
        { curve: [[11.25, RIDE, -0.5], [11.25, 1.6, -0.9], [CLOUD.frontier[0], CLOUD.frontier[1] + 1.35, CLOUD.frontier[2] + 0.75], [CLOUD.frontier[0], CLOUD.frontier[1] + 0.82, CLOUD.frontier[2]]] }]
    };
    paths.send = makePath(send);
    paths.inlet2scan = makePath([{ line: [INLET, SCAN] }]); paths.scan2gauge = makePath([{ line: [SCAN, GAUGE] }]); paths.gauge2switch = makePath([{ line: [GAUGE, SWITCH] }]);
    for (const k of Object.keys(out)) {
      paths[k] = makePath(out[k]);
      paths["back_" + k] = makePath([...reverseSegments(out[k]), ...reverseSegments(inside), ...reverseSegments(send)]);
      // fraction of the outbound path at which the packet crosses the exit gate
      if (k !== "local") { const pts = paths[k].getSpacedPoints(400); let best = 0, bd = 1e9; pts.forEach((p, i) => { const dd = Math.hypot(p.x - GATE[0], p.z - GATE[2]) + Math.abs(p.y - GATE[1]); if (dd < bd) { bd = dd; best = i; } }); paths[k].gateU = best / 400; }
    }
    refs.trails = {};
    for (const k of ["apiq", "frontier"]) {
      const m = own("klara", { emissive: colors.klara, emissiveIntensity: 1.1, transparent: true, opacity: 0.7 });
      const tr = new THREE.Mesh(new THREE.TubeGeometry(paths[k], 220, 0.018, 6, false), m); tr.visible = false; tr.userData.noCollide = true; world.add(tr);
      refs.trails[k] = { mesh: tr, count: tr.geometry.index.count };
    }
    // cable along the send route (excluding the hop out of the screen)
    const cable = makePath([{ line: cablePts }]);
    const tube = new THREE.TubeGeometry(cable, 260, 0.024, 6, false);
    mesh(tube, "cable").userData.noCollide = true;
    refs.glowMat = own("klara", { emissive: colors.klara, emissiveIntensity: 1.1, transparent: true, opacity: 0.85 });
    refs.glow = new THREE.Mesh(new THREE.TubeGeometry(cable, 260, 0.032, 6, false), refs.glowMat); refs.glow.userData.noCollide = true; world.add(refs.glow);
    refs.glowCount = refs.glow.geometry.index.count; refs.sendLen = paths.send.getLength(); refs.cableLen = cable.getLength(); refs.hopLen = makePath([{ line: hop }]).getLength();
  }
  // Deterministic pseudo-random numbers so the fake text looks the same on every load.
  function seeded(seed) {
    return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function pill(c, x, y, w, h) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, h / 2); else c.rect(x, y, w, h); c.fill(); }
  // Unreadable "text": rows of rounded word strokes. Returns the rows so highlights can sit on real words.
  function fakeText(c, x, y, width, count, gap, thick, rnd) {
    const rows = [];
    for (let i = 0; i < count; i++) {
      const lineW = i === count - 1 ? width * (0.35 + rnd() * 0.25) : width * (0.84 + rnd() * 0.16), words = [];
      for (let cx = x; cx < x + lineW - 12;) { const ww = Math.min(x + lineW - cx, 22 + rnd() * 70); pill(c, cx, y + i * gap - thick / 2, ww, thick); words.push([cx, cx + ww]); cx += ww + 11 + rnd() * 7; }
      rows.push({ y: y + i * gap, words });
    }
    return rows;
  }
  // Texture px -> local plane coordinates.
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
    const tex = canvasTexture(PDF.tex[0], PDF.tex[1], (c, w, h) => {
      c.fillStyle = colors.paper; c.fillRect(0, 0, w, h);
      c.fillStyle = colors.cream; c.beginPath(); c.moveTo(w - 54, 0); c.lineTo(w, 54); c.lineTo(w - 54, 54); c.closePath(); c.fill();
      c.fillStyle = colors.danger; c.beginPath(); if (c.roundRect) c.roundRect(18, 22, 86, 40, 8); else c.rect(18, 22, 86, 40); c.fill();
      c.fillStyle = colors.paper; c.font = "800 26px " + (options.font || "sans-serif"); c.fillText("PDF", 33, 52);
      c.fillStyle = colors.rackLine; layout = fakeText(c, 20, 104, w - 40, 6, 36, 11, seeded(seed));
    });
    return { tex, layout };
  }
  // Highlight bars over chosen words: red while found, black redaction bars once masked.
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
    const pts = [[0, -0.05], [0, 0.03], [0.009, 0.042], [0.018, 0.03], [0.018, -0.038], [0.012, -0.046], [0.006, -0.038], [0.006, 0.018]]
      .map(([px, py]) => new THREE.Vector3(px, py, 0));
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
    refs.packetMat = own("klara", { emissive: colors.klara, emissiveIntensity: 0.9 });
    const msg = buildSheet("klara", refs.packetMat, 7, 8);
    refs.packet = msg.g;
    refs.msgMarks = markBars(msg.tilt, msg.layout, MSG_MARK_ROWS, SHEET.tex, SHEET.w, SHEET.h, 0.026);
    // attachments: PDF pages clipped onto the lower-right of the sheet, stacked when there are several
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
    refs.light = new THREE.PointLight(colors.klara, 0, 1.6, 1.6); world.add(refs.light);
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
    const id = s.sceneId, t = s.t, d = s.decision, o = order(id);
    const promptCount = s.prompt ? s.prompt.sensitive.length : 0, total = d ? d.protectedCount : 0, hasDoc = !!(s.prompt && s.prompt.attachment);
    const target = d ? d.target : "local", external = target !== "local";
    // employee robot
    const emp = refs.employee;
    let ex = STAND[0], ez = STAND[1], heading = Math.PI, walk = 0;
    if (id === "login") {
      const u = ease(phase(t, 0.04, 0.42)), p = paths.walk.getPointAt(u), q = paths.walk.getPointAt(Math.min(1, u + 0.01));
      ex = p.x; ez = p.z; if (u < 1) heading = Math.atan2(q.x - p.x, q.z - p.z); walk = u * paths.walk.getLength() * 16 * (u < 1 ? 1 : 0);
    }
    emp.g.position.set(ex, FLOOR, ez); emp.g.rotation.y = heading;
    const typing = id === "login" && t > 0.6 ? Math.sin(t * 60) * 0.2 : 0, reach = (id === "login" && t > 0.44) || id === "chat" ? -0.75 : 0;
    emp.limbs.forEach((limb, i) => {
      const leg = i % 2 === 0, side = i < 2 ? 1 : -1;
      limb.rotation.x = leg ? Math.sin(walk) * 0.55 * side : (walk ? -Math.sin(walk) * 0.45 * side : reach + typing * side);
    });
    // admin robot gestures at the console in the admin scene
    refs.adminBot.limbs.forEach((limb, i) => { limb.rotation.x = i % 2 ? (id === "admin" ? -0.8 + Math.sin(t * 20) * 0.15 * (i < 2 ? 1 : -1) : 0) : 0; });
    // screens
    const screenState = id === "login" ? (t > 0.45 ? "klaraTint" : "screen") : (id === "chat" || id === "send") ? "klaraTint"
      : id === "return" ? (t > 0.82 ? "klaraTint" : "screen") : "screen";
    refs.screenMat.color.set(colors[screenState]); refs.screenMat.emissive.set(colors[screenState]); refs.screenMat.emissiveIntensity = screenState === "screen" ? 0.25 : 0.55;
    refs.adminMat.emissiveIntensity = id === "admin" || id === "final" ? 0.9 : 0.3;
    // rack opening
    const open = o < order("scan") ? 0 : id === "scan" ? ease(phase(t, 0, 0.3)) : 1;
    refs.lid.position.y = FLOOR + 1.1 + 0.03 + open * 1.6; refs.lidMat.opacity = 1 - open; refs.lid.visible = open < 0.99;
    refs.front.position.z = 3.91 + open * 0.7; refs.frontMats.forEach(m => { m.opacity = 1 - open; m.depthWrite = open < 0.5; }); refs.front.visible = open < 0.99;
    refs.lid.castShadow = refs.front.castShadow = open < 0.5;
    info.rackOpen = +open.toFixed(2);
    // cable glow
    let glowU = 0;
    if (id === "send") glowU = clamp((ease(phase(t, 0.05, 0.95)) * refs.sendLen - refs.hopLen) / (refs.sendLen - refs.hopLen));
    else if (o > order("send") && o <= order("return")) glowU = 1;
    refs.glow.visible = glowU > 0; refs.glow.geometry.setDrawRange(0, Math.floor(refs.glowCount * clamp(glowU) / 3) * 3);
    // X-ray tunnel glows while the sheet is inside; the monitor shows message + attachment findings
    const scanning = id === "scan" && t > 0.4 && t < 0.88;
    refs.tunnelMat.emissiveIntensity = scanning ? 1.3 + 0.4 * Math.sin(t * 80) : 0.1; refs.beaconMat.emissiveIntensity = scanning ? 1.6 : 0;
    const promptItems = s.prompt ? s.prompt.sensitive : [], attItems = s.prompt && s.prompt.attachment ? s.prompt.attachment.sensitive : [];
    let xv = "idle", msgState = "none", attState = "none";
    if ((id === "scan" && t >= 0.4) || (o > order("scan") && o <= order("return"))) {
      const after = o > order("scan");
      msgState = after || t > 0.72 ? "masked" : t > 0.5 ? "found" : "none";
      attState = after || t > 0.72 ? "masked" : t > 0.62 ? "found" : t > 0.5 ? "reading" : "none";
      const any = promptItems.length + attItems.length > 0;
      xv = !after && t < 0.5 ? "scanning" : !any ? (after || t > 0.72 ? "clear" : "scanning") : msgState === "masked" ? "masked" : "found";
    }
    drawXray({ view: xv, msg: xv === "idle" ? [] : promptItems.map(i => ({ token: i.token })), msgState,
      att: s.prompt && s.prompt.attachment && xv !== "idle" ? { name: s.prompt.attachment.name, items: attItems.map(i => ({ token: i.token, kind: i.kind })) } : null, attState });
    info.scanView = xv;
    // gauge needle
    const level = d ? (d.level === "high" ? 0.66 : d.level === "routine" ? -0.62 : 0) : 0;
    let needle = NEEDLE_REST;
    if (id === "gauge") needle = NEEDLE_REST + (-level - NEEDLE_REST) * easeOutBack(phase(t, 0.3, 0.85));
    else if (o > order("gauge")) needle = -level;
    refs.needle.rotation.z = needle;
    // switch arrow + barriers + padlocks
    let arrowU = id === "route" ? easeOutBack(phase(t, 0.62, 0.84)) : o > order("route") ? 1 : 0;
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
    // packet path
    let packetPos = null, packetVisible = false, answerVisible = false, node = "none";
    const at = (path, u) => path.getPointAt(clamp(u));
    if (id === "send") { packetPos = at(paths.send, ease(phase(t, 0.05, 0.95))); packetVisible = t > 0.02; node = t >= 0.95 ? "inlet" : "moving"; }
    else if (id === "scan") { packetPos = at(paths.inlet2scan, ease(phase(t, 0.3, 0.5))); packetVisible = true; node = t >= 0.5 ? "scan" : "moving"; }
    else if (id === "gauge") { packetPos = at(paths.scan2gauge, ease(phase(t, 0, 0.3))); packetVisible = true; node = t >= 0.3 ? "gauge" : "moving"; }
    else if (id === "route") { packetPos = at(paths.gauge2switch, ease(phase(t, 0, 0.15))); packetVisible = true; node = t >= 0.15 ? "switch" : "moving"; }
    else if (id === "model") { const end = external ? 0.72 : 0.4; packetPos = at(paths[target], ease(phase(t, 0, end))); packetVisible = true; node = t >= end ? target : "moving"; }
    else if (id === "return") { packetPos = at(paths["back_" + target], ease(phase(t, 0, 0.82))); answerVisible = true; node = t >= 0.82 ? "desk" : "moving"; }
    for (const k of ["apiq", "frontier"]) {
      const tr = refs.trails[k], u = target !== k ? 0 : id === "model" ? ease(phase(t, 0, 0.72)) : id === "return" ? 1 - phase(t, 0.2, 0.6) : 0;
      tr.mesh.visible = u > 0; tr.mesh.geometry.setDrawRange(0, Math.floor(tr.count * u / 3) * 3);
    }
    info.packetNode = node;
    refs.packet.visible = packetVisible; refs.answer.visible = answerVisible;
    const carrier = packetVisible ? refs.packet : answerVisible ? refs.answer : null;
    // the sheet faces the camera and sways a little as it travels
    // the chosen GPU server swallows the sheet (model) and hands back the answer (return)
    const shrink = !external && id === "model" ? 1 - 0.97 * ease(phase(t, 0.28, 0.4)) : !external && id === "return" ? 0.03 + 0.97 * ease(phase(t, 0.02, 0.14)) : 1;
    if (carrier && packetPos) { carrier.position.copy(packetPos); carrier.rotation.y = SHEET.facing + Math.sin(t * 9) * 0.04; carrier.scale.setScalar(SHEET.scale * shrink); }
    refs.light.intensity = carrier ? 1.0 : 0; if (carrier) refs.light.position.copy(packetPos).add(new THREE.Vector3(0, 0.3, 0.15));
    // protected data: words light up red when the scanner finds them, then turn into black redaction bars
    const masked = o > order("scan") || (id === "scan" && t > 0.72), found = o > order("scan") || (id === "scan" && t > 0.5), docRead = o > order("scan") || (id === "scan" && t > 0.62);
    const pulse = id === "scan" && t > 0.5 && t < 0.72 ? 0.5 * Math.abs(Math.sin(t * 60)) : 0;
    const paint = (m, on) => { const c = colors[on ? "chipMasked" : "danger"]; m.color.set(c); m.emissive.set(c); m.emissiveIntensity = on ? 0.05 : 0.35 + pulse; };
    const redact = (mk, show) => { mk.bar.visible = show; if (!show) return; const c = colors[masked ? "ink" : "danger"]; mk.m.color.set(c); mk.m.emissive.set(c); mk.m.emissiveIntensity = masked ? 0 : 0.45 + pulse; };
    refs.msgMarks.forEach((mk, i) => redact(mk, found && i < promptCount));
    const attachments = s.prompt ? (s.prompt.attachments || (s.prompt.attachment ? [s.prompt.attachment] : [])) : [];
    const attCount = Math.max(0, total - promptCount);
    refs.pdfs.forEach((pdf, i) => { pdf.g.visible = i < attachments.length; pdf.marks.forEach((mk, k) => redact(mk, docRead && k < attCount)); });
    info.attachments = Math.min(attachments.length, refs.pdfs.length);
    info.redactions = [...refs.msgMarks, ...refs.pdfs.flatMap(pdf => pdf.marks)].filter(mk => mk.bar.visible).length;
    // rules board: lamps light one after another in the route scene
    const rules = Array.isArray(s.rules) ? s.rules : [];
    refs.ruleLamps.forEach((m, i) => {
      const shown = rules[i] && (o > order("route") && o <= order("final") || (id === "route" && t > 0.15 + i * 0.15));
      const st = shown ? rules[i] : "idle", c = colors[st === "hit" ? RULE_HIT[i] : st === "pass" ? "paper" : "chipMasked"];
      m.color.set(c); m.emissive.set(c); m.emissiveIntensity = st === "hit" ? 1.6 : st === "pass" ? 0.25 : 0;
      refs.ruleRows[i].opacity = st === "hit" ? 0.28 : 0; refs.ruleRows[i].color.set(colors[RULE_HIT[i]]); refs.ruleRows[i].emissive.set(colors[RULE_HIT[i]]);
    });
    info.rules = rules.map((r, i) => (refs.ruleRows[i].opacity > 0 ? "H" : r[0])).join("");
    // lit tracks once the switch has thrown
    const trackOn = (id === "route" && t > 0.8) || (o > order("route") && o <= order("return"));
    for (const k of ["local", "apiq", "frontier"]) {
      const st = d ? d.states[k] : "faded", tr = refs.tracks[k], lit = trackOn && (st === "on" || st === "blocked" || st === "off");
      tr.meshes.forEach(m => { m.visible = lit; }); if (lit) { const c = colors[st === "on" ? "ok" : "danger"]; tr.m.color.set(c); tr.m.emissive.set(c); }
    }
    // model at work: GPU glow + fans, gate + cloud glow
    const work = id === "model" ? (external ? 0 : phase(t, 0.4, 0.55)) : id === "return" && !external ? 1 - phase(t, 0, 0.3) : 0;
    const slide = external ? 0 : id === "model" ? ease(phase(t, 0.05, 0.25)) * (1 - ease(phase(t, 0.5, 0.65))) : id === "return" ? 1 - ease(phase(t, 0.3, 0.42)) : 0;
    refs.blades.forEach((b, i) => {
      const chosen = i === CAB.chosen;
      b.g.position.z = CAB.z + (chosen ? slide * 0.3 : 0);
      b.led.emissiveIntensity = chosen ? 0.15 + Math.max(work, id === "model" && !external && t > 0.4 ? 1 : 0) * 1.6 : 0.15 + 0.1 * (i % 2);
    });
    info.blade = +slide.toFixed(2);
    const gateU = id === "model" && external ? 1 - clamp(Math.abs(phase(t, 0, 0.72) - paths[target].gateU) * 9) : 0;
    refs.gateMat.emissiveIntensity = gateU * 1.4;
    for (const key of ["apiq", "frontier"]) refs.cloudMats[key].emissiveIntensity = (id === "model" && target === key ? phase(t, 0.72, 0.85) : id === "return" && target === key ? 1 - phase(t, 0, 0.3) : 0) * 1.5;
    return { packetPos, work, carrier };
  }

  // ─── Camera ───
  function desiredShot(s, poseOut) {
    const id = s.sceneId, t = s.t, ext = s.decision && s.decision.target !== "local";
    const follow = (span, p = poseOut.packetPos) => ({ target: [p.x, p.y + 0.15, p.z], span, angle: 0.62, elev: 0.62 });
    if (id === "login") { if (t > 0.44) return SHOTS.monitor; if (t < 0.1) return SHOTS.over; const e = refs.employee.g.position; return { target: [e.x, 0.6, e.z], span: 3.4, angle: 0.62, elev: 0.6 }; }
    if (id === "chat") return SHOTS.monitor;
    if (id === "send") return t > 0.9 || !poseOut.packetPos ? SHOTS.rackOut : follow(2.8);
    if (id === "scan") return t < 0.3 ? SHOTS.rackOut : SHOTS.scan;
    if (id === "gauge") return SHOTS.gauge;
    if (id === "route") return SHOTS.route;
    if (id === "model") {
      if (!ext) return SHOTS.gpu;
      const c = CLOUD[s.decision.target];
      return t > 0.72 ? { target: [(c[0] + GATE[0]) / 2, 2.0, -1.3], span: 5.8, angle: 0.62, elev: 0.5 } : follow(3.4);
    }
    if (id === "return") return t > 0.84 || !poseOut.packetPos ? SHOTS.monitor : follow(3.4);
    if (id === "admin") return SHOTS.admin;
    return SHOTS.over;
  }
  function updateCamera(shot, dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
    const tgt = shot.target;
    if (!view.target) view.target = v3(SHOTS.over.target);
    const before = view.target.x + view.target.y + view.target.z + view.span + view.angle + view.elev;
    view.target.x = lerp(view.target.x, tgt[0], k); view.target.y = lerp(view.target.y, tgt[1], k); view.target.z = lerp(view.target.z, tgt[2], k);
    view.span = lerp(view.span, shot.span, k); view.angle = lerp(view.angle, shot.angle, k); view.elev = lerp(view.elev, shot.elev, k);
    const after = view.target.x + view.target.y + view.target.z + view.span + view.angle + view.elev;
    settled = Math.abs(after - before) < 1e-4;
    const a = view.angle + user.yaw, e = view.elev, aspect = width / height, span = view.span / user.zoom;
    camera.position.set(view.target.x + Math.sin(a) * Math.cos(e) * 30, view.target.y + Math.sin(e) * 30, view.target.z + Math.cos(a) * Math.cos(e) * 30);
    camera.lookAt(view.target);
    camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    info.camera = shot === SHOTS.monitor ? "monitor" : shot === SHOTS.admin ? "admin" : shot === SHOTS.over ? "over" : "scene";
  }
  function updateLabels(s) {
    const d = s.decision, routeScenes = order(s.sceneId) >= order("route");
    const v = new THREE.Vector3();
    for (const item of labelItems) {
      const l = item.def;
      let show = l.scenes.includes(s.sceneId) && !(s.callouts || []).some(c => c.anchor === l.id);
      if (show && l.route && s.sceneId === "model") show = d && d.target === l.route;
      if (show && l.id === "gate" && s.sceneId !== "final") show = d && d.target !== "local" || s.sceneId === "route";
      v.copy(item.pos).project(camera);
      const x = (v.x + 1) / 2 * width, y = (1 - v.y) / 2 * height;
      const hidden = !show || v.z > 1 || x < 20 || x > width - 20 || y < 24 || y > height - 4;
      if (hidden !== item.lastHidden) { item.el.hidden = hidden; item.lastHidden = hidden; }
      if (hidden) continue;
      const rx = Math.round(x), ry = Math.round(y);
      if (rx !== item.lastX || ry !== item.lastY) { item.el.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -100%)`; item.lastX = rx; item.lastY = ry; }
      const st = l.route && d && routeScenes ? d.states[l.route] : l.id === "gate" && d && routeScenes ? (d.target === "local" ? (d.states.apiq === "faded" ? "faded" : d.states.apiq) : "on") : "";
      if (st !== item.lastState) { item.el.dataset.state = st; item.lastState = st; }
    }
  }

  // Explanation cards anchored to 3D points; content (kicker, title, lines) comes from the app.
  function updateCallouts(s) {
    const list = Array.isArray(s.callouts) ? s.callouts : [], seen = new Set(), v = new THREE.Vector3();
    for (const c of list) {
      if (!ANCHORS[c.anchor]) continue;
      seen.add(c.id);
      let item = callouts.get(c.id);
      if (!item) {
        const el = document.createElement("div"); el.className = "co"; el.dataset.callout = c.id;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line"), dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("r", "4"); coSvg.append(line, dot); labelsEl.appendChild(el);
        item = { el, line, dot, sig: "" }; callouts.set(c.id, item);
      }
      const sig = JSON.stringify(c);
      if (sig !== item.sig) {
        item.sig = sig; const el = item.el; el.replaceChildren(); el.dataset.tone = c.tone || "klara";
        for (const node of [item.line, item.dot]) node.dataset.tone = c.tone || "klara";
        if (c.kicker) { const k = document.createElement("span"); k.className = "co-k"; k.textContent = c.kicker; el.appendChild(k); }
        const b = document.createElement("b"); b.textContent = c.title; el.appendChild(b);
        if (c.lines && c.lines.length) {
          const ul = document.createElement("ul");
          for (const ln of c.lines) { const li = document.createElement("li"); li.dataset.state = ln.state || "muted"; li.textContent = ln.text; ul.appendChild(li); }
          el.appendChild(ul);
        }
        item.w = el.offsetWidth; item.h = el.offsetHeight;
      }
      v.set(...ANCHORS[c.anchor]).project(camera);
      const ax = (v.x + 1) / 2 * width, ay = (1 - v.y) / 2 * height, gap = 34, w = item.w, h = item.h, side = c.side || "right";
      let x = side === "left" ? ax - gap - w : side === "right" ? ax + gap : ax - w / 2;
      let y = side === "top" ? ay - gap - h : side === "bottom" ? ay + gap : ay - h / 2;
      x = clamp(x, 8, Math.max(8, width - w - 8)); y = clamp(y, 8, Math.max(8, height - h - 8));
      item.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; item.el.hidden = false;
      const ex = clamp(ax, x, x + w), ey = clamp(ay, y, y + h);
      item.line.setAttribute("x1", ax.toFixed(1)); item.line.setAttribute("y1", ay.toFixed(1)); item.line.setAttribute("x2", ex.toFixed(1)); item.line.setAttribute("y2", ey.toFixed(1));
      item.dot.setAttribute("cx", ax.toFixed(1)); item.dot.setAttribute("cy", ay.toFixed(1));
      item.line.style.display = item.dot.style.display = "";
    }
    for (const [cid, item] of callouts) if (!seen.has(cid)) { item.el.hidden = true; item.line.style.display = item.dot.style.display = "none"; }
    info.callouts = seen.size;
  }

  // ─── Frame ───
  function frame(s, dt) {
    if (info.renderer !== "webgl" || !s) return;
    info.frames++;
    const sig = [s.sceneId, s.t.toFixed(4), s.decision ? s.decision.target + s.decision.states.apiq : "", s.prompt ? s.prompt.id : "", s.calloutsSig || "", width, height, user.yaw, user.zoom].join("|");
    const fansOn = s.sceneId === "model" || s.sceneId === "return";
    if (sig === lastSig && settled && !fansOn) return;
    lastSig = sig;
    const p = pose(s, dt);
    updateCamera(desiredShot(s, p), dt, s.reduced);
    updateLabels(s); updateCallouts(s);
    renderer.render(scene, camera); info.renders++;
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
      options.font = css.getPropertyValue("--font-ui").trim();
      if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
      renderer.domElement.className = "world-canvas"; renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "Świat 3D: biuro, kabel do serwerowni, Quantica AI Server i modele zewnętrzne. Przeciągnij, aby obrócić; kółko przybliża; dwuklik resetuje widok.");
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
      world = new THREE.Group(); scene.add(world);
      buildRooms(); buildOffice(); buildRack(); buildClouds(); buildPaths(); buildPacket();
      paths.walk = makePath([{ line: [[DOOR[0], FLOOR, DOOR[1]], [1.5, FLOOR, 4.7], [2.6, FLOOR, 3.75], [STAND[0], FLOOR, STAND[1]]] }]);
      refs.employee = buildRobot("brand"); refs.adminBot = buildRobot("admin");
      refs.adminBot.g.position.set(ADMIN.x, FLOOR, ADMIN.z + 0.62); refs.adminBot.g.rotation.y = Math.PI;
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

  // ─── Diagnostics: does the travelling sheet pass through scene geometry? ───
  // Replays every travelling scene in small steps, samples points on the sheet/PDF/answer planes and reports
  // the visible meshes whose world bounding box contains a sample point.
  function debugCollisions(step = 0.02) {
    if (info.renderer !== "webgl") return { ok: false, error: "no webgl" };
    const K = window.KlaraData, key = c => Object.keys(colors).find(k => colors[k] && new THREE.Color(colors[k]).getHex() === c.getHex()) || "#" + c.getHexString();
    const carriers = new Set(); [refs.packet, refs.answer].forEach(c => c.traverse(o => carriers.add(o)));
    const shown = o => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
    const runs = [["attachment", "apiq"], ["complex", "apiq"], ["complex", "frontier"], ["routine", "apiq"]];
    const scenes = ["send", "scan", "gauge", "route", "model", "return"], hits = new Map(), box = new THREE.Box3(), pt = new THREE.Vector3();
    const samples = [];
    for (const [pid, pol] of runs) {
      const prompt = K.promptById(pid), decision = K.decide(prompt, { external: pol });
      for (const sceneId of scenes) for (let t = 0; t <= 1.0001; t += step) {
        pose({ sceneId, t, prompt, decision, rules: [], callouts: [] }, 0); world.updateMatrixWorld(true);
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
          box.setFromObject(o).expandByScalar(-0.004);
          if (box.isEmpty() || !samples.some(p => box.containsPoint(p))) return;
          const c = box.getCenter(new THREE.Vector3()), id = `${o.geometry.type}:${key(mats[0].color)}@${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}`;
          const hk = sceneId + "|" + id, prev = hits.get(hk);
          hits.set(hk, prev ? { ...prev, t1: +t.toFixed(2), runs: prev.runs.add(pid + "/" + pol) } : { scene: sceneId, mesh: id, t0: +t.toFixed(2), t1: +t.toFixed(2), runs: new Set([pid + "/" + pol]) });
        });
      }
    }
    lastSig = "";
    const list = [...hits.values()].map(h => ({ ...h, runs: [...h.runs].join(" ") }));
    return { ok: list.length === 0, count: list.length, hits: list };
  }

  return { init, frame, resetView, debugCollisions, info: () => ({ ...info }) };
})();
