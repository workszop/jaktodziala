/* App core – the shared shell of the "… od środka" apps: scene state machine, stepper, narration panel, desktop with
   the product window (login, chat), final card, Auto / Krok po kroku, keyboard, DOM contract (data-* on #app),
   App.probe() / App.selfTest(). A product supplies its data, decision, settings and content hooks:
   AppCore.start({ data, world, brand, autoOrder, dwell, icons, flowNodes, defaultSettings, decide, hooks }). */
window.AppCore = (() => {
  "use strict";

  // ─── Constants ───
  const BASE_ICONS = {
    desk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    cable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h6a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4h2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="18" r="1.5"/></svg>',
    local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
    check: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    ok: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
    clip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 12-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/></svg>',
    doc: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    folder: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    mail: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    calendar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    trash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    send: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>'
  };
  const NAV_KEYS = ["arrowright", "arrowleft", "pagedown", "pageup", " ", "n", "enter", "1", "2", "3", "4", "r"];

  function start(P) {
    const K = P.data, W = P.world, B = P.brand, H = P.hooks;
    const SCENES = K.SCENES, IDX = Object.fromEntries(SCENES.map((s, i) => [s.id, i]));
    const ICONS = { ...BASE_ICONS, ...(P.icons || {}) };
    const AUTO_ORDER = P.autoOrder, DWELL = { login: 2.4, admin: 6, final: 9, default: 3.4, ...(P.dwell || {}) };
    const PARAMS = new URLSearchParams(location.search);
    const SPEED = Math.min(4, Math.max(0.25, parseFloat(PARAMS.get("speed")) || 1));
    const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ─── State ───
    const state = {
      scene: 0, t: 0, playing: false, promptId: null, settings: P.defaultSettings(), runSettings: null,
      runId: 0, recorded: -1, runs: [], reached: 0, auto: false, dwell: 0, fresh: false, announced: "",
      renderer: "loading", monitorKey: "", progressKey: "", lastFrame: performance.now()
    };

    // ─── DOM refs ───
    const $ = id => document.getElementById(id);
    const app = $("app"), stage = $("stage"), labels = $("labels"), stepsEl = $("steps"), monitor = $("monitor"), display = $("display");
    const finalEl = $("final"), statusEl = $("status"), flowEl = $("flow"), flowBig = $("flowBig"), inspector = $("inspector");
    const pNum = $("pNum"), pShort = $("pShort"), pTitle = $("pTitle"), pProg = $("pProg"), pLead = $("pLead"), pBullets = $("pBullets"), pActions = $("pActions");
    const btnBack = $("btnBack"), btnNext = $("btnNext"), nextLabel = $("nextLabel"), btnAuto = $("btnAuto"), btnStep = $("btnStep"), modeSwitch = $("modeSwitch"), btnRestart = $("btnRestart");
    const help = $("help"), btnHelp = $("btnHelp"), btnHelpClose = $("btnHelpClose"), btnProbe = $("btnProbe"), probeOut = $("probeOut");

    // ─── Helpers ───
    const sceneDef = () => SCENES[state.scene];
    const sid = () => sceneDef().id;
    const prompt = () => K.promptById(state.promptId);
    const settings = () => state.runSettings || state.settings;
    const decision = () => P.decide(prompt(), settings());
    const phase = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
    const after = (id, t0 = 1) => state.scene > IDX[id] || (state.scene === IDX[id] && state.t >= t0);
    function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function icon(name, cls) { const s = el("span", cls); s.innerHTML = ICONS[name] || ""; s.setAttribute("aria-hidden", "true"); return s; }
    function button(cls, text, onClick, extra) { const b = el("button", cls, text); b.type = "button"; b.addEventListener("click", onClick); if (extra) extra(b); return b; }
    const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
    const nextUntried = () => {
      const tried = new Set(state.runs.map(r => r.promptId)); if (state.promptId) tried.add(state.promptId);
      return AUTO_ORDER.find(id => !tried.has(id)) || AUTO_ORDER[(AUTO_ORDER.indexOf(state.promptId) + 1) % AUTO_ORDER.length];
    };
    // Text as DOM with fragments wrapped in <mark> (never innerHTML with data). mode: plain | found | masked.
    function markNodes(text, list, mode, cls = "pii") {
      const frag = document.createDocumentFragment(); let rest = text;
      if (mode === "plain") { frag.appendChild(document.createTextNode(rest)); return frag; }
      for (const item of list) {
        const at = rest.indexOf(item.text); if (at < 0) continue;
        frag.appendChild(document.createTextNode(rest.slice(0, at)));
        const m = el("mark", cls, mode === "masked" ? item.token : item.text);
        if (item.kind) { m.dataset.kind = item.kind; m.title = item.kind; } m.dataset.masked = String(mode === "masked"); frag.appendChild(m);
        rest = rest.slice(at + item.text.length);
      }
      frag.appendChild(document.createTextNode(rest)); return frag;
    }
    const c = {}; // context handed to product hooks, filled once functions exist
    function snapshot() {
      const p = prompt(), d = p ? decision() : null, co = p ? H.calloutsFor(c, p, d) : [];
      return { sceneId: sid(), t: state.t, prompt: p, decision: d, callouts: co, calloutsSig: JSON.stringify(co), reduced: REDUCED, ...(H.snapshotExtra ? H.snapshotExtra(c, p, d) : {}) };
    }

    // ─── Render: steps, panel, flow ───
    function buildSteps() {
      SCENES.forEach((s, i) => {
        const li = el("li"), b = button("step", null, () => { if (i <= state.reached) goTo(i, { play: i !== state.scene }); });
        b.dataset.scene = s.id; b.append(el("span", "n", s.n), el("span", "t", s.short)); b.title = s.n + " · " + s.title;
        li.appendChild(b); stepsEl.appendChild(li);
      });
    }
    function renderSteps() {
      [...stepsEl.querySelectorAll(".step")].forEach((b, i) => {
        b.disabled = i > state.reached; b.dataset.state = i < state.scene ? "done" : i === state.scene ? "current" : "todo";
        if (i === state.scene) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      });
      const cur = stepsEl.querySelector('[aria-current="step"]'), nav = stepsEl.parentElement;
      if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2 });
    }
    function buildFlow(container) {
      for (const n of P.flowNodes) { const d = el("div", "node"); d.dataset.node = n.id; d.dataset.state = "idle"; d.append(icon(n.icon || n.id), el("span", null, n.label)); container.appendChild(d); }
    }
    function renderFlow() {
      const st = H.flowStates(c, sid(), state.t, prompt() ? decision() : null);
      for (const box of [flowEl, flowBig]) box.querySelectorAll(".node").forEach(n => { const v = st[n.dataset.node] || "idle"; if (n.dataset.state !== v) n.dataset.state = v; });
    }
    function renderPanel() {
      const s = sceneDef(), n = H.narration(c);
      setText(pNum, s.n); setText(pShort, s.short); setText(pTitle, s.title); setText(pLead, n.lead);
      pBullets.replaceChildren(...n.bullets.map(b => el("li", null, b)));
      pActions.replaceChildren(...(H.panelActions ? H.panelActions(c) : []));
      btnBack.disabled = state.scene === 0;
      nextLabel.textContent = (P.nextLabels || {})[s.id] || "Dalej";
      btnNext.disabled = s.id === "chat" && !state.promptId;
      inspector.hidden = !(state.scene >= IDX.send && state.scene <= IDX.return && prompt());
    }

    // ─── Render: monitor screens (desktop with the product window, admin console) ───
    function monitorView() {
      const id = sid(), t = state.t;
      if (id === "login") return { view: "desktop", mode: "login", show: t > 0.46 };
      if (id === "chat") return { view: "desktop", mode: "compose", show: true };
      if (id === "return") return { view: "desktop", mode: "answer", show: t > 0.86 };
      if (id === "admin") return { view: "admin", show: t > 0.4 };
      return { view: "none", show: false };
    }
    function renderMonitor() {
      const mv = monitorView();
      const key = [mv.view, mv.mode, state.promptId, state.runs.length, JSON.stringify(state.settings), state.runId].join("|");
      if (key !== state.monitorKey) {
        state.monitorKey = key; display.replaceChildren(); display.dataset.view = mv.view;
        if (mv.view === "desktop") buildDesktop(mv.mode); else if (mv.view === "admin") display.appendChild(H.buildAdmin(c));
      }
      monitor.classList.toggle("show", mv.show); monitor.dataset.view = mv.view; monitor.inert = !mv.show;
      updateMonitor(mv);
    }
    function buildDesktop(mode) {
      const desk = el("div", "desk"), icons = el("div", "desk-icons");
      const tile = (name, label, id) => { const d = el("div", "dicon"); if (id) d.id = id; const ic = el("div", "ic"); if (name === "product") ic.appendChild(el("div", "kmark", B.mark)); else ic.appendChild(icon(name)); d.append(ic, el("span", null, label)); return d; };
      icons.append(tile("product", B.name, "deskProduct"), tile("folder", "Dokumenty"), tile("mail", "Poczta"), tile("calendar", "Kalendarz"), tile("trash", "Kosz"));
      const win = el("div", "win" + (mode === "login" ? "" : " open")); win.id = "pwin"; win.dataset.mode = mode;
      const bar = el("div", "wbar"), dots = el("span", "wdots"); dots.append(el("i"), el("i"), el("i"));
      bar.append(el("span", "kmark sm", B.mark), el("span", null, B.name + " – " + B.tagline), dots);
      const body = el("div", "wbody"); win.append(bar, body);
      body.appendChild(mode === "login" ? buildLogin() : buildChat(mode));
      const task = el("div", "taskbar"), startBtn = el("span", "tstart", "Q"), pin = el("span", "tpin" + (mode === "login" ? "" : " on")); pin.id = "taskProduct"; pin.appendChild(el("span", "kmark sm", B.mark));
      task.append(startBtn, pin, el("span", "tspacer"), el("span", "ttray", K.ORG.name), el("span", "ttray", "09:12"));
      desk.append(icons, win, task); display.appendChild(desk);
    }
    function buildLogin() {
      const wrap = el("div", "login"), card = el("div", "login-card"), head = el("header"), h = el("div");
      h.append(el("h3", null, B.name), el("small", null, K.ORG.name + " · " + K.ORG.note)); head.append(el("div", "kmark", B.mark), h);
      const f1 = el("label", "field", "Konto organizacji"), o1 = el("output"); o1.id = "lgUser"; f1.appendChild(o1);
      const f2 = el("label", "field", "Hasło"), o2 = el("output"); o2.id = "lgPass"; f2.appendChild(o2);
      const go = el("div", "go", "Zaloguj"); go.id = "lgGo"; go.style.textAlign = "center";
      const ok = el("div", "badge-ok"); ok.id = "lgOk"; const okText = el("div");
      okText.append(el("b", null, "Zalogowano: " + K.USER.name + " · " + K.USER.dept), el("div", null, "Uprawnienia: " + K.USER.rights));
      ok.append(icon("ok"), okText);
      card.append(head, f1, f2, go, ok); wrap.appendChild(card); return wrap;
    }
    function chatSide() {
      const side = el("aside", "kside"), who = el("div", "who"), wt = el("div");
      wt.append(el("b", null, B.name), el("small", null, B.tagline)); who.append(el("div", "kmark", B.mark), wt);
      const list = el("ul"); ["Nowa rozmowa", ...B.history].forEach((x, i) => list.appendChild(el("li", i ? null : "cur", x)));
      side.append(who, el("div", "new", "+ Nowa rozmowa"), list, el("div", "user", K.USER.name + " · " + K.USER.dept + " · " + K.ORG.name));
      return side;
    }
    function exchange(msgs, run) {
      const p = K.promptById(run.promptId);
      const u = el("div", "bubble user"); u.append(el("span", "who", K.USER.name), document.createTextNode(p.text));
      const ux = H.userExtra && H.userExtra(c, p); if (ux) u.appendChild(ux);
      const b = el("div", "bubble bot"); b.append(el("span", "who", B.name));
      H.answerBody(c, run, b);
      msgs.append(u, b);
    }
    function buildChat(mode) {
      const appEl = el("div", "kapp"), main = el("div", "kmain"), head = el("div", "khead"), pill = el("span", "pill");
      pill.append(el("i"), document.createTextNode(B.chatPill)); head.append(el("b", null, B.name), pill);
      const msgs = el("div", "kmsgs"); msgs.setAttribute("aria-live", "polite");
      const hello = el("div", "bubble bot"); hello.append(el("span", "who", B.name), document.createTextNode(B.hello)); msgs.appendChild(hello);
      state.runs.filter(r => mode === "compose" || r.runId !== state.runId).forEach(r => exchange(msgs, r));
      if (mode === "answer" && prompt()) exchange(msgs, { promptId: state.promptId, ...H.currentRun(c, decision()) });
      const comp = el("div", "kcomp"), chips = el("div", "chips"); chips.setAttribute("role", "radiogroup"); chips.setAttribute("aria-label", B.chipsLabel);
      for (const p of K.PROMPTS) {
        const b = button("chip", null, () => mode === "compose" ? choosePrompt(p.id) : startRun(p.id));
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(mode === "compose" && state.promptId === p.id)); b.dataset.prompt = p.id;
        b.append(document.createTextNode(p.label), el("kbd", null, p.key)); chips.appendChild(b);
      }
      const row = el("div", "input-row"), input = el("div", "input"); input.dataset.placeholder = mode === "compose" ? B.placeholder : B.placeholderNext;
      if (mode === "compose" && prompt()) input.textContent = prompt().text;
      const send = button("send", null, () => next()); send.append(icon("send"), document.createTextNode("Wyślij")); send.disabled = mode !== "compose" || !state.promptId; send.id = "chatSend";
      row.append(input, send); comp.append(chips);
      const cx = mode === "compose" && prompt() && H.composeExtra ? H.composeExtra(c, prompt()) : null; if (cx) comp.appendChild(cx);
      comp.appendChild(row);
      main.append(head, msgs, comp); appEl.append(chatSide(), main);
      requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
      return appEl;
    }
    function updateMonitor(mv) {
      const t = state.t;
      if (mv.view === "desktop" && mv.mode === "login") {
        const u = $("lgUser"), pw = $("lgPass"), go = $("lgGo"), ok = $("lgOk"), icn = $("deskProduct"), win = $("pwin"), pin = $("taskProduct"); if (!u) return;
        icn.classList.toggle("pulse", t > 0.5 && t < 0.6); win.classList.toggle("open", t >= 0.58); pin.classList.toggle("on", t >= 0.58);
        const chars = Math.round(phase(t, 0.62, 0.72) * K.USER.login.length), dots = Math.round(phase(t, 0.74, 0.8) * 10);
        setText(u, K.USER.login.slice(0, chars)); setText(pw, "•".repeat(dots));
        u.classList.toggle("caret", t >= 0.6 && t < 0.73); pw.classList.toggle("caret", t >= 0.73 && t < 0.81);
        go.classList.toggle("pressed", t > 0.82 && t < 0.86); ok.classList.toggle("show", t >= 0.86);
      }
    }

    // ─── Render: final card ───
    function renderFinal() {
      const show = sid() === "final"; finalEl.classList.toggle("show", show); finalEl.inert = !show;
      if (!show) { if (finalEl.childElementCount) finalEl.replaceChildren(); return; }
      if (finalEl.childElementCount) return;
      const card = el("div", "final-card"), h = el("h3", null, B.finalTitle);
      h.appendChild(el("small", null, B.finalSub));
      const left = el("div"), runs = el("ul", "runs"), hh = el("h4", null, "Twoje przebiegi"); hh.style.marginBottom = "8px";
      left.append(hh, runs);
      if (!state.runs.length) runs.appendChild(el("li", null, "Brak zakończonych przebiegów."));
      state.runs.forEach(r => { const li = el("li"); const [label, result] = H.runLine(c, r); li.append(el("span", null, label), el("em", null, result)); runs.appendChild(li); });
      const ben = el("div", "benefits");
      K.BENEFITS.forEach(b => { const d = el("div", "benefit"); d.append(el("b", null, b.title), el("span", null, b.text)); ben.appendChild(d); });
      const acts = el("div", "final-actions");
      acts.append(button("btn btn-primary", B.tryAnother, () => startRun(nextUntried()), b => { b.style.flex = "none"; }),
        button("btn btn-ghost", B.adminAction, () => goTo(IDX.admin)),
        button("btn btn-ghost", "Zacznij od nowa", () => restart()));
      const link = el("a", "btn btn-ghost", B.name + " na quanticalab.ai"); link.href = K.SOURCE_URL; link.target = "_blank"; link.rel = "noopener"; acts.appendChild(link);
      if (B.sibling) { const sib = el("a", "btn btn-ghost", B.sibling.label); sib.href = B.sibling.href; acts.appendChild(sib); }
      card.append(h, left, ben, acts); finalEl.appendChild(card);
    }

    // ─── Render: contract + orchestration ───
    function renderContract() {
      const p = prompt(), d = p ? decision() : null, done = !state.playing && state.t >= 1, ds = app.dataset;
      ds.scene = sid(); ds.phase = done ? "done" : "playing"; ds.prompt = p ? p.id : "";
      ds.packet = done ? K.packetAt(sid(), d) : "moving"; ds.runs = String(state.runs.length);
      ds.auto = String(state.auto); ds.renderer = state.renderer; ds.reached = String(state.reached);
      if (H.contract) H.contract(c, ds, p, d);
      pProg.setAttribute("aria-valuenow", String(Math.round(state.t * 100)));
    }
    function renderScene() {
      const had = document.activeElement, focused = had && had !== document.body;
      renderSteps(); renderPanel(); state.progressKey = ""; onProgress();
      if (focused && (!had.isConnected || had.closest("[inert]") || had.disabled)) btnNext.focus({ preventScroll: true });
    }
    function onProgress() {
      pProg.firstChild.style.width = (state.t * 100).toFixed(1) + "%";
      const key = sid() + "|" + Math.floor(state.t * 40) + "|" + state.promptId + "|" + JSON.stringify(state.settings) + "|" + state.playing;
      if (key === state.progressKey) return; state.progressKey = key;
      if (!inspector.hidden) H.renderInspector(c);
      renderFlow(); renderMonitor(); renderFinal(); renderContract();
      const say = sid() === "return" && state.t > 0.86 && prompt() ? H.announce(c, prompt(), decision()) : "";
      if (say && say !== state.announced) { state.announced = say; $("announce").textContent = say; }
    }

    // ─── Navigation ───
    function goTo(i, { play = true } = {}) {
      if (sid() === "return" && i !== state.scene) recordRun();
      state.scene = Math.max(0, Math.min(SCENES.length - 1, i));
      state.reached = Math.max(state.reached, state.scene);
      state.t = play && !REDUCED ? 0 : 1; state.playing = state.t < 1; state.dwell = 0;
      if (sid() === "send" && state.fresh) { state.runId++; state.fresh = false; state.reached = IDX.send; state.runSettings = { ...state.settings }; }
      renderScene(); if (!state.playing) sceneDone();
    }
    function next() {
      if (state.playing) { state.t = 1; state.playing = false; onProgress(); sceneDone(); return; }
      if (sid() === "chat" && !state.promptId) return;
      if (sid() === "final") { restart(); return; }
      goTo(state.scene + 1);
    }
    function back() { if (state.scene > 0) goTo(state.scene - 1, { play: false }); }
    function recordRun() {
      if (!prompt() || state.recorded === state.runId || state.runId === 0) return;
      state.runs.push({ runId: state.runId, promptId: state.promptId, settings: { ...settings() }, ...H.currentRun(c, decision()) });
      state.recorded = state.runId; state.monitorKey = "";
    }
    function sceneDone() { if (sid() === "return") recordRun(); state.progressKey = ""; onProgress(); }
    function choosePrompt(id) {
      if (sid() !== "chat" || !K.promptById(id)) return;
      state.promptId = id; state.fresh = true; state.reached = IDX.chat; state.monitorKey = ""; renderScene();
      const send = $("chatSend"); if (send && !state.auto) send.focus();
    }
    function startRun(id) { if (sid() === "return") recordRun(); state.promptId = id; state.fresh = true; state.reached = IDX.chat; goTo(IDX.chat); }
    function setSettings(patch, focusSel) {
      state.settings = { ...state.settings, ...patch }; state.monitorKey = ""; renderScene();
      if (focusSel) { const f = display.querySelector(focusSel); if (f) f.focus(); }
    }
    function restart() {
      Object.assign(state, { promptId: null, settings: P.defaultSettings(), runSettings: null, fresh: false, runs: [], recorded: -1, reached: 0, monitorKey: "", announced: "" });
      if (W.resetView) W.resetView(); goTo(0);
    }
    function setAuto(on) {
      state.auto = on; state.dwell = 0;
      btnAuto.setAttribute("aria-pressed", String(on)); btnStep.setAttribute("aria-pressed", String(!on));
      renderContract();
    }
    function autoTick(dt) {
      if (!state.auto || state.playing || help.open) return;
      state.dwell += dt;
      const id = sid();
      if (id === "chat") { if (!state.promptId && state.dwell > 1.2) choosePrompt(nextUntried()); else if (state.promptId && state.dwell > 2.8) next(); return; }
      if (state.dwell < (DWELL[id] || DWELL.default)) return;
      if (id === "return") { if (state.runs.length < AUTO_ORDER.length) startRun(nextUntried()); else next(); }
      else if (id === "final") restart();
      else next();
    }

    // ─── Probe (DOM contract invariants) + self-test ───
    function probe() {
      const failures = [], p = prompt(), d = p ? decision() : null, ds = app.dataset, done = ds.phase === "done";
      const cur = stepsEl.querySelector('[aria-current="step"]');
      if (!cur || cur.dataset.scene !== ds.scene) failures.push("stepper-current");
      const wi = W.info();
      if (wi.renderer === "webgl" && done) {
        const expected = K.packetAt(ds.scene, d);
        if (wi.packetNode !== expected) failures.push("world-packet:" + wi.packetNode + "≠" + expected);
        if (p && P.calloutScenes && P.calloutScenes.includes(ds.scene) && wi.callouts < 1) failures.push("world-callouts");
      }
      if (H.probe) H.probe(c, failures, p, d, wi, done);
      if (document.body.textContent.includes("\u2014")) failures.push("em-dash");
      return { ok: failures.length === 0, failures, scene: ds.scene, phase: ds.phase, prompt: ds.prompt, packet: ds.packet, world: wi };
    }
    async function selfTest() {
      const results = [], wait = () => new Promise(r => setTimeout(r, 30));
      const saved = { auto: state.auto }; setAuto(false);
      const runs = H.selfTestRuns(c);
      for (const run of runs) {
        state.settings = { ...P.defaultSettings(), ...run.settings }; startRun(run.promptId);
        for (let i = IDX.chat; i <= IDX.final; i++) {
          goTo(i, { play: false }); W.frame(snapshot(), 0); await wait();
          const r = probe(); if (!r.ok) results.push(run.label + "/" + SCENES[i].id + ": " + r.failures.join(","));
        }
      }
      if (state.runs.length !== runs.length) results.push("run-log: " + state.runs.length + " runs, expected " + runs.length);
      if (H.selfTestCheck) H.selfTestCheck(c, results);
      restart(); setAuto(saved.auto);
      app.dataset.test = results.length ? "fail" : "pass"; app.dataset.testDetail = results.slice(0, 6).join(" | ");
      return { ok: !results.length, failures: results };
    }

    // ─── Listeners ───
    function bindListeners() {
      btnNext.addEventListener("click", next); btnBack.addEventListener("click", back);
      btnAuto.addEventListener("click", () => setAuto(true)); btnStep.addEventListener("click", () => setAuto(false));
      btnRestart.addEventListener("click", restart);
      btnHelp.addEventListener("click", () => help.showModal()); btnHelpClose.addEventListener("click", () => help.close());
      btnProbe.addEventListener("click", () => { const r = probe(); probeOut.textContent = (r.ok ? "OK – kontrakt DOM i inwarianty spełnione." : "BŁĘDY: " + r.failures.join(", ")) + "\n" + JSON.stringify({ scene: r.scene, prompt: r.prompt, packet: r.packet, renderer: r.world.renderer, worldPacket: r.world.packetNode }, null, 1); });
      // pressing a control takes over from autoplay (kiosk behaviour); rotating the 3D view does not
      document.addEventListener("pointerdown", e => {
        if (!state.auto || modeSwitch.contains(e.target) || !(e.target instanceof Element) || !e.target.closest("button, a, [role=radio]")) return;
        setAuto(false);
      }, true);
      document.addEventListener("keydown", e => {
        if (help.open || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key, onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
        if ((k === " " || k === "Enter") && onButton) return;
        if (state.auto && NAV_KEYS.includes(k.toLowerCase())) setAuto(false);
        const group = e.target.closest && e.target.closest('[role="radiogroup"]');
        if (group && ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(k)) {
          e.preventDefault();
          const radios = [...group.querySelectorAll('[role="radio"]')], step = k === "ArrowRight" || k === "ArrowDown" ? 1 : -1;
          const r = radios[(radios.indexOf(e.target) + step + radios.length) % radios.length];
          const sel = Object.keys(r.dataset).map(key => `[data-${key.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}="${r.dataset[key]}"]`)[0];
          r.click(); const again = sel && display.querySelector(sel); if (again) again.focus();
          return;
        }
        if (k === "ArrowRight" || k === "PageDown" || k === " " || k.toLowerCase() === "n") { e.preventDefault(); next(); }
        else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); back(); }
        else if (k === "Enter" && sid() === "chat") { e.preventDefault(); next(); }
        else if (["1", "2", "3", "4"].includes(k)) { const p = K.PROMPTS.find(x => x.key === k); if (!p) return; if (sid() === "chat") choosePrompt(p.id); else if (sid() === "return" && !state.playing) startRun(p.id); }
        else if (k.toLowerCase() === "a") setAuto(!state.auto);
        else if (k.toLowerCase() === "r") restart();
        else if (k.toLowerCase() === "h" || k === "?") help.showModal();
        else if (k.toLowerCase() === "f") { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
      });
      document.addEventListener("visibilitychange", () => { state.lastFrame = performance.now(); });
    }
    function loop(now) {
      const dt = Math.min(0.1, Math.max(0, (now - state.lastFrame) / 1000)); state.lastFrame = now;
      if (state.playing) {
        state.t = Math.min(1, state.t + dt * SPEED / sceneDef().dur);
        if (state.t >= 1) { state.playing = false; sceneDone(); }
        onProgress();
      }
      autoTick(dt);
      W.frame(snapshot(), dt);
      if (state.renderer === "webgl") { const wp = W.info().packetNode; if (app.dataset.worldPacket !== wp) app.dataset.worldPacket = wp; }
      requestAnimationFrame(loop);
    }

    // ─── Init ───
    Object.assign(c, { state, K, W, IDX, SCENES, ICONS, $, el, icon, button, setText, markNodes, sid, prompt, settings, decision, phase, after,
      goTo, next, back, startRun, setSettings, restart, nextUntried, display, inspector, flowEl });
    buildSteps(); buildFlow(flowEl); buildFlow(flowBig); bindListeners();
    W.init({
      stage, labels,
      onReady: () => { state.renderer = "webgl"; renderContract(); },
      onFail: msg => { state.renderer = "fallback"; statusEl.textContent = msg; setTimeout(() => { statusEl.textContent = ""; }, 6000); renderContract(); }
    });
    if (H.applyParams) H.applyParams(c, PARAMS);
    const pr = PARAMS.get("prompt"); if (pr && K.promptById(pr)) state.promptId = pr;
    const sc = PARAMS.get("scene");
    if (sc && IDX[sc] != null && (IDX[sc] <= IDX.chat || state.promptId)) { state.reached = IDX[sc]; goTo(IDX[sc], { play: PARAMS.get("play") === "1" }); }
    else goTo(0);
    // Auto is the default; deep links to a scene (presenters, tests) and ?auto=0 start step by step.
    setAuto(PARAMS.get("auto") === "1" || (PARAMS.get("auto") !== "0" && !sc && PARAMS.get("selftest") !== "1"));
    window.App = { state, probe, selfTest, goTo: id => goTo(IDX[id] ?? id, { play: false }), startRun, setSettings, next, back, restart, snapshot, world: () => W.info(),
      ...(H.api ? H.api(c) : {}) };
    requestAnimationFrame(loop);
    if (PARAMS.get("selftest") === "1") {
      const ready = () => (state.renderer !== "loading" ? selfTest() : setTimeout(ready, 100)); setTimeout(ready, 100);
    }
    return c;
  }

  return { start };
})();
