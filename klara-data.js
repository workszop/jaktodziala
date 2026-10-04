/* Klara od środka – data: scenes, prompts, routes and the pure routing decision.
   Classic script: attaches window.KlaraData (also loadable in Node via vm for tests).
   Product statements follow https://quanticalab.ai/klara_website.html; people, numbers and the
   company (Falkarton Sp. z o.o.) are fictional fixtures. */
(function (root) {
  "use strict";

  // ─── Constants ───
  const ORG = { name: "Falkarton Sp. z o.o.", note: "firma fikcyjna" };
  const USER = { name: "R. Bot", login: "r.bot", dept: "dział kadr", rights: "czat AI · analiza dokumentów · przygotowanie tekstów" };

  // Where a request can be processed. `external` = leaves the organisation.
  const ROUTES = {
    local: { title: "Model lokalny", where: "infrastruktura organizacji", external: false, cost: "bez opłat za API" },
    apiq: { title: "Quantica APIQ", where: "modele hostowane przez Quantica", external: true, cost: "wg cennika Quantica APIQ" },
    frontier: { title: "Frontier API", where: "OpenAI · Anthropic · Gemini", external: true, cost: "wg cennika dostawcy frontier API" }
  };
  const ROUTE_IDS = ["local", "apiq", "frontier"];

  // Organisation policy for complex tasks on non-protected data (admin panel).
  const POLICY_OPTIONS = [
    { id: "apiq", label: "Quantica APIQ", sub: "modele hostowane przez Quantica" },
    { id: "frontier", label: "Frontier API", sub: "OpenAI · Anthropic · Gemini" },
    { id: "off", label: "Tylko modele lokalne", sub: "modele zewnętrzne wyłączone" }
  ];
  const DEFAULT_SETTINGS = { external: "apiq" };

  const COMPLEXITY = {
    routine: { label: "zadanie proste i rutynowe", needle: -0.62 },
    standard: { label: "zadanie standardowe", needle: 0 },
    high: { label: "zadanie wymaga najbardziej zaawansowanego modelu", needle: 0.66 }
  };

  // Prompts reuse the Falkarton HR station of the Explore the Floor demo (fictional people and numbers).
  const PROMPTS = [
    {
      id: "sensitive", key: "1", label: "Dane osobowe i poufne",
      text: "Przygotuj notatkę do oceny okresowej Piotra Zielińskiego, uwzględnij zwolnienie lekarskie w marcu i wynagrodzenie 7 400 zł.",
      sensitive: [
        { text: "Piotra Zielińskiego", kind: "imię i nazwisko", token: "[OSOBA]" },
        { text: "zwolnienie lekarskie w marcu", kind: "dane o zdrowiu", token: "[ZDROWIE]" },
        { text: "7 400 zł", kind: "wynagrodzenie", token: "[KWOTA]" }
      ],
      complexity: "standard",
      answer: "Notatka: pracownik [OSOBA] zrealizował cele kwartalne; nieobecność w marcu nie wpływa na ocenę wyników. Propozycja rozmowy rozwojowej w przyszłym miesiącu."
    },
    {
      id: "routine", key: "2", label: "Zadanie rutynowe",
      text: "Popraw styl maila z przypomnieniem o ofercie dla klienta hurtowego.",
      sensitive: [], complexity: "routine",
      answer: "Dzień dobry, uprzejmie przypominam o przesłanej ofercie na kartony klapowe. Chętnie odpowiem na pytania i dopasuję warunki dostaw do Państwa potrzeb."
    },
    {
      id: "complex", key: "3", label: "Zadanie złożone",
      text: "Przeanalizuj publiczne dane o rynku opakowań w Polsce i zaproponuj trzy kierunki dla strategii sprzedaży.",
      sensitive: [], complexity: "high",
      answer: "Proponowane kierunki: opakowania dla e-commerce z krótkim czasem dostawy, oferta opakowań z recyklingu dla klientów raportujących ESG oraz umowy ramowe z hurtowniami regionalnymi."
    },
    {
      // The prompt itself is harmless and complex (it would go external); the attachment carries company secrets.
      id: "attachment", key: "4", label: "Załącznik z danymi firmy",
      text: "Podsumuj załączony dokument w pięciu punktach do prezentacji dla zarządu.",
      sensitive: [], complexity: "high",
      attachment: {
        name: "Strategia_cenowa_2027.pdf", meta: "PDF · 3 strony · 412 KB",
        lines: [
          "Falkarton Sp. z o.o. – dokument wewnętrzny, POUFNE.",
          "Cel na 2027 r.: marża brutto 18,5% w segmencie e-commerce.",
          "Klienci strategiczni: KS-014 i KS-022 (sieci hurtowe).",
          "Od marca 2027 r. podwyżka cen kartonów klapowych o 7%."
        ],
        sensitive: [
          { text: "POUFNE", kind: "oznaczenie poufności", token: "[KLAUZULA]" },
          { text: "marża brutto 18,5%", kind: "tajemnica przedsiębiorstwa", token: "[FINANSE]" },
          { text: "KS-014 i KS-022", kind: "dane klientów", token: "[KLIENCI]" },
          { text: "podwyżka cen kartonów klapowych o 7%", kind: "plany cenowe", token: "[CENNIK]" }
        ]
      },
      answer: "Punkty dla zarządu: 1) cel marżowy [FINANSE] w e-commerce, 2) utrzymanie relacji z [KLIENCI], 3) zmiana cennika [CENNIK] od marca, 4) ryzyko reakcji konkurencji, 5) wcześniejsza komunikacja zmian z kluczowymi klientami."
    }
  ];

  // Where the packet is at the END of each scene (DOM contract: data-packet).
  const SCENES = [
    { id: "login", n: "01", title: "Pulpit i logowanie", short: "Pulpit", dur: 7.5, packet: "none" },
    { id: "chat", n: "02", title: "Okno czatu", short: "Czat", dur: 0.6, packet: "none" },
    { id: "send", n: "03", title: "Wysyłka", short: "Wysyłka", dur: 4.4, packet: "inlet" },
    { id: "scan", n: "04", title: "Skaner bezpieczeństwa", short: "Skaner", dur: 6.2, packet: "scan" },
    { id: "gauge", n: "05", title: "Miernik złożoności", short: "Złożoność", dur: 3.6, packet: "gauge" },
    { id: "route", n: "06", title: "Zwrotnica i reguły", short: "Zwrotnica", dur: 5.4, packet: "switch" },
    { id: "model", n: "07", title: "Model pracuje", short: "Model", dur: 5.2, packet: "@target" },
    { id: "return", n: "08", title: "Odpowiedź", short: "Odpowiedź", dur: 5.4, packet: "desk" },
    { id: "admin", n: "09", title: "Panel organizacji", short: "Panel", dur: 2.2, packet: "none" },
    { id: "final", n: "10", title: "Podsumowanie", short: "Finał", dur: 1.2, packet: "none" }
  ];

  // Benefit headings, verbatim from the product page.
  const BENEFITS = [
    { title: "Ograniczenie zjawiska shadow AI", text: "Pracownicy otrzymują wygodne narzędzie odpowiadające na rzeczywistą potrzebę korzystania z generatywnej AI." },
    { title: "Ochrona danych organizacji", text: "Dane wymagające ochrony nie są przekazywane do zewnętrznych dostawców modeli AI." },
    { title: "Niższe i bardziej przewidywalne koszty korzystania z AI", text: "Płatne modele zewnętrzne wykorzystywane są tylko wtedy, gdy ich możliwości są rzeczywiście potrzebne." },
    { title: "Lepsze zarządzanie wykorzystaniem AI", text: "Centralne środowisko pozwala monitorować sposób korzystania z modeli i zarządzać dostępem." }
  ];

  const SOURCE_URL = "https://quanticalab.ai/klara_website.html";

  // ─── Helpers ───
  const promptById = id => PROMPTS.find(p => p.id === id) || null;
  const sceneIndex = id => SCENES.findIndex(s => s.id === id);
  // Everything Klara inspects: the prompt text and the content of its attachments.
  const protectedItems = prompt => [
    ...(prompt && Array.isArray(prompt.sensitive) ? prompt.sensitive.map(s => ({ ...s, source: "prompt" })) : []),
    ...(prompt && prompt.attachment && Array.isArray(prompt.attachment.sensitive) ? prompt.attachment.sensitive.map(s => ({ ...s, source: "attachment" })) : [])
  ];

  // Pure routing decision. Invariant: protected data never gets an external target.
  function decide(prompt, policy) {
    if (!prompt) return null;
    const pol = policy && POLICY_OPTIONS.some(o => o.id === policy.external) ? policy : DEFAULT_SETTINGS;
    const sensitive = protectedItems(prompt);
    const fromAttachment = sensitive.some(s => s.source === "attachment");
    const level = COMPLEXITY[prompt.complexity] ? prompt.complexity : "standard";
    const kinds = [...new Set(sensitive.map(s => s.kind))];
    let target = "local", reason, badge;
    const states = { local: "faded", apiq: "faded", frontier: "faded" };
    if (sensitive.length) {
      states.apiq = "blocked"; states.frontier = "blocked";
      reason = (fromAttachment && !prompt.sensitive.length ? "dane chronione w załączniku" : "dane chronione") + " – zadanie realizuje model lokalny, trasy zewnętrzne zablokowane";
      badge = "dane pozostają w infrastrukturze organizacji";
    } else if (level !== "high") {
      reason = "wystarczająca jakość przy niższym koszcie – model lokalny";
      badge = "efektywne wykorzystanie własnej infrastruktury";
    } else if (pol.external === "off") {
      states.apiq = "off"; states.frontier = "off";
      reason = "polityka organizacji: modele zewnętrzne wyłączone – model lokalny";
      badge = "decyzję podejmuje polityka organizacji";
    } else {
      target = pol.external;
      const other = target === "apiq" ? "frontier" : "apiq";
      states[other] = "alt";
      reason = "zadanie złożone, brak danych chronionych – " + ROUTES[target].title;
      badge = "odpowiednia jakość odpowiedzi dla złożonego zadania";
    }
    states[target] = "on";
    return {
      target, states, reason, badge, kinds, level, fromAttachment, protectedCount: sensitive.length,
      external: ROUTES[target].external,
      checks: [
        sensitive.length ? "bezpieczeństwo danych: wykryto " + kinds.join(", ") + (fromAttachment ? " (także w załączniku)" : "") : "bezpieczeństwo danych: brak danych chronionych" + (prompt.attachment ? " (sprawdzono też załącznik)" : ""),
        "stopień złożoności: " + COMPLEXITY[level].label,
        "decyzja o wyborze modelu: " + ROUTES[target].title.toLowerCase()
      ],
      meta: ROUTES[target].external ? "na zewnątrz trafia wyłącznie treść zadania – bez danych chronionych · koszt: " + ROUTES[target].cost
        : "koszt: " + ROUTES[target].cost + " · dane: w organizacji"
    };
  }

  // Expected packet location at the end of a scene, for the DOM contract and probes.
  function packetAt(sceneId, decision) {
    const s = SCENES[sceneIndex(sceneId)];
    if (!s) return "none";
    if (s.packet === "@target") return decision ? decision.target : "none";
    return s.packet;
  }

  root.KlaraData = Object.freeze({ ORG, USER, ROUTES, ROUTE_IDS, POLICY_OPTIONS, DEFAULT_SETTINGS, COMPLEXITY, PROMPTS, SCENES, BENEFITS, SOURCE_URL, promptById, protectedItems, decide, packetAt });
})(typeof window !== "undefined" ? window : globalThis);
