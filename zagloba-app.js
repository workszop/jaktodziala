/* Zagłoba od środka – product layer for the shared app shell (app-core.js): retrieval decision and access settings,
   narration, in-world callouts, inspector (question, candidates, citations), chat answers with sources, admin panel
   content (data sources + user's access to the board folder) and probes. */
(() => {
  "use strict";

  // ─── Constants ───
  const Z = window.ZaglobaData;
  const ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    access: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/></svg>',
    rank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21V9h6v12M3 21v-7h6M15 21v-4h6M3 21h18"/></svg>',
    answer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h7M8.5 9h4"/></svg>',
    sources: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>'
  };
  const USER_LINE = Z.USER.name + " · " + Z.USER.dept;

  // ─── Helpers ───
  const docTitle = id => Z.DOCS[id].title;
  const srcTitle = id => Z.SOURCES[Z.DOCS[id].source].title;

  // ─── Hooks ───
  const hooks = {
    calloutsFor(c, p, d) {
      const id = c.sid(), t = c.state.t, out = [];
      if (id === "send" && t > 0.85) out.push({ id: "server", anchor: "server", side: "top", tone: "brand", kicker: "Quantica AI Server", title: "Zagłoba działa w organizacji",
        lines: [{ text: "pytanie dotarło do serwera organizacji", state: "ok" }, { text: "dokumenty i dane nie trafiają do zewnętrznych dostawców AI", state: "on" }] });
      if (id === "search") {
        if (d.fresh.length && t > 0.02 && t < 0.32) out.push({ id: "sync", anchor: "sharepoint", side: "right", tone: "accent", kicker: "Synchronizacja w tle", title: "Nowy dokument w indeksie",
          lines: [{ text: docTitle(d.fresh[0]), state: "on" }, { text: "zmieniony w SharePoint – uwzględniony automatycznie", state: "ok" }, { text: "bez przenoszenia do nowego repozytorium", state: "muted" }] });
        if (t > 0.45) out.push({ id: "search", anchor: "search", side: "right", tone: "accent", kicker: "Krok 1 · Wyszukiwanie hybrydowe", title: t > 0.75 ? "Znaleziono " + d.candidates.length + " dokumenty" : "Przeszukiwanie bazy wiedzy…",
          lines: [{ text: "semantyczne: znaczenie pytania", state: "on" }, { text: "słowa kluczowe: wyróżnione na kartce", state: "on" }, ...(t > 0.75 ? d.candidates.map(cid => ({ text: docTitle(cid), state: "muted" })) : [])] });
      }
      if (id === "access" && t > 0.3) out.push({ id: "gate", anchor: "gate", side: "right", tone: "admin", kicker: "Krok 2 · Kontrola uprawnień", title: USER_LINE,
        lines: d.candidates.filter((_, i) => t > 0.32 + i * 0.13).map(cid => d.skipped.includes(cid) ? { text: docTitle(cid) + " – BRAK DOSTĘPU, pominięty", state: "flag" } : { text: docTitle(cid) + " – dostęp", state: "ok" }) });
      if (id === "rank" && t > 0.35) out.push({ id: "podium", anchor: "podium", side: "right", tone: "accent", kicker: "Krok 3 · Ocena trafności",
        title: d.ranked.length ? "Do odpowiedzi: " + d.ranked.length + " najtrafniejsze" : "Brak trafnych dokumentów",
        lines: [...d.ranked.map((cid, i) => ({ text: (i + 1) + ". " + docTitle(cid) + " · " + Math.round(d.scores[cid].score * 100) + "%", state: "on" })),
          ...d.dropped.map(cid => ({ text: docTitle(cid) + " · za niska trafność", state: "muted" }))] });
      if (id === "model" && t > 0.42) out.push(d.outcome === "answer"
        ? { id: "local", anchor: "local", side: "top", tone: "ok", kicker: "Model lokalny", title: "Odpowiedź ze źródeł",
          lines: [{ text: "tylko na podstawie wybranych fragmentów", state: "ok" }, { text: "przypisy " + d.citations.map((_, i) => "[" + (i + 1) + "]").join(" ") + " do dokumentów źródłowych", state: "on" }, { text: "dane nie opuszczają organizacji", state: "ok" }] }
        : { id: "local", anchor: "local", side: "top", tone: "accent", kicker: "Model lokalny", title: "Brak pokrycia w bazie",
          lines: [{ text: "bez odpowiedzi spekulatywnej", state: "flag" }, { text: "wskazanie źródła: " + d.redirect, state: "on" }] });
      return out;
    },

    // Flow extras on top of the core's packet path: the sync pulse from the sources and the answer node.
    flowStates(c, st, id, t, d) {
      if (id === "search" && d && d.fresh.length && t < 0.3) st.sources = "active";
      if (d && (c.IDX[id] > c.IDX.model || (id === "model" && t >= 0.5))) st.answer = d.outcome === "answer" ? "chosen" : "blocked";
    },

    narration(c) {
      const id = c.sid(), p = c.prompt(), d = p ? c.decision() : null;
      switch (id) {
        case "login": return { lead: "Robot siada przy komputerze. Na pulpicie czeka Zagłoba – asystent wiedzy organizacji. Logowanie kontem organizacji przenosi role i uprawnienia użytkownika.",
          bullets: ["Wiedza jest rozproszona między dokumentami, repozytoriami i systemami – Zagłoba daje do niej jeden, bezpieczny dostęp.", "Odpowiedzi są generowane wyłącznie na podstawie informacji, do których użytkownik ma uprawnienia.", "Organizacja: " + Z.ORG.name + " (" + Z.ORG.note + ") · użytkownik: " + Z.USER.name + ", " + Z.USER.dept] };
        case "chat": return { lead: "Użytkownik zadaje pytanie tak, jak koledze z działu. Zagłoba przeszuka dostępne źródła, wybierze najtrafniejsze informacje i odpowie ze wskazaniem dokumentów.",
          bullets: ["Pytanie 2 dotyczy dokumentów, do których użytkownik nie ma pełnego dostępu.", "Pytanie 3 nie ma pokrycia w bazie, pytanie 4 dotyczy dokumentu zmienionego wczoraj.", "Klawisze 1–4 wybierają pytanie, Enter wysyła."] };
        case "send": return { lead: "Pytanie jedzie do Quantica AI Server w serwerowni organizacji. Zagłoba może działać w pełni lokalnie – bez przekazywania dokumentów zewnętrznym dostawcom AI.",
          bullets: ["Organizacja zachowuje kontrolę nad miejscem przechowywania i przetwarzania danych.", "Koszty nie zależą od liczby zapytań do komercyjnych modeli językowych."] };
        case "search": return { lead: "Zagłoba przeszukuje bazę wiedzy połączoną z SharePoint, OneDrive i Amazon S3. Wyszukiwanie jest hybrydowe: semantyczne (znaczenie) i po słowach kluczowych.",
          bullets: [d.fresh.length ? "Dokument zmieniony wczoraj w SharePoint jest już w indeksie – synchronizacja uwzględnia nowe i zmienione dokumenty." : "Dokumenty zostają w swoich systemach – nie trzeba ich przenosić do kolejnego repozytorium.", "Znaleziono " + d.candidates.length + " dokumenty kandydujące."] };
        case "access": return d.skipped.length
          ? { lead: "Bramka sprawdza uprawnienia użytkownika do każdego znalezionego dokumentu. " + docTitle(d.skipped[0]) + " leży w folderze Zarządu – użytkownik nie ma do niego dostępu, więc dokument zostaje pominięty.",
            bullets: ["Zachowane są istniejące role i poziomy dostępu.", "Pominięty dokument nie trafi do odpowiedzi ani do przypisów."] }
          : { lead: "Bramka sprawdza uprawnienia użytkownika do każdego znalezionego dokumentu. Wszystkie dokumenty kandydujące są dostępne dla tego użytkownika.",
            bullets: ["Odpowiedzi dla każdego użytkownika powstają wyłącznie z informacji, do których ma uprawnienia."] };
        case "rank": return { lead: "Ponowna ocena trafności porządkuje dostępne dokumenty. Do odpowiedzi trafiają tylko najtrafniejsze fragmenty" + (d.dropped.length ? "; " + d.dropped.length + " dokument odpada jako mało trafny." : "."),
          bullets: [d.outcome === "answer" ? "Odpowiedź powstanie na podstawie " + d.ranked.length + " dokumentów – ze wskazaniem źródeł." : "Dostępne dokumenty nie odpowiadają na pytanie – nie będzie odpowiedzi spekulatywnej."] };
        case "model": return d.outcome === "answer"
          ? { lead: "Lokalny model językowy przygotowuje odpowiedź wyłącznie z wybranych fragmentów i dodaje przypisy do dokumentów źródłowych.", bullets: ["Ogranicza to ryzyko odpowiedzi błędnych lub nieaktualnych.", "Użytkownik może zweryfikować informacje w materiałach źródłowych."] }
          : { lead: "W bazie nie ma informacji, która odpowiada na pytanie. Zagłoba nie tworzy odpowiedzi spekulatywnej – informuje o braku danych i wskazuje właściwe źródło: " + d.redirect + ".", bullets: ["Obowiązujące dziś zasady są wskazane jako punkt odniesienia."] };
        case "return": return { lead: "Odpowiedź wraca do okna Zagłoby razem z przypisami do dokumentów źródłowych.", bullets: [d.badge + "."] };
        case "admin": return { lead: "Organizacja łączy Zagłobę z istniejącymi repozytoriami i zarządza dostępem. Zmień uprawnienia użytkownika do folderu Zarządu i zadaj pytanie 2 ponownie.",
          bullets: ["Synchronizacja w tle obejmuje nowe i zmienione dokumenty.", "Uprawnienia działają na poziomie każdego dokumentu."] };
        default: return { lead: "Zagłoba daje szybki i bezpieczny dostęp do wiedzy organizacji – z odpowiedziami ze wskazaniem źródeł.", bullets: [] };
      }
    },

    renderInspector(c) {
      const { el, icon, $, after, setText } = c, p = c.prompt(), d = c.decision();
      const iText = $("iText"), iDocs = $("iDocs"), iMeta = $("iMeta");
      if (iText.dataset.prompt !== p.id) { iText.textContent = p.text; iText.dataset.prompt = p.id; }
      const found = after("search", 0.75), access = after("access", 0.6), rank = after("rank", 0.6);
      const key = [p.id, found, access, rank, JSON.stringify(c.settings())].join("|");
      if (iDocs.dataset.key !== key) {
        iDocs.dataset.key = key; iDocs.replaceChildren();
        if (!found) iDocs.appendChild(el("p", "meta", "dokumenty: wyszukiwanie…"));
        else d.candidates.forEach(cid => {
          const sk = d.skipped.includes(cid), r = d.ranked.indexOf(cid), row = el("div", "doc"); row.dataset.doc = cid;
          row.dataset.state = access && sk ? "skipped" : rank ? (r >= 0 ? "cited" : "dropped") : "candidate";
          row.append(icon(access && sk ? "lock" : "doc"), el("b", null, (rank && r >= 0 ? "[" + (r + 1) + "] " : "") + docTitle(cid)), el("small", null, srcTitle(cid) + " · " + Math.round(d.scores[cid].score * 100) + "%"));
          iDocs.appendChild(row);
        });
      }
      c.renderChecks(["przeszukiwanie bazy wiedzy", "kontrola uprawnień", "ocena trafności"], [found, access, rank], [false, d.skipped.length > 0, d.outcome === "nodata"], d.checks);
      setText(iMeta, after("model", 0.5) ? d.badge : "");
    },

    // Chat: answers carry citation cards; "no data" answers name the right source.
    currentRun: (c, d) => ({ outcome: d.outcome, citations: [...d.citations], skipped: [...d.skipped], answer: d.answer, badge: d.badge }),
    answerBody(c, run, bubble) {
      bubble.appendChild(document.createTextNode(run.answer));
      if (run.citations.length) {
        const list = c.el("div", "cites");
        run.citations.forEach((cid, i) => { const ct = c.el("div", "cite"); ct.dataset.doc = cid; ct.append(c.icon("doc"), c.el("b", null, "[" + (i + 1) + "] " + docTitle(cid)), c.el("small", null, srcTitle(cid))); list.appendChild(ct); });
        bubble.appendChild(list);
      }
      const m = c.el("div", "meta" + (run.outcome === "nodata" ? " warn" : "")); m.append(c.icon("ok"), c.el("span", null, run.badge)); bubble.appendChild(m);
    },
    announce: (c, p, d) => "Odpowiedź Zagłoby: " + d.answer,
    runLine: (c, r) => [Z.promptById(r.promptId).label + (r.settings.boardAccess ? " · z dostępem do folderu Zarządu" : ""),
      r.outcome === "answer" ? "odpowiedź · źródła: " + r.citations.length : "brak danych → " + Z.promptById(r.promptId).redirect],

    // Admin console content (usage, data sources); the core builds the panel around it with the access options.
    admin(c) {
      const runs = c.state.runs;
      return {
        usage: "Wykorzystanie (ta sesja demo)",
        tiles: [["Pytania", runs.length, ""], ["Odpowiedzi ze źródłami", runs.filter(r => r.outcome === "answer").length, "ok"], ["Brak pokrycia", runs.filter(r => r.outcome === "nodata").length, "admin"],
          ["Dokumenty pominięte (uprawnienia)", runs.reduce((a, r) => a + r.skipped.length, 0), "danger"], ["Źródła danych", Z.SOURCE_IDS.length, ""], ["Przypisy w odpowiedziach", runs.reduce((a, r) => a + r.citations.length, 0), ""]],
        logTitle: "Źródła danych · synchronizacja w tle",
        log: Z.SOURCE_IDS.map(sid => [Z.SOURCES[sid].title + " · " + Object.values(Z.DOCS).filter(doc => doc.source === sid).length + " dokumenty (demo)", sid === "sharepoint" ? "zmiana wykryta wczoraj" : "aktualne"]),
        settingsTitle: "Uprawnienia: " + Z.USER.name + " · folder Zarządu",
        rule: ["Role i poziomy dostępu są zachowane", "Odpowiedzi powstają wyłącznie z dokumentów, do których użytkownik ma uprawnienia."],
        rerun: ["Zadaj ponownie pytanie o projekt", "restricted"]
      };
    },

    contract(c, ds, p, d) { ds.outcome = d ? d.outcome : ""; ds.cited = d ? d.citations.join(",") : ""; ds.skipped = d ? d.skipped.join(",") : ""; },

    probe(c, failures, { p, d, wi, done, ds }) {
      const { $, IDX, state, after, display } = c, s = c.settings();
      if (!p) return;
      // permission invariant on every surface: decision, inspector, chat
      for (const cid of d.citations) if (!Z.canRead(Z.DOCS[cid], s)) failures.push("permission-citation:" + cid);
      if (after("rank", 0.6)) $("iDocs").querySelectorAll('[data-state="cited"]').forEach(r => { if (d.skipped.includes(r.dataset.doc)) failures.push("permission-inspector"); });
      // the current answer is the last bot bubble (earlier ones belong to runs with their own settings)
      const bots = display.querySelectorAll(".bubble.bot"), current = ds.scene === "return" && bots.length ? bots[bots.length - 1] : null;
      if (current) current.querySelectorAll(".cite").forEach(ct => { if (!Z.canRead(Z.DOCS[ct.dataset.doc], s)) failures.push("permission-chat"); });
      if (current && current.querySelectorAll(".cite").length !== d.citations.length) failures.push("chat-citations");
      if (d.outcome === "nodata" && !d.answer.includes(d.redirect)) failures.push("nodata-redirect");
      if (wi.renderer === "webgl" && done) {
        if (ds.scene === "search" && wi.candidates !== d.candidates.length) failures.push("world-candidates:" + wi.candidates);
        if (ds.scene === "access" && wi.skippedShown !== d.skipped.length) failures.push("world-skipped:" + wi.skippedShown);
        if (ds.scene === "rank" && wi.podium !== d.ranked.length) failures.push("world-podium:" + wi.podium);
        if (state.scene >= IDX.search && state.scene <= IDX.return && wi.monitorView !== "results") failures.push("world-monitor:" + wi.monitorView);
        if (state.scene >= IDX.search && state.scene <= IDX.model && wi.keywords < 1) failures.push("world-keywords");
        if (ds.scene === "model" && wi.blade !== 0) failures.push("world-blade-left-open");
      }
    },
    selfTestCheck(c, results) {
      c.state.runs.forEach(r => { for (const cid of r.citations) if (!Z.canRead(Z.DOCS[cid], r.settings)) results.push("run-permission:" + r.promptId + "/" + cid); });
    }
  };

  // ─── Init ───
  window.ZaglobaWorld = window.WorldCore.create(window.ZaglobaStations);
  window.AppCore.start({
    data: Z, world: window.ZaglobaWorld, icons: ICONS,
    brand: {
      name: "Zagłoba", mark: "Z", tagline: "inteligentny asystent wiedzy", chatPill: "odpowiedzi ze wskazaniem źródeł",
      hello: "Dzień dobry! Odpowiem na podstawie dokumentów organizacji i wskażę źródła.", history: ["Procedura urlopowa", "Zasady obiegu faktur"],
      chipsLabel: "Przykładowe pytania", placeholder: "Wybierz przykładowe pytanie powyżej…", placeholderNext: "Wybierz kolejne pytanie powyżej…",
      finalTitle: "Zagłoba od środka – podsumowanie", finalSub: "Jedno okno pytań dla pracownika. Odpowiedzi tylko z dokumentów, do których ma uprawnienia – ze wskazaniem źródeł.",
      tryAnother: "Zadaj inne pytanie", adminAction: "Zmień uprawnienia", otherPrompt: "Inne pytanie", adminJump: "Zmień uprawnienia w panelu", sibling: { label: "Zobacz też: Klara od środka", href: "klara.html" }
    },
    autoOrder: ["procedure", "restricted", "nodata", "fresh"],
    dwell: { search: 4.5, access: 4.5, rank: 4 },
    calloutScenes: ["search", "access", "rank", "model"],
    // the admin panel's one setting: the user's access to the board folder (?access=board, App.setAccess, data-board-access)
    setting: { key: "boardAccess", param: "access", attr: "boardAccess", api: "setAccess", label: "Dostęp użytkownika do folderu Zarządu",
      options: [{ value: false, tag: "", label: "Brak dostępu", sub: "folder Zarządu niedostępny dla " + Z.USER.name },
        { value: true, param: "board", tag: "/zarząd", label: "Dostęp nadany", sub: "np. po delegowaniu do projektu inwestycji" }] },
    adminFrom: ["access", "rank"],
    nextLabels: { chat: "Zapytaj Zagłobę" },
    flowNodes: [
      { id: "desk", label: "Stanowisko" }, { id: "cable", label: "Kabel do serwera" }, { id: "sources", label: "Źródła danych" },
      { id: "search", label: "Wyszukiwanie" }, { id: "access", label: "Uprawnienia" }, { id: "rank", label: "Trafność" },
      { id: "local", label: "Model lokalny" }, { id: "answer", label: "Odpowiedź ze źródłami" }
    ],
    flowPath: ["desk", "cable", "search", "access", "rank", "local"],
    hooks
  });
})();
