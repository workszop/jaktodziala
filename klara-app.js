/* Klara od środka – app controller: scene state machine, narration panel, diegetic screens,
   admin panel, autoplay and the DOM contract (data-* on #app) + App.probe() / App.selfTest(). */
(() => {
  "use strict";

  // ─── Constants ───
  const K = window.KlaraData, W = window.KlaraWorld;
  const SCENES = K.SCENES, IDX = Object.fromEntries(SCENES.map((s, i) => [s.id, i]));
  const AUTO_ORDER = ["sensitive", "routine", "complex", "attachment"];
  const DWELL = { login: 2.4, admin: 6, final: 9, scan: 4.5, route: 4.5, default: 3.4 };
  const PARAMS = new URLSearchParams(location.search);
  const SPEED = Math.min(4, Math.max(0.25, parseFloat(PARAMS.get("speed")) || 1));
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ICONS = {
    desk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    cable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h6a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4h2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="18" r="1.5"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/></svg>',
    switch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h7"/><path d="M10 12 20 5M10 12h10M10 12l10 7"/></svg>',
    local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
    apiq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/></svg>',
    frontier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    check: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    shield: '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 9 6 6M15 9l-6 6"/></svg>',
    ok: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
    clip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 12-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/></svg>',
    folder: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    mail: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    calendar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    trash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    send: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>'
  };
  const FLOW_NODES = [
    { id: "desk", label: "Stanowisko" }, { id: "cable", label: "Kabel do serwera" }, { id: "scan", label: "Skaner" },
    { id: "gauge", label: "Miernik złożoności" }, { id: "switch", label: "Zwrotnica" }, { id: "local", label: "Model lokalny" },
    { id: "apiq", label: "Quantica APIQ" }, { id: "frontier", label: "Frontier API" }
  ];
  const ROUTE_TAG = { on: "wybrana trasa", blocked: "zablokowany · dane chronione", off: "wyłączony w polityce", alt: "alternatywa", faded: "" };

  // ─── State ───
  const state = {
    scene: 0, t: 0, playing: false, promptId: null, policy: { ...K.DEFAULT_POLICY },
    runId: 0, recorded: -1, runs: [], reached: 0, auto: false, dwell: 0, runPolicy: null, fresh: false, announced: "",
    renderer: "loading", monitorKey: "", progressKey: "", lastFrame: performance.now()
  };

  // ─── DOM refs ───
  const $ = id => document.getElementById(id);
  const app = $("app"), stage = $("stage"), labels = $("labels"), stepsEl = $("steps"), monitor = $("monitor"), display = $("display");
  const finalEl = $("final"), statusEl = $("status"), flowEl = $("flow"), flowBig = $("flowBig");
  const pNum = $("pNum"), pShort = $("pShort"), pTitle = $("pTitle"), pProg = $("pProg"), pLead = $("pLead"), pBullets = $("pBullets"), pActions = $("pActions");
  const inspector = $("inspector"), iText = $("iText"), iAtt = $("iAtt"), iChecks = $("iChecks"), iRoutes = $("iRoutes"), iMeta = $("iMeta");
  const btnBack = $("btnBack"), btnNext = $("btnNext"), nextLabel = $("nextLabel"), btnAuto = $("btnAuto"), btnStep = $("btnStep"), modeSwitch = $("modeSwitch"), btnRestart = $("btnRestart");
  const help = $("help"), btnHelp = $("btnHelp"), btnHelpClose = $("btnHelpClose"), btnProbe = $("btnProbe"), probeOut = $("probeOut");

  // ─── Helpers ───
  const sceneDef = () => SCENES[state.scene];
  const sid = () => sceneDef().id;
  const prompt = () => K.promptById(state.promptId);
  const decision = () => K.decide(prompt(), state.runPolicy || state.policy);
  const phase = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const after = (id, t0 = 1) => state.scene > IDX[id] || (state.scene === IDX[id] && state.t >= t0);
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function icon(name, cls) { const s = el("span", cls); s.innerHTML = ICONS[name]; s.setAttribute("aria-hidden", "true"); return s; }
  function button(cls, text, onClick, extra) { const b = el("button", cls, text); b.type = "button"; b.addEventListener("click", onClick); if (extra) extra(b); return b; }
  const nextUntried = () => {
    const tried = new Set(state.runs.map(r => r.promptId)); if (state.promptId) tried.add(state.promptId);
    return AUTO_ORDER.find(id => !tried.has(id)) || AUTO_ORDER[(AUTO_ORDER.indexOf(state.promptId) + 1) % AUTO_ORDER.length];
  };
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const items = p => K.protectedItems(p);
  function snapshot() {
    const p = prompt(), d = p ? decision() : null, co = p ? calloutsFor(p, d) : [];
    return { sceneId: sid(), t: state.t, prompt: p, decision: d, rules: p ? ruleSteps(p, d).map(r => r.state) : [], callouts: co, calloutsSig: JSON.stringify(co), reduced: REDUCED };
  }

  // Text as DOM with protected fragments wrapped in <mark> (never innerHTML with data).
  function markNodes(text, list, mode) {
    const frag = document.createDocumentFragment(); let rest = text;
    if (mode === "plain") { frag.appendChild(document.createTextNode(rest)); return frag; }
    for (const item of list) {
      const at = rest.indexOf(item.text); if (at < 0) continue;
      frag.appendChild(document.createTextNode(rest.slice(0, at)));
      const m = el("mark", "pii", mode === "masked" ? item.token : item.text);
      m.dataset.kind = item.kind; m.dataset.masked = String(mode === "masked"); m.title = item.kind; frag.appendChild(m);
      rest = rest.slice(at + item.text.length);
    }
    frag.appendChild(document.createTextNode(rest)); return frag;
  }

  // Packet location per scene for the schematic and the compact flow.
  function flowStates(id, t, d) {
    const st = Object.fromEntries(FLOW_NODES.map(n => [n.id, "idle"]));
    const o = IDX[id], path = ["desk", "cable", "scan", "gauge", "switch"];
    const activeAt = { login: "desk", chat: "desk", send: "cable", scan: "scan", gauge: "gauge", route: "switch" };
    if (activeAt[id]) { const k = path.indexOf(activeAt[id]); path.forEach((n, i) => { st[n] = i < k ? "done" : i === k ? "active" : "idle"; }); }
    if (o >= IDX.model) path.forEach(n => { st[n] = "done"; });
    if (d && (o > IDX.route || (id === "route" && t >= 0.7))) {
      for (const r of K.ROUTE_IDS) { const s = d.states[r]; st[r] = s === "on" ? "chosen" : s === "faded" ? "idle" : s; }
      if (id === "model") st[d.target] = "active";
    }
    if (id === "return") st.desk = t >= 0.82 ? "active" : "done";
    return st;
  }

  // Rule evaluation in the order the board shows it; the first rule that decides wins.
  function ruleSteps(p, d) {
    const prot = items(p), lv = K.COMPLEXITY[d.level].label, pol = (state.runPolicy || state.policy).external;
    const r1 = prot.length ? { state: "hit", text: "1. Dane chronione? tak" + (d.fromAttachment ? " (w załączniku)" : "") + " → tylko model lokalny" } : { state: "pass", text: "1. Dane chronione? nie" };
    const r2 = r1.state === "hit" ? { state: "skip", text: "2. Złożoność – pominięte, decyduje reguła 1" }
      : d.level !== "high" ? { state: "hit", text: "2. Złożoność: " + lv + " → model lokalny" } : { state: "pass", text: "2. Złożoność: zadanie wymaga najbardziej zaawansowanego modelu" };
    const r3 = r1.state === "hit" || r2.state === "hit" ? { state: "skip", text: "3. Polityka – pominięte" }
      : { state: "hit", text: "3. Polityka organizacji: " + (pol === "off" ? "tylko modele lokalne → model lokalny" : K.ROUTES[d.target].title) };
    return [r1, r2, r3];
  }
  // In-world explanation cards, anchored by the 3D world to its stations.
  function calloutsFor(p, d) {
    const id = sid(), t = state.t, out = [], prot = items(p), own = p.sensitive, att = p.attachment, attItems = att ? att.sensitive : [];
    const found = (it, maskAt) => ({ text: t > maskAt ? it.kind + " → " + it.token : it.kind + ": wykryto", state: t > maskAt ? "ok" : "flag" });
    if (id === "send" && t > 0.85) out.push({ id: "server", anchor: "server", side: "top", tone: "brand", kicker: "Quantica AI Server", title: "Decyzja zapada w organizacji",
      lines: [{ text: "polecenie dotarło do serwera organizacji", state: "ok" }, { text: "nic nie wychodzi na zewnątrz przed analizą", state: "on" }] });
    if (id === "scan") {
      if (att && t > 0.5) out.push({ id: "monitor", anchor: "monitor", side: "left", tone: "scan", kicker: "Rentgen załącznika", title: att.name,
        lines: [{ text: att.meta, state: "muted" }, { text: t > 0.58 ? "przeczytano wszystkie strony" : "odczyt stron…", state: t > 0.58 ? "ok" : "muted" }, ...(t > 0.62 ? attItems.map(it => found(it, 0.72)) : [])] });
      if (t > 0.5) out.push({ id: "scan", anchor: "scan", side: "left", tone: "scan", kicker: "Krok 1 · Skaner", title: "Bezpieczeństwo danych",
        lines: [...(own.length ? own.map(it => found(it, 0.72)) : [{ text: "treść polecenia: brak danych chronionych", state: "ok" }]),
          ...(att ? [{ text: t > 0.62 ? "załącznik: " + attItems.length + " fragmenty chronione" : "załącznik: analiza…", state: t > 0.62 ? "flag" : "muted" }] : []),
          ...(t > 0.78 ? [prot.length ? { text: "pakiet oznaczony: zakaz wyjścia poza organizację", state: "flag" } : { text: "pakiet może wyjść poza organizację, jeśli wymaga tego zadanie", state: "ok" }] : [])] });
    }
    if (id === "gauge" && t > 0.35) out.push({ id: "gauge", anchor: "gauge", side: "right", tone: "klara", kicker: "Krok 2 · Miernik złożoności",
      title: t > 0.85 ? "Ocena: " + K.COMPLEXITY[d.level].label : "Ocena złożoności…",
      lines: [["routine", "proste i rutynowe → model lokalny"], ["standard", "standardowe → model lokalny"], ["high", "najbardziej wymagające → model zewnętrzny, jeśli pozwala polityka"]]
        .map(([lv, text]) => ({ text, state: t > 0.85 && d.level === lv ? "on" : "muted" })) });
    if (id === "route") {
      const rules = ruleSteps(p, d).filter((_, i) => t > 0.15 + i * 0.15);
      out.push({ id: "switch", anchor: "switch", side: "left", tone: "admin", kicker: "Krok 3 · Zwrotnica", title: t > 0.84 ? "Decyzja: " + K.ROUTES[d.target].title : "Ocena reguł organizacji",
        lines: [...rules.map((r, i) => ({ text: r.text, state: r.state === "hit" ? (i === 0 ? "flag" : "on") : r.state === "pass" ? "ok" : "muted" })),
          ...(t > 0.62 && prot.length ? [{ text: "trasy zewnętrzne zablokowane", state: "flag" }] : [])] });
    }
    if (id === "model") {
      const r = K.ROUTES[d.target];
      if (!d.external && t > 0.4) out.push({ id: "local", anchor: "local", side: "top", tone: "ok", kicker: "Model lokalny", title: "Przetwarzanie w organizacji",
        lines: [{ text: "koszt: bez opłat za API", state: "ok" }, { text: "dane nie opuszczają infrastruktury", state: "ok" },
          prot.length ? { text: "dane chronione obsłużone wyłącznie lokalnie", state: "flag" } : { text: d.level === "high" ? "polityka: modele zewnętrzne wyłączone" : "wystarczająca jakość dla tego zadania", state: "muted" }] });
      if (d.external && t > 0.12 && t < 0.74) out.push({ id: "gate", anchor: "gate", side: "left", tone: "ok", kicker: "Wyjście z organizacji", title: "Tylko treść zadania",
        lines: [{ text: "brak danych chronionych – kontrola przeszła", state: "ok" }, { text: "kierunek: " + r.title, state: "on" }] });
      if (d.external && t > 0.74) out.push({ id: "cloud", anchor: d.target, side: "bottom", tone: d.target === "apiq" ? "brand" : "admin", kicker: "Model zewnętrzny", title: r.title,
        lines: [{ text: r.where, state: "muted" }, { text: "koszt: " + r.cost, state: "muted" }, { text: "odpowiedź wraca do Klary w organizacji", state: "ok" }] });
    }
    return out;
  }

  // ─── Render: steps, panel, inspector, flow ───
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
    for (const n of FLOW_NODES) { const d = el("div", "node"); d.dataset.node = n.id; d.dataset.state = "idle"; d.append(icon(n.id), el("span", null, n.label)); container.appendChild(d); }
  }
  function renderFlow() {
    const st = flowStates(sid(), state.t, prompt() ? decision() : null);
    for (const c of [flowEl, flowBig]) c.querySelectorAll(".node").forEach(n => { if (n.dataset.state !== st[n.dataset.node]) n.dataset.state = st[n.dataset.node]; });
  }

  function narration() {
    const id = sid(), p = prompt(), d = p ? decision() : null, r = d ? K.ROUTES[d.target] : null;
    const pol = K.POLICY_OPTIONS.find(o => o.id === (state.runPolicy || state.policy).external);
    switch (id) {
      case "login": return { lead: "Robot siada przy komputerze. Na pulpicie czeka Klara – bezpieczny chat AI organizacji. Jedno okno, logowanie kontem organizacji.",
        bullets: ["Bezpieczna i wygodna alternatywa dla publicznych chatów – ogranicza zjawisko shadow AI.", "Rozwiązanie może być dostosowane do struktury organizacyjnej i uprawnień poszczególnych użytkowników.", "Organizacja: " + K.ORG.name + " (" + K.ORG.note + ") · użytkownik: " + K.USER.name + ", " + K.USER.dept] };
      case "chat": return { lead: "Pracownicy korzystają z Klary tak samo jak z popularnych chatów AI: wpisują polecenia, zadają pytania, analizują dokumenty i przygotowują teksty. Wybierz polecenie i wyślij je do Klary.",
        bullets: ["Użytkownik nie wybiera modelu – Klara automatycznie wybiera ścieżkę realizacji zadania.", "Polecenie 4 ma załącznik – Klara sprawdza także treść załączonych dokumentów.", "Klawisze 1–4 wybierają polecenie, Enter wysyła."] };
      case "send": return { lead: "Polecenie nie trafia prosto do internetu. Najpierw jedzie kablem do Quantica AI Server w serwerowni organizacji.",
        bullets: ["Analiza i wybór modelu odbywają się lokalnie – w infrastrukturze organizacji.", "Na zewnątrz może trafić wyłącznie treść zadań, które mogą być przetwarzane poza organizacją."] };
      case "scan": return p && d.fromAttachment && !p.sensitive.length
        ? { lead: "Skaner czyta polecenie i załączniki. Samo polecenie jest neutralne, ale w załączniku „" + p.attachment.name + "” wykryto: " + d.kinds.join(", ") + ".",
          bullets: ["Bez załącznika to zadanie trafiłoby do modelu zewnętrznego – decyduje treść dokumentu, nie samo polecenie.", "Fragmenty z załącznika zostają oznaczone i zamaskowane; pakiet dostaje zakaz wyjścia poza organizację."] }
        : p && items(p).length
        ? { lead: "Skaner analizuje treść polecenia pod kątem bezpieczeństwa. Wykryto dane wymagające ochrony: " + d.kinds.join(", ") + ".",
          bullets: ["Fragmenty zostają oznaczone i zamaskowane, a pakiet dostaje zakaz wyjścia poza organizację.", "Dane wymagające ochrony nie są przekazywane do zewnętrznych dostawców modeli AI."] }
        : { lead: "Skaner analizuje treść polecenia pod kątem bezpieczeństwa. Brak danych chronionych.",
          bullets: ["To polecenie może być przetwarzane poza organizacją – o ile wymaga tego zadanie."] };
      case "gauge": return { lead: "Miernik ocenia stopień złożoności: " + K.COMPLEXITY[d.level].label + ".",
        bullets: [d.level === "high" ? "Zadania szczególnie złożone i wymagające mogą trafić do wybranego modelu zewnętrznego, takiego jak GPT czy Gemini."
          : d.level === "routine" ? "Proste i rutynowe zadania są obsługiwane przez modele lokalne, co ogranicza koszty korzystania z zewnętrznych usług AI."
          : "Do zadań standardowych wystarcza model lokalny działający w kontrolowanym środowisku."] };
      case "route": return { lead: "Zwrotnica łączy wynik skanera, miernika i polityki organizacji: " + d.reason + ".",
        bullets: [d.badge, "Polityka dla zadań złożonych: " + pol.label.toLowerCase() + (items(p).length ? " – nie ma tu znaczenia, bo dane chronione zawsze zostają w organizacji." : ".")] };
      case "model": return d.external
        ? { lead: "Na zewnątrz trafia wyłącznie treść zadania. Pakiet przechodzi przez wyjście z organizacji do: " + r.title + " (" + r.where + ").",
          bullets: [d.meta, "Model komercyjny wykorzystany tam, gdzie jego możliwości przynoszą rzeczywistą wartość."] }
        : { lead: "Zadanie realizuje lokalny model językowy działający w kontrolowanym środowisku – w tym samym serwerze.", bullets: [d.meta] };
      case "return": return { lead: "Odpowiedź wraca tą samą drogą do okna czatu. Użytkownik nie musi wiedzieć, który model najlepiej nadaje się do danego zadania – korzysta z jednego interfejsu.",
        bullets: ["Obsłużono: " + r.title.toLowerCase() + " · " + d.badge + "."] };
      case "admin": return { lead: "Organizacja zachowuje kontrolę nad dostępnymi modelami, regułami kierowania zapytań oraz zasadami przetwarzania informacji. Centralne środowisko pozwala monitorować sposób korzystania z modeli.",
        bullets: ["Zmień politykę dla zadań złożonych i sprawdź, jak zmieni się trasa.", "Reguła ochrony danych działa niezależnie od tej polityki."] };
      default: return { lead: "Klara ogranicza zjawisko shadow AI: automatycznie chroni dane organizacji, dobiera model do rodzaju i złożoności zadania oraz ogranicza koszty.", bullets: [] };
    }
  }
  function renderPanel() {
    const s = sceneDef(), n = narration();
    setText(pNum, s.n); setText(pShort, s.short); setText(pTitle, s.title); setText(pLead, n.lead);
    pBullets.replaceChildren(...n.bullets.map(b => el("li", null, b)));
    pActions.replaceChildren();
    if (s.id === "return") pActions.append(button("btn btn-ghost", "Inne polecenie", () => startRun(nextUntried())));
    if (s.id === "route" || s.id === "model") pActions.append(button("btn btn-ghost", "Zmień politykę w panelu", () => { state.reached = Math.max(state.reached, IDX.admin); goTo(IDX.admin); }));
    btnBack.disabled = state.scene === 0;
    const labelsFor = { chat: "Wyślij do Klary", send: "Zajrzyj do środka", return: "Panel organizacji", admin: "Podsumowanie", final: "Zacznij od nowa" };
    nextLabel.textContent = labelsFor[s.id] || "Dalej";
    btnNext.disabled = s.id === "chat" && !state.promptId;
    inspector.hidden = !(state.scene >= IDX.send && state.scene <= IDX.return && prompt());
  }
  function renderInspector() {
    if (inspector.hidden) return;
    const p = prompt(), d = decision();
    const markMode = !p.sensitive.length ? "plain" : after("scan", 0.72) ? "masked" : after("scan", 0.5) ? "found" : "plain";
    if (iText.dataset.mode !== markMode || iText.dataset.prompt !== p.id) { iText.replaceChildren(markNodes(p.text, p.sensitive, markMode)); iText.dataset.mode = markMode; iText.dataset.prompt = p.id; }
    const att = p.attachment, attMode = !att ? "none" : after("scan", 0.72) ? "masked" : after("scan", 0.62) ? "found" : "plain";
    iAtt.hidden = !att;
    if (!att && iAtt.dataset.prompt) { iAtt.replaceChildren(); iAtt.dataset.mode = iAtt.dataset.prompt = ""; }
    if (att && (iAtt.dataset.mode !== attMode || iAtt.dataset.prompt !== p.id)) {
      const head = el("div", "att-head"); head.append(icon("clip"), el("b", null, att.name), el("small", null, att.meta));
      iAtt.replaceChildren(head, ...att.lines.map(line => { const row = el("div", "att-line"); row.appendChild(markNodes(line, att.sensitive.filter(it => line.includes(it.text)), attMode)); return row; }));
      iAtt.dataset.mode = attMode; iAtt.dataset.prompt = p.id;
    }
    const done = [after("scan", 0.72), after("gauge", 0.85), after("route", 0.8)];
    const pending = ["bezpieczeństwo danych", "stopień złożoności", "decyzja o wyborze modelu"];
    if (!iChecks.children.length) pending.forEach(() => { const li = el("li"); li.append(el("i"), el("span")); iChecks.appendChild(li); });
    [...iChecks.children].forEach((li, k) => {
      const stt = !done[k] ? "pending" : k === 0 && items(p).length ? "flag" : "ok";
      if (li.dataset.state !== stt) { li.dataset.state = stt; li.firstChild.innerHTML = stt === "pending" ? "" : stt === "flag" ? ICONS.lock.replace('width="14" height="14"', 'width="10" height="10"') : ICONS.check; }
      const txt = done[k] ? d.checks[k] : pending[k] + " …"; if (li.lastChild.textContent !== txt) li.lastChild.textContent = txt;
    });
    if (!iRoutes.children.length) K.ROUTE_IDS.forEach(rid => { const c = el("div", "route"); c.dataset.route = rid; c.append(el("b", null, K.ROUTES[rid].title), el("span", null, K.ROUTES[rid].where), el("span", "tag")); iRoutes.appendChild(c); });
    const shown = after("route", 0.7);
    [...iRoutes.children].forEach(c => {
      const stt = shown ? d.states[c.dataset.route] : "idle";
      if (c.dataset.state !== stt) { c.dataset.state = stt; c.querySelector(".tag").textContent = shown ? ROUTE_TAG[stt] : ""; }
    });
    const meta = after("route", 0.8) ? d.meta : ""; if (iMeta.textContent !== meta) iMeta.textContent = meta;
  }

  // ─── Render: monitor screens ───
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
    const key = [mv.view, mv.mode, state.promptId, state.runs.length, state.policy.external, state.runId].join("|");
    if (key !== state.monitorKey) {
      state.monitorKey = key; display.replaceChildren(); display.dataset.view = mv.view;
      if (mv.view === "desktop") buildDesktop(mv.mode); else if (mv.view === "admin") buildAdmin();
    }
    monitor.classList.toggle("show", mv.show); monitor.dataset.view = mv.view; monitor.inert = !mv.show;
    updateMonitor(mv);
  }
  // The employee's desktop: icons, a taskbar and the Klara window (login or chat inside).
  function buildDesktop(mode) {
    const desk = el("div", "desk"), icons = el("div", "desk-icons");
    const tile = (name, label, id) => { const d = el("div", "dicon"); if (id) d.id = id; const ic = el("div", "ic"); if (name === "klara") ic.appendChild(el("div", "kmark", "K")); else ic.appendChild(icon(name)); d.append(ic, el("span", null, label)); return d; };
    icons.append(tile("klara", "Klara", "deskKlara"), tile("folder", "Dokumenty"), tile("mail", "Poczta"), tile("calendar", "Kalendarz"), tile("trash", "Kosz"));
    const win = el("div", "win" + (mode === "login" ? "" : " open")); win.id = "kwin"; win.dataset.mode = mode;
    const bar = el("div", "wbar"), dots = el("span", "wdots"); dots.append(el("i"), el("i"), el("i"));
    bar.append(el("span", "kmark sm", "K"), el("span", null, "Klara – bezpieczny (i inteligentny) chat AI"), dots);
    const body = el("div", "wbody"); win.append(bar, body);
    if (mode === "login") body.appendChild(buildLogin()); else body.appendChild(buildChat(mode));
    const task = el("div", "taskbar"), start = el("span", "tstart", "Q"), pin = el("span", "tpin" + (mode === "login" ? "" : " on")); pin.id = "taskKlara"; pin.appendChild(el("span", "kmark sm", "K"));
    task.append(start, pin, el("span", "tspacer"), el("span", "ttray", K.ORG.name), el("span", "ttray", "09:12"));
    desk.append(icons, win, task); display.appendChild(desk);
  }
  function buildLogin() {
    const wrap = el("div", "login"), card = el("div", "login-card"), head = el("header"), h = el("div");
    h.append(el("h3", null, "Klara"), el("small", null, K.ORG.name + " · " + K.ORG.note)); head.append(el("div", "kmark", "K"), h);
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
    wt.append(el("b", null, "Klara"), el("small", null, "bezpieczny (i inteligentny) chat AI")); who.append(el("div", "kmark", "K"), wt);
    const list = el("ul"); ["Nowa rozmowa", "Plan szkoleń na IV kwartał", "Podsumowanie spotkania działu"].forEach((x, i) => list.appendChild(el("li", i ? null : "cur", x)));
    side.append(who, el("div", "new", "+ Nowa rozmowa"), list, el("div", "user", K.USER.name + " · " + K.USER.dept + " · " + K.ORG.name));
    return side;
  }
  function exchange(msgs, run) {
    const p = K.promptById(run.promptId), r = K.ROUTES[run.target];
    const u = el("div", "bubble user"); u.append(el("span", "who", K.USER.name), document.createTextNode(p.text)); if (p.attachment) u.appendChild(attChip(p.attachment));
    const b = el("div", "bubble bot"); b.append(el("span", "who", "Klara"), document.createTextNode(p.answer));
    const m = el("div", "meta"); m.append(icon("ok"), el("span", null, "obsłużono: " + r.title.toLowerCase() + " · " + run.badge)); b.appendChild(m);
    msgs.append(u, b);
  }
  function attChip(att) { const c = el("div", "att"); c.append(icon("clip"), el("b", null, att.name), el("small", null, att.meta)); return c; }
  function buildChat(mode) {
    const appEl = el("div", "kapp"), main = el("div", "kmain"), head = el("div", "khead"), pill = el("span", "pill");
    pill.append(el("i"), document.createTextNode("model dobierany automatycznie")); head.append(el("b", null, "Klara"), pill);
    const msgs = el("div", "kmsgs"); msgs.setAttribute("aria-live", "polite");
    const hello = el("div", "bubble bot"); hello.append(el("span", "who", "Klara"), document.createTextNode("Dzień dobry! W czym mogę pomóc? Model dopasuję do zadania automatycznie.")); msgs.appendChild(hello);
    state.runs.filter(r => mode === "compose" || r.runId !== state.runId).forEach(r => exchange(msgs, r));
    if (mode === "answer" && prompt()) { const d = decision(); exchange(msgs, { promptId: state.promptId, target: d.target, badge: d.badge }); }
    const comp = el("div", "kcomp"), chips = el("div", "chips"); chips.setAttribute("role", "radiogroup"); chips.setAttribute("aria-label", "Przykładowe polecenia");
    for (const p of K.PROMPTS) {
      const c = button("chip", null, () => mode === "compose" ? choosePrompt(p.id) : startRun(p.id));
      c.setAttribute("role", "radio"); c.setAttribute("aria-checked", String(mode === "compose" && state.promptId === p.id)); c.dataset.prompt = p.id;
      c.append(document.createTextNode(p.label), el("kbd", null, p.key)); chips.appendChild(c);
    }
    const row = el("div", "input-row"), input = el("div", "input"); input.dataset.placeholder = mode === "compose" ? "Wybierz przykładowe polecenie powyżej…" : "Wybierz kolejne polecenie powyżej…";
    if (mode === "compose" && prompt()) input.textContent = prompt().text;
    const send = button("send", null, () => next()); send.append(icon("send"), document.createTextNode("Wyślij")); send.disabled = mode !== "compose" || !state.promptId; send.id = "chatSend";
    row.append(input, send); comp.append(chips); if (mode === "compose" && prompt() && prompt().attachment) comp.appendChild(attChip(prompt().attachment)); comp.appendChild(row);
    main.append(head, msgs, comp); appEl.append(chatSide(), main);
    requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
    return appEl;
  }
  function buildAdmin() {
    const wrap = el("div", "adm"), h = el("h3"); h.append(el("div", "kmark", "K"), document.createTextNode("Klara · panel organizacji"));
    const runs = state.runs, count = id => runs.filter(r => r.target === id).length;
    const left = el("div"), tiles = el("div", "tiles");
    [["Zapytania", runs.length, ""], ["Model lokalny", count("local"), "ok"], ["Quantica APIQ", count("apiq"), "admin"], ["Frontier API", count("frontier"), "admin"],
      ["Zablokowane wyjścia danych chronionych", runs.filter(r => r.sensitive).length, "danger"], ["Wywołania płatnych API", count("apiq") + count("frontier"), ""]]
      .forEach(([label, n, tone]) => { const tl = el("div", "tile"); tl.dataset.tone = tone; tl.append(el("b", null, String(n)), el("span", null, label)); tiles.appendChild(tl); });
    const logCard = el("div", "card"), log = el("ul", "log");
    logCard.append(el("h4", null, "Ostatnie zapytania (ta sesja demo)"), log);
    if (!runs.length) log.appendChild(el("li", null, "Brak zapytań – wyślij polecenie z okna czatu."));
    runs.slice().reverse().forEach(r => { const li = el("li"); li.append(el("span", null, K.promptById(r.promptId).label), el("em", null, K.ROUTES[r.target].title)); log.appendChild(li); });
    logCard.style.marginTop = "12px"; left.append(el("h4", null, "Wykorzystanie modeli"), tiles, logCard);
    const right = el("div", "card"), rule = el("div", "rule"), rt = el("div");
    rt.append(el("b", null, "Dane chronione → tylko model lokalny"), el("div", null, "Reguła stała: dane wymagające ochrony nie są przekazywane do zewnętrznych dostawców modeli AI."));
    rule.append(icon("lock"), rt);
    const opts = el("div", "opts"); opts.setAttribute("role", "radiogroup"); opts.setAttribute("aria-label", "Model zewnętrzny dla zadań złożonych");
    for (const o of K.POLICY_OPTIONS) {
      const b = button("opt", null, () => setPolicy(o.id)); b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(state.policy.external === o.id)); b.dataset.policy = o.id;
      const tx = el("div"); tx.append(el("b", null, o.label), el("small", null, o.sub)); b.append(el("i"), tx); opts.appendChild(b);
    }
    const rerun = button("btn-admin", "Sprawdź na zadaniu złożonym", () => startRun("complex"));
    right.append(el("h4", null, "Reguły kierowania zapytań"), rule, el("h4", null, "Zadania złożone na danych publicznych"), opts, rerun);
    wrap.append(h, left, right); display.appendChild(wrap);
  }
  function updateMonitor(mv) {
    const t = state.t;
    if (mv.view === "desktop" && mv.mode === "login") {
      const u = $("lgUser"), pw = $("lgPass"), go = $("lgGo"), ok = $("lgOk"), icn = $("deskKlara"), win = $("kwin"), pin = $("taskKlara"); if (!u) return;
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
    const card = el("div", "final-card"), h = el("h3", null, "Klara od środka – podsumowanie");
    h.appendChild(el("small", null, "Jedno okno czatu dla pracownika. Pełna kontrola nad danymi, modelami i kosztami po stronie organizacji."));
    const left = el("div"), runs = el("ul", "runs");
    left.append(el("h4", null, "Twoje przebiegi"), runs);
    if (!state.runs.length) runs.appendChild(el("li", null, "Brak zakończonych przebiegów."));
    state.runs.forEach(r => { const li = el("li"); li.append(el("span", null, K.promptById(r.promptId).label + (r.target !== "local" ? " · polityka: " + K.POLICY_OPTIONS.find(o => o.id === r.policy).label : "")), el("em", null, K.ROUTES[r.target].title)); runs.appendChild(li); });
    const ben = el("div", "benefits");
    K.BENEFITS.forEach(b => { const d = el("div", "benefit"); d.append(el("b", null, b.title), el("span", null, b.text)); ben.appendChild(d); });
    const acts = el("div", "final-actions");
    acts.append(button("btn btn-primary", "Wypróbuj inne polecenie", () => startRun(nextUntried()), b => { b.style.flex = "none"; }),
      button("btn btn-ghost", "Zmień politykę organizacji", () => goTo(IDX.admin)),
      button("btn btn-ghost", "Zacznij od nowa", () => restart()));
    const link = el("a", "btn btn-ghost", "Klara na quanticalab.ai"); link.href = K.SOURCE_URL; link.target = "_blank"; link.rel = "noopener"; acts.appendChild(link);
    card.append(h, left, ben, acts); finalEl.appendChild(card);
    left.querySelector("h4").style.marginBottom = "8px";
  }

  // ─── Render: contract + orchestration ───
  function renderContract() {
    const p = prompt(), d = p ? decision() : null, done = !state.playing && state.t >= 1;
    const ds = app.dataset;
    ds.scene = sid(); ds.phase = done ? "done" : "playing"; ds.prompt = p ? p.id : ""; ds.route = d ? d.target : "";
    ds.policy = state.policy.external; ds.packet = done ? K.packetAt(sid(), d) : "moving"; ds.runs = String(state.runs.length);
    ds.auto = String(state.auto); ds.renderer = state.renderer; ds.reached = String(state.reached);
    pProg.setAttribute("aria-valuenow", String(Math.round(state.t * 100)));
  }
  function renderScene() {
    const had = document.activeElement, focused = had && had !== document.body;
    renderSteps(); renderPanel(); state.progressKey = ""; onProgress();
    if (focused && (!had.isConnected || had.closest("[inert]") || had.disabled)) btnNext.focus({ preventScroll: true });
  }
  function onProgress() {
    pProg.firstChild.style.width = (state.t * 100).toFixed(1) + "%";
    const key = sid() + "|" + Math.floor(state.t * 40) + "|" + state.promptId + "|" + state.policy.external + "|" + state.playing;
    if (key === state.progressKey) return; state.progressKey = key;
    renderInspector(); renderFlow(); renderMonitor(); renderFinal(); renderContract();
    const say = sid() === "return" && state.t > 0.86 && prompt() ? "Odpowiedź Klary (" + K.ROUTES[decision().target].title.toLowerCase() + "): " + prompt().answer : "";
    if (say && say !== state.announced) { state.announced = say; $("announce").textContent = say; }
  }

  // ─── Navigation ───
  function goTo(i, { play = true } = {}) {
    if (sid() === "return" && i !== state.scene) recordRun();
    state.scene = Math.max(0, Math.min(SCENES.length - 1, i));
    state.reached = Math.max(state.reached, state.scene);
    state.t = play && !REDUCED ? 0 : 1; state.playing = state.t < 1; state.dwell = 0;
    if (sid() === "send" && state.fresh) { state.runId++; state.fresh = false; state.reached = IDX.send; state.runPolicy = { ...state.policy }; }
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
    const d = decision();
    state.runs.push({ runId: state.runId, promptId: state.promptId, target: d.target, badge: d.badge, policy: (state.runPolicy || state.policy).external, sensitive: items(prompt()).length > 0, attachment: !!prompt().attachment });
    state.recorded = state.runId; state.monitorKey = "";
  }
  function sceneDone() {
    if (sid() === "return") recordRun();
    state.progressKey = ""; onProgress();
  }
  function choosePrompt(id) {
    if (sid() !== "chat" || !K.promptById(id)) return;
    state.promptId = id; state.fresh = true; state.reached = IDX.chat; state.monitorKey = ""; renderScene();
    const send = $("chatSend"); if (send && !state.auto) send.focus();
  }
  function startRun(id) { if (sid() === "return") recordRun(); state.promptId = id; state.fresh = true; state.reached = IDX.chat; goTo(IDX.chat); }
  function setPolicy(id) {
    state.policy = { external: id }; state.monitorKey = ""; renderScene();
    const opt = display.querySelector(`[data-policy="${id}"]`); if (opt) opt.focus();
  }
  function restart() {
    Object.assign(state, { promptId: null, policy: { ...K.DEFAULT_POLICY }, runPolicy: null, fresh: false, runs: [], recorded: -1, reached: 0, monitorKey: "", announced: "" });
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

  // ─── Probe (DOM contract invariants) ───
  function probe() {
    const failures = [], p = prompt(), d = p ? decision() : null, ds = app.dataset, done = ds.phase === "done";
    const cur = stepsEl.querySelector('[aria-current="step"]');
    if (!cur || cur.dataset.scene !== ds.scene) failures.push("stepper-current");
    if (p && ds.route !== d.target) failures.push("route-contract");
    if (p && items(p).length && ds.route !== "local") failures.push("privacy-route");
    if (p && items(p).length) iRoutes.querySelectorAll('[data-route="apiq"],[data-route="frontier"]').forEach(c => { if (c.dataset.state === "on") failures.push("privacy-card"); });
    if (p && after("route", 0.7) && IDX[ds.scene] <= IDX.final) {
      const chosen = [...flowEl.querySelectorAll('[data-state="chosen"],[data-state="active"]')].map(n => n.dataset.node).filter(n => K.ROUTE_IDS.includes(n));
      if (chosen.length !== 1 || chosen[0] !== d.target) failures.push("flow-target");
    }
    if (p && !inspector.hidden && after("scan", 0.72) && items(p).length) {
      const marks = inspector.querySelectorAll("mark.pii");
      if (marks.length !== items(p).length || [...marks].some(m => m.dataset.masked !== "true")) failures.push("mask-contract");
      if (items(p).some(s => (iText.textContent + iAtt.textContent).includes(s.text))) failures.push("mask-leak");
    }
    const wi = W.info();
    if (wi.renderer === "webgl" && done) {
      const expected = K.packetAt(ds.scene, d);
      if (wi.packetNode !== expected) failures.push("world-packet:" + wi.packetNode + "≠" + expected);
      if (p && state.scene > IDX.route && wi.arrow !== d.target) failures.push("world-arrow");
      if (p && items(p).length && state.scene > IDX.route && wi.barriers !== "down") failures.push("world-barriers");
      if (p && ["scan", "gauge", "route", "model"].includes(ds.scene) && wi.callouts < 1) failures.push("world-callouts");
      if (p && state.scene >= IDX.scan && state.scene <= IDX.model && wi.redactions !== items(p).length) failures.push("world-redactions:" + wi.redactions);
      if (p && state.scene >= IDX.send && state.scene <= IDX.model && wi.attachments !== (p.attachment ? 1 : 0)) failures.push("world-attachments:" + wi.attachments);
      if (p && state.scene > IDX.route && (wi.rules.match(/H/g) || []).length !== 1) failures.push("world-rules:" + wi.rules);
      if (p && ds.scene === "scan" && wi.scanView !== (items(p).length ? "masked" : "clear")) failures.push("world-xray:" + wi.scanView);
      if (p && ds.scene === "model" && !d.external && wi.blade !== 0) failures.push("world-blade-left-open");
    }
    if (document.body.textContent.includes("\u2014")) failures.push("em-dash");
    return { ok: failures.length === 0, failures, scene: ds.scene, phase: ds.phase, prompt: ds.prompt, route: ds.route, packet: ds.packet, world: wi };
  }
  async function selfTest() {
    const results = [], wait = () => new Promise(r => setTimeout(r, 30));
    const saved = { auto: state.auto }; setAuto(false);
    for (const pr of K.PROMPTS) for (const pol of K.POLICY_OPTIONS) {
      state.policy = { external: pol.id }; startRun(pr.id);
      for (let i = IDX.chat; i <= IDX.final; i++) {
        goTo(i, { play: false }); W.frame(snapshot(), 0); await wait();
        const r = probe(); if (!r.ok) results.push(pr.id + "/" + pol.id + "/" + SCENES[i].id + ": " + r.failures.join(","));
      }
    }
    const want = K.PROMPTS.length * K.POLICY_OPTIONS.length;
    if (state.runs.length !== want) results.push("run-log: " + state.runs.length + " runs, expected " + want);
    state.runs.forEach(r => { const d = K.decide(K.promptById(r.promptId), { external: r.policy }); if (d.target !== r.target) results.push("run-target:" + r.promptId + "/" + r.policy); if (r.sensitive && r.target !== "local") results.push("run-privacy"); });
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
    btnProbe.addEventListener("click", () => { const r = probe(); probeOut.textContent = (r.ok ? "OK – kontrakt DOM i inwarianty prywatności spełnione." : "BŁĘDY: " + r.failures.join(", ")) + "\n" + JSON.stringify({ scene: r.scene, prompt: r.prompt, route: r.route, packet: r.packet, renderer: r.world.renderer, worldPacket: r.world.packetNode }, null, 1); });
    // pressing a control takes over from autoplay (kiosk behaviour); rotating the 3D view does not
    document.addEventListener("pointerdown", e => {
      if (!state.auto || modeSwitch.contains(e.target) || !(e.target instanceof Element) || !e.target.closest("button, a, [role=radio]")) return;
      setAuto(false);
    }, true);
    document.addEventListener("keydown", e => {
      if (help.open || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key, onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      if ((k === " " || k === "Enter") && onButton) return;
      if (state.auto && ["arrowright", "arrowleft", "pagedown", "pageup", " ", "n", "enter", "1", "2", "3", "4", "r"].includes(k.toLowerCase())) setAuto(false);
      const group = e.target.closest && e.target.closest('[role="radiogroup"]');
      if (group && ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(k)) {
        e.preventDefault();
        const radios = [...group.querySelectorAll('[role="radio"]')], step = k === "ArrowRight" || k === "ArrowDown" ? 1 : -1;
        const r = radios[(radios.indexOf(e.target) + step + radios.length) % radios.length];
        const sel = r.dataset.prompt ? `[data-prompt="${r.dataset.prompt}"]` : `[data-policy="${r.dataset.policy}"]`;
        r.click(); const again = display.querySelector(sel); if (again) again.focus();
        return;
      }
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k.toLowerCase() === "n") { e.preventDefault(); next(); }
      else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); back(); }
      else if (k === "Enter" && sid() === "chat") { e.preventDefault(); next(); }
      else if (["1", "2", "3", "4"].includes(k)) { const p = K.PROMPTS.find(x => x.key === k); if (sid() === "chat") choosePrompt(p.id); else if (sid() === "return" && !state.playing) startRun(p.id); }
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
  function init() {
    buildSteps(); buildFlow(flowEl); buildFlow(flowBig); bindListeners();
    W.init({
      stage, labels,
      onReady: () => { state.renderer = "webgl"; renderContract(); },
      onFail: msg => { state.renderer = "fallback"; statusEl.textContent = msg; setTimeout(() => { statusEl.textContent = ""; }, 6000); renderContract(); }
    });
    const pol = PARAMS.get("policy"); if (pol && K.POLICY_OPTIONS.some(o => o.id === pol)) { state.policy = { external: pol }; state.runPolicy = { external: pol }; }
    const pr = PARAMS.get("prompt"); if (pr && K.promptById(pr)) state.promptId = pr;
    const sc = PARAMS.get("scene");
    if (sc && IDX[sc] != null && (IDX[sc] <= IDX.chat || state.promptId)) { state.reached = IDX[sc]; goTo(IDX[sc], { play: PARAMS.get("play") === "1" }); }
    else goTo(0);
    // Auto is the default; deep links to a scene (presenters, tests) and ?auto=0 start step by step.
    setAuto(PARAMS.get("auto") === "1" || (PARAMS.get("auto") !== "0" && !sc && PARAMS.get("selftest") !== "1"));
    window.App = { state, probe, selfTest, goTo: id => goTo(IDX[id] ?? id, { play: false }), startRun, setPolicy, next, back, restart, snapshot, world: () => W.info() };
    requestAnimationFrame(loop);
    if (PARAMS.get("selftest") === "1") {
      const go = () => selfTest();
      const ready = () => state.renderer !== "loading" ? go() : setTimeout(ready, 100); setTimeout(ready, 100);
    }
  }
  init();
})();
