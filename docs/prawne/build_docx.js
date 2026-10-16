// Dokumenty RODO i bezpieczeństwa Ostoi – szkic do przeglądu prawnego (.docx). Uruchom: node build_docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, ImageRun, Footer, PageNumber, LevelFormat, TableLayoutType,
  PageBreak, ExternalHyperlink,
} = require("docx");

const DIR = __dirname;

// Paleta i kroje z identyfikacji wizualnej (docs/identyfikacja-wizualna.md)
const C = { ink: "1E2422", muted: "5C6461", brand: "3F5650", tint: "E6EAE8", line: "D8DAD7", sand: "A68B5B", warnTint: "F1ECE2", warnInk: "6E5A33" };
const SERIF = "Georgia";
const SANS = "Arial";
const MONO = "Consolas";
const W = 9638; // szerokość tekstu: A4 minus marginesy 2 cm

const t = (text, o = {}) => new TextRun({ text, font: SANS, size: 21, color: C.ink, ...o });
const b = (text, o = {}) => t(text, { bold: true, ...o });
const code = (text) => new TextRun({ text, font: MONO, size: 19, color: C.ink });

// Tekst z prostym znacznikiem **pogrubienia** i `kodu`
function rich(s, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(t(s.slice(last, m.index), base));
    const tok = m[0];
    out.push(tok.startsWith("**") ? b(tok.slice(2, -2), base) : code(tok.slice(1, -1)));
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(t(s.slice(last), base));
  return out;
}

const p = (s, o = {}) => new Paragraph({ children: rich(s, o.run), spacing: { after: 120, line: 300 }, ...o.par });
const h1 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: s })], pageBreakBefore: false });
const h2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: s })] });
const bullet = (s) => new Paragraph({ numbering: { reference: "kropki", level: 0 }, children: rich(s), spacing: { after: 80, line: 290 } });
let listNo = 0;
function steps(items) {
  const ref = `kroki-${++listNo}`;
  numberingConfigs.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 400, hanging: 400 } }, run: { font: SANS, size: 21, color: C.brand, bold: true } } }],
  });
  return items.map((s) => new Paragraph({ numbering: { reference: ref, level: 0 }, children: rich(s), spacing: { after: 90, line: 290 } }));
}
const codeBlock = (lines) =>
  lines.map((l, i) => new Paragraph({
    children: [code(l)],
    shading: { type: ShadingType.CLEAR, fill: "F4F4F2", color: "auto" },
    spacing: { before: i === 0 ? 60 : 0, after: i === lines.length - 1 ? 140 : 0 },
    indent: { left: 120, right: 120 },
  }));

const border = { style: BorderStyle.SINGLE, size: 4, color: C.line };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

function table(widths, header, rows, o = {}) {
  const cell = (content, i, isHead) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: isHead ? { type: ShadingType.CLEAR, fill: C.tint, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: (Array.isArray(content) ? content : [content]).map((c) =>
      typeof c === "string"
        ? new Paragraph({ children: isHead ? [b(c, { size: 19, color: C.brand })] : rich(c, { size: 19 }), spacing: { after: 40, line: 260 } })
        : c),
  });
  return new Table({
    width: { size: widths.reduce((a, x) => a + x, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: o.cantSplit ?? true, children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}

// Ramka z najważniejszą informacją (pełne obramowanie, bez kolorowego lewego brzegu)
function box(title, paras, fill = C.tint) {
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill, color: "auto" },
      margins: { top: 160, bottom: 120, left: 220, right: 220 },
      children: [new Paragraph({ children: [b(title, { size: 22, color: C.brand })], spacing: { after: 100 } }), ...paras],
    })] })],
  });
}
const gap = (after = 160) => new Paragraph({ children: [], spacing: { after } });

const numberingConfigs = [
  { reference: "kropki", levels: [{ level: 0, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 400, hanging: 300 } }, run: { color: C.sand } } }] },
];


const body = [];
const add = (...x) => body.push(...x.flat());
const todo = "[DO UZUPEŁNIENIA]";

// Okładka
add(
  new Paragraph({ children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(DIR, "..", "poradnik", "logo.png")), transformation: { width: 168, height: 50 } })], spacing: { after: 360 } }),
  new Paragraph({ children: [new TextRun({ text: "Dane osobowe i bezpieczeństwo", font: SERIF, size: 52, color: C.ink })], spacing: { after: 120 } }),
  p("Szkic dokumentów RODO i wyniki przeglądu bezpieczeństwa – do przeglądu przez prawnika przed przyjęciem prawdziwych danych. Stan na 16 października 2026.", { run: { color: C.muted, size: 23 } }),
  box("Ważne", [
    p("Ten dokument przygotowano jako materiał roboczy na podstawie tego, jak działa aplikacja. Nie jest poradą prawną. Miejsca oznaczone " + todo + " wymagają danych spółki albo decyzji. Przed startem z prawdziwymi danymi przejrzy go prawnik specjalizujący się w ochronie danych."),
  ], C.warnTint),
  gap(200),
  p("**Zawartość:** 1. Kto jest administratorem czego · 2. Rejestr czynności przetwarzania · 3. Rejestr kategorii czynności (podmiot przetwarzający) · 4. Wzór umowy powierzenia z zakładem · 5. Regulamin dla zakładów – punkty wymagane przez P2B · 6. Polityka prywatności i regulamin dla rodzin · 7. Środki bezpieczeństwa · 8. Przegląd bezpieczeństwa z 16.10.2026 · 9. Lista kontrolna przed prawdziwymi danymi · 10. Procedury: naruszenia i wnioski osób."),
);

// 1. Role
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1("1. Kto jest administratorem czego"),
  p("Dane osób zmarłych nie są danymi osobowymi w rozumieniu RODO, ale prawie wszystkie dane w Ostoi dotyczą żyjących członków rodziny, więc całość traktujemy jak dane osobowe. Nie zbieramy przyczyny zgonu (dane o zdrowiu) ani numeru PESEL."),
  table([2600, 3600, 3438], ["Dane", "Kto decyduje (rola)", "Uzasadnienie"], [
    ["Zapytanie rodziny: imię, telefon, odpowiedzi z formularza", "**Ostoja – administrator**", "Ostoja decyduje, do którego zakładu trafia zapytanie i kiedy ujawnić numer."],
    ["Zlecenie po przyjęciu: dane osoby zmarłej i organizującej, terminy, usługi, numer konta do zasiłku", "**Zakład – administrator; Ostoja – podmiot przetwarzający**", "Zakład zawiera umowę z rodziną i odpowiada za dokumenty pogrzebu; Ostoja dostarcza narzędzie (panel). Umowa powierzenia – rozdział 4."],
    ["Konta pracowników zakładów (e-mail, imię, rola)", "**Ostoja – administrator**", "Ostoja prowadzi konta i dostęp do panelu."],
    ["Zapytania przekazane do opiekuna, dziennik działań administratorów", "**Ostoja – administrator**", "Opiekun Ostoi sam dzwoni do rodziny."],
    ["Rozliczenia z zakładami (NIP, liczba zleceń)", "**Ostoja – administrator**", "Fakturowanie; dane głównie firmowe."],
  ]),
  gap(),
);

// 2. Rejestr czynności
const reg = [
  ["Przyjmowanie zapytań od rodzin", "Przekazanie zapytania zakładom, kontakt zakładu z rodziną", "Członkowie rodzin osób zmarłych", "Imię i nazwisko, telefon, miasto, forma pochówku, ceremonia, miejsce zgonu (szpital/dom/DPS), budżet, liczba gości", "Art. 6 ust. 1 lit. b (działania przed umową na żądanie) i lit. a (zgoda na przekazanie numeru zakładowi)", "Zakład, który przyjął zapytanie; opiekun Ostoi; Supabase, Vercel, SMSAPI", "Vercel Inc. (USA): Ramy ochrony danych UE–USA + SCC", "Imię i telefon: 90 dni, potem usunięcie (funkcja purge_old_data, codziennie)"],
  ["Weryfikacja numeru kodem SMS", "Potwierdzenie, że numer należy do osoby wysyłającej; ochrona przed nadużyciami", "Jw.", "Telefon, skrót kodu, liczba prób", "Art. 6 ust. 1 lit. f", "SMSAPI", "–", "Niedokończony formularz: 24 h"],
  ["Ograniczanie liczby prób", "Ochrona przed spamem i atakami", "Odwiedzający stronę", "Skrót SHA-256 z rodzaju akcji i adresu IP (bez samego IP)", "Art. 6 ust. 1 lit. f", "–", "–", "1 doba"],
  ["Obsługa zapytań przez opiekuna", "Telefon do rodziny, gdy żaden zakład nie przyjął zapytania", "Członkowie rodzin", "Jak przy zapytaniu + notatka opiekuna", "Art. 6 ust. 1 lit. b i f", "Opiekunowie Ostoi", "Jw.", "Jak przy zapytaniu; dziennik odczytów 2 lata"],
  ["Konta w panelu zakładu", "Logowanie, uprawnienia, zaproszenia", "Właściciele i pracownicy zakładów", "E-mail, imię i nazwisko, rola, urządzenia z powiadomieniami push", "Art. 6 ust. 1 lit. b (umowa z zakładem) i f", "Supabase (logowanie), Vercel, dostawca poczty", "Jw.", "Do zakończenia współpracy + 1 rok " + todo],
  ["Dziennik działań administratorów", "Rozliczalność, wykrywanie nadużyć", "Administratorzy Ostoi; pośrednio rodziny", "Kto, co, kiedy, którego zakładu/zapytania dotyczyło", "Art. 6 ust. 1 lit. c (art. 5 ust. 2, art. 32 RODO) i f", "–", "–", "2 lata"],
  ["Rozliczenia z zakładami", "Faktury za zlecenia z podpisaną umową", "Zakłady (przedsiębiorcy), osoby kontaktowe", "Nazwa, NIP, adres, liczba zleceń, kwoty", "Art. 6 ust. 1 lit. b i c", "Biuro rachunkowe " + todo, "–", "5 lat od końca roku podatkowego"],
];
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1("2. Rejestr czynności przetwarzania (art. 30 ust. 1 RODO)"),
  p("Administrator: Ostoja sp. z o.o., " + todo + " (adres, NIP, KRS). Kontakt w sprawie danych: " + todo + ". Inspektor ochrony danych: nie wyznaczono (do decyzji – przy dużej skali monitorowania nie jest wymagany, ale można wyznaczyć dobrowolnie)."),
  ...reg.flatMap((r, i) => [
    h2(`2.${i + 1}. ${r[0]}`),
    table([2300, 7338], ["Pozycja", "Treść"], [
      ["Cel", r[1]], ["Kategorie osób", r[2]], ["Kategorie danych", r[3]], ["Podstawa prawna", r[4]],
      ["Odbiorcy", r[5]], ["Przekazanie poza EOG", r[6]], ["Okres przechowywania", r[7]],
    ]),
    gap(80),
  ]),
  p("Środki techniczne i organizacyjne dla wszystkich czynności: rozdział 7."),
);

// 3. Rejestr procesora
add(
  h1("3. Rejestr kategorii czynności – Ostoja jako podmiot przetwarzający (art. 30 ust. 2)"),
  table([2600, 7038], ["Pozycja", "Treść"], [
    ["Administratorzy", "Zakłady pogrzebowe – partnerzy Ostoi (lista w panelu administratora)"],
    ["Kategorie przetwarzania", "Przechowywanie i udostępnianie w panelu: dane zleceń (osoba zmarła, osoba organizująca, kontakt, terminy, usługi, kwoty, numer konta do zasiłku, zgody), kalendarz i rezerwacje, dokumenty (klepsydra, kosztorys), wysyłka SMS z linkiem do rodziny, strona pamięci publikowana na życzenie rodziny"],
    ["Dalsi podmioty przetwarzające", "Supabase Inc. (baza danych, region UE – Frankfurt), Vercel Inc. (hosting, region Frankfurt, firma z USA), SMSAPI (LINK Mobility Poland), dostawca poczty " + todo],
    ["Przekazanie poza EOG", "Vercel Inc. – Ramy ochrony danych UE–USA i standardowe klauzule umowne. Uwaga: w 2026 r. ramy są podważane (wyrok Sądu Najwyższego USA w sprawie Trump v. Slaughter dotyczący niezależności FTC, zapowiedziana skarga noyb). Na razie obowiązują; warto mieć SCC jako drugą podstawę i ograniczać dane przetwarzane przez Vercel do niezbędnych."],
    ["Środki bezpieczeństwa", "Rozdział 7"],
  ]),
  gap(),
);

// 4. Umowa powierzenia
const par = (n, title, items) => [h2(`§ ${n}. ${title}`), ...steps(items)];
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1("4. Wzór umowy powierzenia przetwarzania danych (art. 28 RODO)"),
  p("Zawierana razem z umową partnerską. Strony: **" + todo + " (zakład pogrzebowy)** – „Administrator”, oraz **Ostoja sp. z o.o.** – „Podmiot przetwarzający”."),
  ...par(1, "Przedmiot", [
    "Administrator powierza Podmiotowi przetwarzającemu przetwarzanie danych osobowych w zakresie i celu określonym w umowie, w związku z korzystaniem z panelu Ostoi (umowa partnerska z dnia " + todo + ").",
    "Charakter przetwarzania: przechowywanie, udostępnianie upoważnionym osobom Administratora, wysyłka SMS z linkiem do rodziny na polecenie Administratora, publikacja strony pamięci na polecenie Administratora.",
  ]),
  ...par(2, "Zakres danych i kategorie osób", [
    "Osoby: osoby zmarłe (w zakresie danych żyjących osób, których dotyczą), członkowie rodzin i osoby organizujące pogrzeb, pracownicy Administratora.",
    "Dane: imię i nazwisko, telefon, e-mail, daty urodzenia i zgonu, numer rachunku bankowego do wypłaty zasiłku, terminy i miejsca uroczystości, wybrane usługi i kwoty, zgody. Bez danych szczególnych kategorii; bez przyczyny zgonu; bez PESEL (chyba że strony uzgodnią inaczej aneksem).",
  ]),
  ...par(3, "Czas trwania", [
    "Przez okres obowiązywania umowy partnerskiej. Po jej zakończeniu Podmiot przetwarzający w ciągu 30 dni zwraca dane (eksport) i je usuwa, chyba że przepis wymaga dalszego przechowywania.",
  ]),
  ...par(4, "Obowiązki Podmiotu przetwarzającego", [
    "Przetwarza dane wyłącznie na udokumentowane polecenie Administratora; poleceniem jest w szczególności korzystanie z funkcji panelu.",
    "Zapewnia, by osoby upoważnione do przetwarzania zobowiązały się do zachowania tajemnicy.",
    "Stosuje środki z art. 32 RODO opisane w załączniku (rozdział 7 tego dokumentu).",
    "Pomaga Administratorowi w realizacji praw osób (dostęp, sprostowanie, usunięcie) i w obowiązkach z art. 32–36 RODO.",
    "Zgłasza Administratorowi naruszenie ochrony danych bez zbędnej zwłoki, nie później niż w ciągu 24 godzin od jego wykrycia.",
    "Udostępnia informacje potrzebne do wykazania zgodności i umożliwia audyty po uprzednim zawiadomieniu (14 dni).",
  ]),
  ...par(5, "Dalsze powierzenie", [
    "Administrator wyraża ogólną zgodę na dalsze powierzenie podmiotom wymienionym w załączniku (Supabase, Vercel, SMSAPI, dostawca poczty). O zmianach Podmiot przetwarzający informuje z 14-dniowym wyprzedzeniem; Administrator może zgłosić sprzeciw.",
    "Podmiot przetwarzający nakłada na dalszych przetwarzających te same obowiązki i odpowiada za ich działania jak za własne.",
  ]),
  ...par(6, "Postanowienia końcowe", [
    "Odpowiedzialność stron – zgodnie z art. 82 RODO; limit odpowiedzialności umownej " + todo + ".",
    "Zmiany wymagają formy dokumentowej. Sądem właściwym jest sąd właściwy dla siedziby Podmiotu przetwarzającego.",
  ]),
);

// 5. P2B
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1("5. Regulamin dla zakładów – punkty wymagane przez P2B"),
  p("Rozporządzenie (UE) 2019/1150 (P2B) dotyczy pośredników internetowych obsługujących przedsiębiorców. Ostoja jest takim pośrednikiem wobec zakładów, więc regulamin dla zakładów musi zawierać m.in.:"),
  table([3000, 6638], ["Wymóg", "Jak to robi Ostoja (do wpisania w regulamin)"], [
    ["Jasne warunki, dostępne przed rejestracją i w każdej chwili", "Regulamin na stronie i w panelu; akceptacja przy umowie partnerskiej."],
    ["Zmiany warunków: min. 15 dni wyprzedzenia", "Informacja e-mailem i w panelu; zakład może wypowiedzieć umowę przed wejściem zmian."],
    ["Główne parametry kolejności (rankingu)", "Domyślnie odległość od środka miasta; rodzina może sortować po cenie i ocenach. Brak płatnych wyróżnień. Zapytania rozsyłane do wybranego zakładu albo 3 najbliższych, w kolejnych rundach do kolejnych najbliższych."],
    ["Ograniczenie, zawieszenie, zakończenie", "Wdrożone: wstrzymanie wymaga podstawy (6 punktów z /regulamin-partnera) i opisu faktów; zakład widzi uzasadnienie w panelu w chwili wstrzymania (Status zakładu, z wydrukiem). Wypowiedzenie z 30-dniowym wyprzedzeniem – w zasadach dla partnerów."],
    ["Dostęp do danych", "Zakład widzi dane swoich zapytań i zleceń; numer rodziny dopiero po przyjęciu. Ostoja korzysta z danych zbiorczych (statystyki) – opisać w regulaminie."],
    ["Wewnętrzny system rozpatrywania skarg", "Wdrożone: odwołanie w panelu (właściciel lub biuro), odpowiedź z uzasadnieniem w 7 dni w panelu administratora (Odwołania), historia statusu i dziennik. Skargi spoza wstrzymań – opiekun partnerów " + todo + "."],
    ["Mediatorzy", "Miejsce w zasadach dla partnerów przygotowane; wskazać co najmniej dwóch mediatorów " + todo + "."],
    ["Opłaty", "250 zł netto za zlecenie z Ostoi z podpisaną umową; brak abonamentu " + todo + "."],
  ]),
  gap(),
  p("Dodatkowo (dyrektywa Omnibus, ustawa o przeciwdziałaniu nieuczciwym praktykom rynkowym): rodziny muszą wiedzieć, jak ustalana jest kolejność ofert i czy oceny są weryfikowane. Strona /regulamin to opisuje; sposób weryfikacji ocen trzeba uzupełnić przed ich publikacją (dziś w wersji testowej oceny są fikcyjne)."),
);

// 6. Polityka i regulamin dla rodzin
add(
  h1("6. Polityka prywatności i regulamin dla rodzin"),
  p("Pełne teksty są w aplikacji: **/prywatnosc** i **/regulamin** (oznaczone jako wersja robocza). Najważniejsze decyzje do potwierdzenia przez prawnika:"),
  bullet("Podstawa przekazania numeru zakładowi: zgoda (checkbox przy formularzu) i działania przed umową. Czy sama lit. b wystarcza i checkbox może zostać jako informacja?"),
  bullet("Okres przechowywania imienia i telefonu z zapytania: 90 dni (wdrożone)."),
  bullet("Brak banera cookie – tylko pliki niezbędne (sesja, zaproszenie, kod testowy)."),
  bullet("Informacja o przekazaniu do USA (Vercel) przy niepewnym statusie Ram ochrony danych UE–USA."),
  bullet("Treść SMS z kodem: bez nazwy zakładu i bez polskich znaków (jeden SMS)."),
);

// 7. Środki bezpieczeństwa
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1("7. Środki bezpieczeństwa (art. 32 RODO)"),
  table([2700, 6938], ["Obszar", "Co jest wdrożone"], [
    ["Dostęp do danych", "Zabezpieczenia na poziomie wierszy w bazie (RLS): każdy zakład widzi tylko swoje dane, sprawdzone testami. Telefon rodziny dostępny dopiero po przyjęciu zapytania. Role w zakładzie: właściciel, biuro, ekipa (ekipa bez zmian cennika i profilu)."],
    ["Publiczne API", "Funkcje zwracające kod SMS lub e-mail z zaproszenia wywołuje wyłącznie serwer aplikacji (rola service_role); test sprawdza, że rola anon ma dostęp tylko do 6 funkcji strony dla rodzin."],
    ["Logowanie", "Link jednorazowy z e-maila (bez haseł), ważny godzinę, potwierdzany kliknięciem (odporny na skanery poczty). Sesja w ciasteczku httpOnly, SameSite, podpisanym (HS256), 12 godzin. Konta testowe tylko dla adresów @….test."],
    ["Weryfikacja numeru", "Kod 6 cyfr, w bazie tylko skrót SHA-256, 5 prób, 3 wysyłki, ważność 10 minut, limit 3 formularzy na numer na godzinę."],
    ["Linki dla rodzin i zaproszenia", "Tokeny losowe (192 bity dla rodzin, 256 bitów dla zaproszeń; zaproszenia przechowywane jako skrót), wygasają (60 i 7 dni), Referrer-Policy: no-referrer na stronie rodziny."],
    ["Limity prób", "W bazie, wspólne dla wszystkich instancji; zamiast adresu IP skrót."],
    ["Administratorzy", "Osobna tabela uprawnień; każda zmiana i każdy odczyt telefonów rodzin w dzienniku (2 lata)."],
    ["Szyfrowanie", "HTTPS z HSTS; baza Supabase szyfrowana na dysku; klucze tylko w zmiennych środowiskowych serwera."],
    ["Nagłówki", "CSP z jednorazowym nonce dla skryptów (strict-dynamic, bez inline), frame-ancestors none, form-action i base-uri self; X-Frame-Options DENY, nosniff, Permissions-Policy, noindex na wersji testowej."],
    ["Retencja", "Codzienne zadanie purge_old_data: imię i telefon z zapytań po 90 dniach, szkice po dobie, błędy aplikacji po 30 dniach, dziennik po 2 latach."],
    ["Testy", "Testy bazy (12 plików), testy logiki i testy przeglądarkowe uruchamiane przy każdej zmianie (GitHub Actions)."],
    ["Logi i monitoring", "Bez PESEL, telefonów i nazwisk. Błędy aplikacji zapisywane w bazie zgrupowane po trasie; numery, e-maile, identyfikatory i tokeny zamieniane na znaczniki (w aplikacji i drugi raz w bazie); podgląd w panelu administratora (Błędy)."],
  ]),
  gap(),
);

// 8. Przegląd
add(
  h1("8. Przegląd bezpieczeństwa z 16 października 2026"),
  h2("Naprawione"),
  table([3600, 6038], ["Problem", "Naprawa"], [
    ["Funkcje wydające kod SMS i e-mail z zaproszenia były dostępne dla roli anon – przez publiczne API Supabase dało się pobrać kod SMS bez telefonu", "Dostęp tylko dla serwera (service_role); test 09_hardening"],
    ["Zapytanie dało się utworzyć z pominięciem kodu SMS (create_inquiry dla anon)", "create_inquiry tylko przez confirm_inquiry po poprawnym kodzie"],
    ["Funkcje bez jawnych uprawnień wykonywalne dla wszystkich (wycena niezweryfikowanego zakładu)", "Uprawnienia odebrane; test pilnuje, by żadna funkcja security definer nie była dostępna dla PUBLIC"],
    ["Ekipa mogła zapisać zmiany w cenniku mimo zablokowanego formularza", "Polityki RLS dla ról + sprawdzenie w akcjach; test 05_roles"],
    ["Limit prób w pamięci serwera (nieskuteczny przy wielu instancjach Vercel)", "Limit w bazie"],
    ["Komunikaty z adresu URL mogły pokazać rodzinie dowolny tekst", "W adresie tylko kody komunikatów"],
    ["Logowanie kontem testowym możliwe dla każdego konta na wersji testowej", "Tylko adresy @….test"],
    ["Brak retencji danych", "purge_old_data + harmonogram"],
  ]),
  gap(),
  h2("Zrobione 16 października (po przeglądzie)"),
  bullet("Pełna polityka CSP dla skryptów z nonce (src/middleware.ts); test sprawdza, że wstrzyknięty atrybut zdarzenia się nie wykona."),
  bullet("Monitoring błędów bez danych osobowych (app_errors, panel Błędy); retencja 30 dni."),
  bullet("Uzasadnienie przy wstrzymaniu zakładu, odwołania i historia statusu (P2B art. 4 i 11); zasady dla partnerów na /regulamin-partnera."),
  bullet("Narzędzie do wniosków osób w panelu administratora (wyszukanie po numerze, kopia danych JSON, usunięcie danych z zapytań) i procedury w rozdziale 10."),
  h2("Do zrobienia"),
  bullet("Kopie zapasowe: plan Supabase Pro (codzienne kopie, 7 dni); rozważyć PITR przed startem."),
  bullet("Alerty o nowych błędach (e-mail do opiekuna) – dziś tylko podgląd w panelu."),
  bullet("Powiadomienie zakładu o wstrzymaniu także e-mailem (trwały nośnik) – dziś w panelu z możliwością wydruku."),
  bullet("Test penetracyjny przed startem produkcyjnym " + todo + "."),
);

// 9. Checklist
add(
  h1("9. Lista kontrolna przed prawdziwymi danymi"),
  table([600, 6038, 1500, 1500], ["", "Zadanie", "Kto", "Stan"], [
    ["1", "Przegląd tego dokumentu i tekstów /prywatnosc, /regulamin przez prawnika", "prawnik", "do zrobienia"],
    ["2", "Umowy powierzenia (DPA) z Supabase, Vercel, SMSAPI, dostawcą poczty – akceptacja w panelach usług", "założyciel", "do zrobienia"],
    ["3", "Regulamin dla zakładów (P2B) i umowa partnerska z umową powierzenia (rozdział 4)", "prawnik", "do zrobienia"],
    ["4", "Rejestr czynności (rozdział 2) uzupełniony o dane spółki i podpisany", "założyciel", "do zrobienia"],
    ["5", "Ocena, czy potrzebna jest ocena skutków (DPIA) – rekomendacja: krótka notatka z uzasadnieniem", "prawnik", "do zrobienia"],
    ["6", "Projekt produkcyjny Supabase (Frankfurt, plan Pro) i Vercel Pro (fra1); DEMO_MODE=false; ALLOW_INDEXING=true", "założyciel + Claude", "do zrobienia"],
    ["7", "SMSAPI: konto firmowe, zarejestrowane pole nadawcy, SMSAPI_TEST=false", "założyciel", "do zrobienia"],
    ["8", "Harmonogram powiadomień i retencji uruchomiony (scripts/supabase/harmonogram-powiadomien.sql)", "Claude", "zrobione (wersja testowa)"],
    ["9", "Procedura naruszeń i realizacji praw osób (rozdział 10) zatwierdzona, wskazana osoba odpowiedzialna i rejestr naruszeń", "założyciel + prawnik", "spisana, do zatwierdzenia"],
    ["10", "Szkolenie opiekunów: dane rodzin tylko w panelu, notatki bez danych wrażliwych", "założyciel", "do zrobienia"],
  ]),
);

// 10. Procedury
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1("10. Procedury: naruszenia ochrony danych i wnioski osób"),
  h2("10.1. Naruszenie ochrony danych (art. 33 i 34 RODO)"),
  p("Naruszenie to każde zdarzenie, w którym dane mogły zostać ujawnione, zmienione albo utracone – np. wyciek klucza, błąd uprawnień, zgubiony telefon z zalogowanym panelem, SMS wysłany na zły numer."),
  ...steps([
    "**Zgłoszenie (od razu).** Każdy, kto zauważy zdarzenie (opiekun, zakład, dostawca), zgłasza je osobie odpowiedzialnej za dane " + todo + " telefonicznie i e-mailem. Godzinę zgłoszenia zapisujemy – od niej liczy się 72 godziny.",
    "**Ograniczenie skutków (do 4 godzin).** Wylogowanie sesji (zmiana SESSION_SECRET), obrót kluczy (Supabase, SMSAPI, VAPID), wstrzymanie zakładu albo odebranie dostępu osobie, poprawka uprawnień nową migracją. Dziennik admin_audit i logi Vercel zachowujemy.",
    "**Ocena ryzyka (do 24 godzin).** Jakie dane, ilu osób, czy były zaszyfrowane, czy ktoś je odczytał. Dane rodzin w żałobie (telefon, dane osoby zmarłej) traktujemy jako dane o podwyższonym ryzyku.",
    "**Zakłady (do 24 godzin).** Gdy naruszenie dotyczy danych zleceń, Ostoja jako podmiot przetwarzający zawiadamia zakład (administratora) – zgodnie z umową powierzenia (rozdział 4).",
    "**UODO (do 72 godzin).** Gdy naruszenie może powodować ryzyko dla osób, zgłoszenie przez formularz na stronie UODO. Gdy nie wszystko wiadomo – zgłoszenie wstępne i uzupełnienie.",
    "**Osoby (bez zbędnej zwłoki).** Gdy ryzyko jest wysokie – SMS lub telefon do osób: co się stało, jakie dane, co zrobiliśmy, co mogą zrobić, kontakt do opiekuna.",
    "**Rejestr naruszeń.** Każde zdarzenie – także niezgłoszone do UODO – wpisujemy do rejestru: data, opis, skutki, decyzja o zgłoszeniu z uzasadnieniem, działania naprawcze " + todo + " (arkusz lub dokument).",
  ]),
  h2("10.2. Wnioski osób (art. 15–22 RODO)"),
  p("Rodziny nie mają kont, więc wniosek przychodzi telefonem, e-mailem albo pismem. Jedyny identyfikator to numer telefonu z zapytania."),
  ...steps([
    "**Przyjęcie.** Opiekun zapisuje datę wniosku (termin odpowiedzi: miesiąc, z możliwością przedłużenia o dwa miesiące z uzasadnieniem).",
    "**Tożsamość.** Oddzwaniamy na numer, którego dotyczy wniosek. Bez tego nie wydajemy ani nie usuwamy danych.",
    "**Wyszukanie.** Panel administratora → Wnioski RODO → numer telefonu. Narzędzie pokazuje zapytania i szkice w Ostoi oraz zakłady, u których jest zlecenie. Numer nie trafia do adresu strony ani do dziennika (tylko końcówka).",
    "**Dostęp i kopia (art. 15).** Przycisk „Przygotuj kopię danych” – plik JSON z zapytaniami i listą zakładów, które dostały zapytanie. Wysyłamy go osobie e-mailem albo odczytujemy przez telefon.",
    "**Usunięcie (art. 17) i sprzeciw (art. 21).** Przycisk „Usuń dane z zapytań” usuwa imię i numer z zapytań Ostoi i szkice. Zlecenia zostają – ich administratorem jest zakład, który może mieć obowiązek przechowywania (umowa, rachunki).",
    "**Dane zleceń.** Wniosek dotyczący zlecenia przekazujemy zakładowi w ciągu 2 dni (dane kontaktowe zakładu są w kopii danych) i informujemy o tym osobę. Pomagamy zakładowi technicznie, jeśli o to poprosi (umowa powierzenia, § 4).",
    "**Sprostowanie (art. 16).** Imię i numer w zapytaniu poprawia opiekun na prośbę osoby; dane zlecenia – zakład w panelu.",
    "**Odpowiedź i ślad.** Odpowiadamy na piśmie (e-mail). W dzienniku administratora zostają wpisy „wniosek RODO – wyszukanie / eksport / usunięcie”.",
  ]),
);

const doc = new Document({
  creator: "Ostoja",
  title: "Ostoja – dane osobowe i bezpieczeństwo (szkic)",
  styles: {
    default: { document: { run: { font: SANS, size: 21, color: C.ink } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: SERIF, size: 34, color: C.ink }, paragraph: { spacing: { before: 360, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: SANS, size: 23, bold: true, color: C.brand }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: numberingConfigs },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
        t("Ostoja · dane osobowe i bezpieczeństwo · szkic do przeglądu · strona ", { size: 16, color: C.muted }),
        new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 16, color: C.muted }),
        t(" z ", { size: 16, color: C.muted }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: SANS, size: 16, color: C.muted }),
      ] })] }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(DIR, "Ostoja-RODO-i-bezpieczenstwo-szkic.docx"), buf);
  console.log("ok");
});
