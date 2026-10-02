/* Zagłoba od środka – data: scenes, sources, knowledge base, questions and the pure retrieval decision.
   Classic script: attaches window.ZaglobaData (also loadable in Node via vm for tests).
   Product statements follow https://quanticalab.ai/zagloba_website.html; documents, fragments, people and the
   company (Falkarton Sp. z o.o.) are fictional fixtures. */
(function (root) {
  "use strict";

  // ─── Constants ───
  const ORG = { name: "Falkarton Sp. z o.o.", note: "firma fikcyjna" };
  const USER = { name: "R. Bot", login: "r.bot", dept: "dział administracji", rights: "dokumenty działowe · procedury · regulaminy (bez folderu Zarządu)" };

  // Systems the knowledge base is synchronised with – documents stay where they are.
  const SOURCES = {
    sharepoint: { id: "sharepoint", title: "SharePoint", tone: "srcA" },
    onedrive: { id: "onedrive", title: "OneDrive", tone: "srcB" },
    s3: { id: "s3", title: "Amazon S3", tone: "srcC" }
  };
  const SOURCE_IDS = ["sharepoint", "onedrive", "s3"];

  // Knowledge base: access "all" or "board" (folder Zarządu – only with granted access).
  const DOCS = {
    reklamacje: { title: "Procedura reklamacji dostaw.pdf", source: "sharepoint", access: "all", updated: "2026-05-12",
      fragment: "Reklamację klienta hurtowego rejestruje się w systemie zamówień w ciągu 2 dni roboczych od zgłoszenia." },
    obieg: { title: "Instrukcja obiegu dokumentów.docx", source: "sharepoint", access: "all", updated: "2026-03-02",
      fragment: "Dokumenty reklamacyjne trafiają do działu jakości, który odpowiada w terminie 14 dni." },
    cennik: { title: "Cennik kartonów klapowych 2026.xlsx", source: "onedrive", access: "all", updated: "2026-01-15",
      fragment: "Cennik obowiązuje do 31 grudnia 2026 r." },
    notatka: { title: "Notatka ze spotkania projektowego.docx", source: "onedrive", access: "all", updated: "2026-09-18",
      fragment: "Start pilotażu nowej linii produkcyjnej zaplanowano na II kwartał 2027 r." },
    harmonogram: { title: "Harmonogram wdrożenia linii.xlsx", source: "onedrive", access: "all", updated: "2026-09-25",
      fragment: "Odpowiedzialny: zespół wdrożeniowy; kamienie milowe co 6 tygodni." },
    budzet: { title: "Budżet inwestycji – Zarząd.xlsx", source: "sharepoint", access: "board", updated: "2026-09-20",
      fragment: "Zatwierdzony budżet inwestycji: 4,2 mln zł, rezerwa 10%." },
    delegacje: { title: "Regulamin delegacji 2026.pdf", source: "s3", access: "all", updated: "2026-01-02",
      fragment: "Obowiązujące zasady rozliczania delegacji zagranicznych opisuje § 7 regulaminu." },
    zdalna: { title: "Regulamin pracy zdalnej.docx", source: "sharepoint", access: "all", updated: "2026-10-01", fresh: true,
      fragment: "Od 1 października 2026 r. limit pracy zdalnej wynosi 2 dni w tygodniu; wniosek składa się przez system kadrowy." }
  };

  // Questions with retrieval candidates (semantic + keyword scores 0..1). `covered` = the base answers the question.
  const PROMPTS = [
    {
      id: "procedure", key: "1", label: "Pytanie o procedurę",
      text: "Jak zarejestrować reklamację dostawy od klienta hurtowego?",
      candidates: [["reklamacje", 0.92, 0.88], ["obieg", 0.81, 0.62], ["cennik", 0.34, 0.41]],
      covered: true,
      answer: "Reklamację rejestruje się w systemie zamówień w ciągu 2 dni roboczych od zgłoszenia [1]. Dokumenty przekazuje się do działu jakości, który odpowiada w terminie 14 dni [2]."
    },
    {
      id: "restricted", key: "2", label: "Ograniczony dostęp",
      text: "Podsumuj ustalenia z dokumentacji projektu nowej linii produkcyjnej.",
      candidates: [["notatka", 0.89, 0.8], ["budzet", 0.86, 0.74], ["harmonogram", 0.78, 0.71]],
      covered: true,
      answer: "Ustalenia: start pilotażu w II kwartale 2027 r. [1]; odpowiedzialny zespół wdrożeniowy, kamienie milowe co 6 tygodni [2].",
      answerWithBoard: "Ustalenia: start pilotażu w II kwartale 2027 r. [1]; zatwierdzony budżet inwestycji [2]; odpowiedzialny zespół wdrożeniowy, kamienie milowe co 6 tygodni [3]."
    },
    {
      id: "nodata", key: "3", label: "Brak pokrycia w bazie",
      text: "Jakie zasady rozliczania delegacji zagranicznych będą obowiązywać w przyszłym roku?",
      candidates: [["delegacje", 0.71, 0.66], ["cennik", 0.22, 0.18]],
      covered: false, redirect: "dział finansowy",
      answer: "W bazie wiedzy nie ma informacji o zasadach na przyszły rok. Obowiązujące dziś zasady opisuje [1]. Właściwym źródłem informacji o zmianach jest dział finansowy."
    },
    {
      id: "fresh", key: "4", label: "Nowy dokument",
      text: "Co zmieniło się w regulaminie pracy zdalnej od października?",
      candidates: [["zdalna", 0.94, 0.9], ["obieg", 0.3, 0.25]],
      covered: true,
      answer: "Od 1 października 2026 r. limit pracy zdalnej wynosi 2 dni w tygodniu, a wniosek składa się przez system kadrowy [1]."
    }
  ];

  const SCENES = [
    { id: "login", n: "01", title: "Pulpit i logowanie", short: "Pulpit", dur: 7.5, packet: "none" },
    { id: "chat", n: "02", title: "Pytanie", short: "Pytanie", dur: 0.6, packet: "none" },
    { id: "send", n: "03", title: "Wysyłka", short: "Wysyłka", dur: 4.4, packet: "inlet" },
    { id: "search", n: "04", title: "Wyszukiwanie w bazie wiedzy", short: "Szukanie", dur: 6.0, packet: "search" },
    { id: "access", n: "05", title: "Kontrola uprawnień", short: "Uprawnienia", dur: 5.2, packet: "access" },
    { id: "rank", n: "06", title: "Ocena trafności", short: "Trafność", dur: 4.6, packet: "rank" },
    { id: "model", n: "07", title: "Odpowiedź ze źródeł", short: "Model", dur: 5.2, packet: "local" },
    { id: "return", n: "08", title: "Odpowiedź", short: "Odpowiedź", dur: 5.4, packet: "desk" },
    { id: "admin", n: "09", title: "Źródła i uprawnienia", short: "Panel", dur: 2.2, packet: "none" },
    { id: "final", n: "10", title: "Podsumowanie", short: "Finał", dur: 1.2, packet: "none" }
  ];

  // Benefit headings, verbatim from the product page.
  const BENEFITS = [
    { title: "Szybszy dostęp do wiedzy", text: "Pracownicy uzyskują potrzebne informacje bez ręcznego przeszukiwania dokumentów, repozytoriów i systemów." },
    { title: "Wiarygodne i weryfikowalne odpowiedzi", text: "System wskazuje dokumenty wykorzystane do przygotowania odpowiedzi – podstawę można sprawdzić." },
    { title: "Wykorzystanie istniejących systemów i danych", text: "Zagłoba integruje się z repozytoriami organizacji i automatycznie uwzględnia nowe i zmienione dokumenty." },
    { title: "Bezpieczeństwo i kontrola nad wiedzą organizacji", text: "Lokalne wdrożenie, zarządzanie dostępem i guardrails – kontrola nad danymi i zakresem informacji." },
    { title: "Rozwiązanie gotowe do rozwoju wraz z organizacją", text: "Modułowa architektura klasy enterprise i monitoring działania." }
  ];
  const SOURCE_URL = "https://quanticalab.ai/zagloba_website.html";
  const DEFAULT_SETTINGS = { boardAccess: false };
  const RELEVANCE_MIN = 0.5, TOP_K = 3;

  // ─── Helpers ───
  const promptById = id => PROMPTS.find(p => p.id === id) || null;
  const sceneIndex = id => SCENES.findIndex(s => s.id === id);
  const canRead = (doc, settings) => doc.access === "all" || (doc.access === "board" && !!(settings && settings.boardAccess));
  // Hybrid score: semantic and keyword search combined, then re-ranked.
  const scoreOf = ([, sem, kw]) => Math.round((0.6 * sem + 0.4 * kw) * 100) / 100;

  // Pure retrieval decision. Invariant: a document the user cannot read is never cited.
  function decide(prompt, settings) {
    if (!prompt) return null;
    const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    const candidates = prompt.candidates.map(c => ({ id: c[0], semantic: c[1], keyword: c[2], score: scoreOf(c), doc: DOCS[c[0]] }));
    const skipped = candidates.filter(c => !canRead(c.doc, s)).map(c => c.id);
    const allowed = candidates.filter(c => canRead(c.doc, s)).sort((a, b) => b.score - a.score);
    const ranked = allowed.filter(c => c.score >= RELEVANCE_MIN).slice(0, TOP_K);
    const dropped = allowed.filter(c => !ranked.includes(c)).map(c => c.id);
    const outcome = prompt.covered && ranked.length ? "answer" : "nodata";
    const citations = ranked.map(c => c.id);
    const answer = prompt.id === "restricted" && s.boardAccess && prompt.answerWithBoard ? prompt.answerWithBoard : prompt.answer;
    return {
      outcome, candidates: candidates.map(c => c.id), skipped, ranked: ranked.map(c => c.id), dropped, citations, answer,
      scores: Object.fromEntries(candidates.map(c => [c.id, { semantic: c.semantic, keyword: c.keyword, score: c.score }])),
      fresh: citations.filter(id => DOCS[id].fresh), redirect: prompt.redirect || null,
      checks: [
        "przeszukiwanie bazy wiedzy: " + candidates.length + " dokumenty kandydujące",
        skipped.length ? "kontrola uprawnień: " + skipped.length + " dokument pominięty – brak uprawnień użytkownika" : "kontrola uprawnień: użytkownik ma dostęp do wyszukanych dokumentów",
        outcome === "answer" ? "ocena trafności: " + ranked.length + " najtrafniejsze fragmenty do odpowiedzi" : "ocena trafności: brak wystarczających informacji w bazie wiedzy"
      ],
      badge: outcome === "nodata" ? "brak danych – wskazano właściwe źródło: " + prompt.redirect
        : skipped.length ? "odpowiedź na podstawie zasobów dostępnych użytkownikowi" : "informacje można zweryfikować w materiałach źródłowych"
    };
  }

  // Expected packet location at the end of a scene, for the DOM contract and probes.
  function packetAt(sceneId) {
    const sc = SCENES[sceneIndex(sceneId)];
    return sc ? sc.packet : "none";
  }

  root.ZaglobaData = Object.freeze({ ORG, USER, SOURCES, SOURCE_IDS, DOCS, PROMPTS, SCENES, BENEFITS, SOURCE_URL, DEFAULT_SETTINGS, RELEVANCE_MIN, TOP_K, promptById, sceneIndex, canRead, decide, packetAt });
})(typeof window !== "undefined" ? window : globalThis);
