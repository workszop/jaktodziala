/* Klara od środka – product layer for the shared app shell (app-core.js): routing decision and policy, narration,
   in-world callouts, packet inspector, flow, chat answers, admin panel content (policy for complex tasks) and probes. */
(() => {
  "use strict";

  // ─── Constants ───
  const K = window.KlaraData;
  const ROUTE_TAG = { on: "wybrana trasa", blocked: "zablokowany · dane chronione", off: "wyłączony w polityce", alt: "alternatywa", faded: "" };
  const ICONS = {
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/></svg>',
    switch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h7"/><path d="M10 12 20 5M10 12h10M10 12l10 7"/></svg>',
    apiq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/></svg>',
    frontier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
  };

  // ─── Helpers ───
  const items = p => K.protectedItems(p);
  const policyOf = c => c.settings().external;
  function attChip(c, att) { const chip = c.el("div", "att"); chip.append(c.icon("clip"), c.el("b", null, att.name), c.el("small", null, att.meta)); return chip; }
  // Rule evaluation in the order the board shows it; the first rule that decides wins.
  function ruleSteps(c, p, d) {
    const prot = items(p), lv = K.COMPLEXITY[d.level].label, pol = policyOf(c);
    const r1 = prot.length ? { state: "hit", text: "1. Dane chronione? tak" + (d.fromAttachment ? " (w załączniku)" : "") + " → tylko model lokalny" } : { state: "pass", text: "1. Dane chronione? nie" };
    const r2 = r1.state === "hit" ? { state: "skip", text: "2. Złożoność – pominięte, decyduje reguła 1" }
      : d.level !== "high" ? { state: "hit", text: "2. Złożoność: " + lv + " → model lokalny" } : { state: "pass", text: "2. Złożoność: zadanie wymaga najbardziej zaawansowanego modelu" };
    const r3 = r1.state === "hit" || r2.state === "hit" ? { state: "skip", text: "3. Polityka – pominięte" }
      : { state: "hit", text: "3. Polityka organizacji: " + (pol === "off" ? "tylko modele lokalne → model lokalny" : K.ROUTES[d.target].title) };
    return [r1, r2, r3];
  }

  // ─── Hooks ───
  const hooks = {
    snapshotExtra: (c, p, d) => ({ rules: p ? ruleSteps(c, p, d).map(r => r.state) : [] }),

    // In-world explanation cards, anchored by the 3D world to its stations.
    calloutsFor(c, p, d) {
      const id = c.sid(), t = c.state.t, out = [], prot = items(p), own = p.sensitive, att = p.attachment, attItems = att ? att.sensitive : [];
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
      if (id === "gauge" && t > 0.35) out.push({ id: "gauge", anchor: "gauge", side: "right", tone: "accent", kicker: "Krok 2 · Miernik złożoności",
        title: t > 0.85 ? "Ocena: " + K.COMPLEXITY[d.level].label : "Ocena złożoności…",
        lines: [["routine", "proste i rutynowe → model lokalny"], ["standard", "standardowe → model lokalny"], ["high", "najbardziej wymagające → model zewnętrzny, jeśli pozwala polityka"]]
          .map(([lv, text]) => ({ text, state: t > 0.85 && d.level === lv ? "on" : "muted" })) });
      if (id === "route") {
        const rules = ruleSteps(c, p, d).filter((_, i) => t > 0.15 + i * 0.15);
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
    },

    // Flow extras on top of the core's packet path: the routes light up once the switch has decided.
    flowStates(c, st, id, t, d) {
      if (!d || !(c.IDX[id] > c.IDX.route || (id === "route" && t >= 0.7))) return;
      for (const r of K.ROUTE_IDS) { const s = d.states[r]; st[r] = s === "on" ? "chosen" : s === "faded" ? "idle" : s; }
      if (id === "model") st[d.target] = "active";
    },

    narration(c) {
      const id = c.sid(), p = c.prompt(), d = p ? c.decision() : null, r = d ? K.ROUTES[d.target] : null;
      const pol = K.POLICY_OPTIONS.find(o => o.id === policyOf(c));
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
    },

    renderInspector(c) {
      const { el, icon, $, after, markNodes } = c, p = c.prompt(), d = c.decision();
      const iText = $("iText"), iAtt = $("iAtt"), iRoutes = $("iRoutes"), iMeta = $("iMeta");
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
      c.renderChecks(["bezpieczeństwo danych", "stopień złożoności", "decyzja o wyborze modelu"], [after("scan", 0.72), after("gauge", 0.85), after("route", 0.8)], [items(p).length > 0], d.checks);
      if (!iRoutes.children.length) K.ROUTE_IDS.forEach(rid => { const r = el("div", "route"); r.dataset.route = rid; r.append(el("b", null, K.ROUTES[rid].title), el("span", null, K.ROUTES[rid].where), el("span", "tag")); iRoutes.appendChild(r); });
      const shown = after("route", 0.7);
      [...iRoutes.children].forEach(r => {
        const stt = shown ? d.states[r.dataset.route] : "idle";
        if (r.dataset.state !== stt) { r.dataset.state = stt; r.querySelector(".tag").textContent = shown ? ROUTE_TAG[stt] : ""; }
      });
      const meta = after("route", 0.8) ? d.meta : ""; if (iMeta.textContent !== meta) iMeta.textContent = meta;
    },

    // Chat: attachments shown as chips, answers labelled with the model that handled them.
    promptExtra: (c, p) => (p.attachment ? attChip(c, p.attachment) : null),
    currentRun: (c, d) => ({ target: d.target, badge: d.badge, sensitive: items(c.prompt()).length > 0, attachment: !!c.prompt().attachment }),
    answerBody(c, run, bubble) {
      const p = K.promptById(run.promptId), r = K.ROUTES[run.target];
      bubble.appendChild(document.createTextNode(p.answer));
      const m = c.el("div", "meta"); m.append(c.icon("ok"), c.el("span", null, "obsłużono: " + r.title.toLowerCase() + " · " + run.badge)); bubble.appendChild(m);
    },
    announce: (c, p, d) => "Odpowiedź Klary (" + K.ROUTES[d.target].title.toLowerCase() + "): " + p.answer,
    runLine: (c, r) => [K.promptById(r.promptId).label + (r.target !== "local" ? " · polityka: " + K.POLICY_OPTIONS.find(o => o.id === r.settings.external).label : ""), K.ROUTES[r.target].title],

    // Admin console content; the core builds the panel around it with the policy options.
    admin(c) {
      const runs = c.state.runs, count = id => runs.filter(r => r.target === id).length;
      return {
        usage: "Wykorzystanie modeli",
        tiles: [["Zapytania", runs.length, ""], ["Model lokalny", count("local"), "ok"], ["Quantica APIQ", count("apiq"), "admin"], ["Frontier API", count("frontier"), "admin"],
          ["Zablokowane wyjścia danych chronionych", runs.filter(r => r.sensitive).length, "danger"], ["Wywołania płatnych API", count("apiq") + count("frontier"), ""]],
        logTitle: "Ostatnie zapytania (ta sesja demo)", logEmpty: "Brak zapytań – wyślij polecenie z okna czatu.",
        log: runs.slice().reverse().map(r => [K.promptById(r.promptId).label, K.ROUTES[r.target].title]),
        settingsTitle: "Reguły kierowania zapytań", optsTitle: "Zadania złożone na danych publicznych",
        rule: ["Dane chronione → tylko model lokalny", "Reguła stała: dane wymagające ochrony nie są przekazywane do zewnętrznych dostawców modeli AI."],
        rerun: ["Sprawdź na zadaniu złożonym", "complex"]
      };
    },

    contract(c, ds, p, d) { ds.route = d ? d.target : ""; },

    probe(c, failures, { p, d, wi, done, ds }) {
      const { $, IDX, state, after, inspector, flowEl } = c;
      if (p && ds.route !== d.target) failures.push("route-contract");
      if (p && items(p).length && ds.route !== "local") failures.push("privacy-route");
      if (p && items(p).length) $("iRoutes").querySelectorAll('[data-route="apiq"],[data-route="frontier"]').forEach(r => { if (r.dataset.state === "on") failures.push("privacy-card"); });
      if (p && after("route", 0.7)) {
        const chosen = [...flowEl.querySelectorAll('[data-state="chosen"],[data-state="active"]')].map(n => n.dataset.node).filter(n => K.ROUTE_IDS.includes(n));
        if (chosen.length !== 1 || chosen[0] !== d.target) failures.push("flow-target");
      }
      if (p && !inspector.hidden && after("scan", 0.72) && items(p).length) {
        const marks = inspector.querySelectorAll("mark.pii");
        if (marks.length !== items(p).length || [...marks].some(m => m.dataset.masked !== "true")) failures.push("mask-contract");
        if (items(p).some(s => ($("iText").textContent + $("iAtt").textContent).includes(s.text))) failures.push("mask-leak");
      }
      if (wi.renderer === "webgl" && done && p) {
        if (state.scene > IDX.route && wi.arrow !== d.target) failures.push("world-arrow");
        if (items(p).length && state.scene > IDX.route && wi.barriers !== "down") failures.push("world-barriers");
        if (state.scene >= IDX.scan && state.scene <= IDX.model && wi.redactions !== items(p).length) failures.push("world-redactions:" + wi.redactions);
        if (state.scene >= IDX.send && state.scene <= IDX.model && wi.attachments !== (p.attachment ? 1 : 0)) failures.push("world-attachments:" + wi.attachments);
        if (state.scene > IDX.route && (wi.rules.match(/H/g) || []).length !== 1) failures.push("world-rules:" + wi.rules);
        if (ds.scene === "scan" && wi.scanView !== (items(p).length ? "masked" : "clear")) failures.push("world-xray:" + wi.scanView);
        if (ds.scene === "model" && !d.external && wi.blade !== 0) failures.push("world-blade-left-open");
      }
    },
    selfTestCheck(c, results) {
      c.state.runs.forEach(r => { const d = K.decide(K.promptById(r.promptId), r.settings); if (d.target !== r.target) results.push("run-target:" + r.promptId + "/" + r.settings.external); if (r.sensitive && r.target !== "local") results.push("run-privacy"); });
    }
  };

  // ─── Init ───
  window.KlaraWorld = window.WorldCore.create(window.KlaraStations);
  window.AppCore.start({
    data: K, world: window.KlaraWorld, icons: ICONS,
    brand: {
      name: "Klara", mark: "K", tagline: "bezpieczny (i inteligentny) chat AI", chatPill: "model dobierany automatycznie",
      hello: "Dzień dobry! W czym mogę pomóc? Model dopasuję do zadania automatycznie.", history: ["Plan szkoleń na IV kwartał", "Podsumowanie spotkania działu"],
      chipsLabel: "Przykładowe polecenia", placeholder: "Wybierz przykładowe polecenie powyżej…", placeholderNext: "Wybierz kolejne polecenie powyżej…",
      finalTitle: "Klara od środka – podsumowanie", finalSub: "Jedno okno czatu dla pracownika. Pełna kontrola nad danymi, modelami i kosztami po stronie organizacji.",
      tryAnother: "Wypróbuj inne polecenie", adminAction: "Zmień politykę organizacji", otherPrompt: "Inne polecenie", adminJump: "Zmień politykę w panelu", sibling: { label: "Zobacz też: Zagłoba od środka", href: "zagloba.html" }
    },
    autoOrder: ["sensitive", "routine", "complex", "attachment"],
    dwell: { scan: 4.5, route: 4.5 },
    calloutScenes: ["scan", "gauge", "route", "model"],
    // the admin panel's one setting: policy for complex tasks (?policy=<id>, App.setPolicy, data-policy)
    setting: { key: "external", param: "policy", attr: "policy", api: "setPolicy", label: "Model zewnętrzny dla zadań złożonych",
      options: K.POLICY_OPTIONS.map(o => ({ value: o.id, label: o.label, sub: o.sub })) },
    adminFrom: ["route", "model"],
    nextLabels: { chat: "Wyślij do Klary" },
    flowNodes: [
      { id: "desk", label: "Stanowisko" }, { id: "cable", label: "Kabel do serwera" }, { id: "scan", label: "Skaner" },
      { id: "gauge", label: "Miernik złożoności" }, { id: "switch", label: "Zwrotnica" }, { id: "local", label: "Model lokalny" },
      { id: "apiq", label: "Quantica APIQ" }, { id: "frontier", label: "Frontier API" }
    ],
    flowPath: ["desk", "cable", "scan", "gauge", "switch"],
    hooks
  });
})();
