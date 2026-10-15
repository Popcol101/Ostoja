// Poradnik wersji testowej Ostoi (.docx). Uruchom: node build_docx.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, ImageRun, Footer, PageNumber, LevelFormat, TableLayoutType,
  PageBreak, ExternalHyperlink,
} = require("docx");

const DIR = __dirname;
const scen = JSON.parse(fs.readFileSync(path.join(DIR, "scenariusze.json"), "utf8"));

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

const URL_MAZUR = "/r/demo-rodzina-mazur-0000000000000000000000000000";
const URL_NOWAK = "/r/demo-rodzina-nowak-0000000000000000000000000000";

const body = [];
const add = (...x) => body.push(...x.flat());

// Okładka
add(
  new Paragraph({ children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(DIR, "logo.png")), transformation: { width: 168, height: 50 } })], spacing: { after: 360 } }),
  new Paragraph({ children: [new TextRun({ text: "Poradnik wersji testowej", font: SERIF, size: 52, color: C.ink })], spacing: { after: 120 } }),
  p("Jak postawić wersję testową, zalogować się, przejść scenariusze z zakładem i zgłosić uwagi. Stan na 16 października 2026.", { run: { color: C.muted, size: 23 } }),
  p("Wersja testowa to ta sama aplikacja co docelowa, ale na osobnej bazie z fikcyjnymi danymi. Służy do pokazywania Ostoi zakładom, sprawdzania nowych funkcji i zbierania uwag przed wejściem z prawdziwymi danymi. Do poradnika należy arkusz **Ostoja-scenariusze-testow.xlsx**: lista kontrolna scenariuszy, rejestr błędów i notatki ze spotkań."),
  gap(80),
  box("Przed spotkaniem z zakładem (10 minut)", steps([
    "GitHub, Actions, **Testy**: ostatnie uruchomienie ma zielony znacznik.",
    "GitHub, Actions, **Wersja testowa – baza danych**, Run workflow, opcja **migracje i przywrócenie danych testowych**. Kalendarz pokaże bieżący tydzień, skrzynka nowe zapytanie.",
    "Na swoim telefonie przejdź jako rodzina scenariusz R1 i R4, a jako zakład Z1, Z2 i Z6 (rozdział 5).",
    "Otwórz arkusz, zakładkę **Spotkania**, i wpisz nazwę zakładu i datę. Odpowiedzi zapisuj w trakcie rozmowy.",
  ])),
  gap(200),
);

// 1. Zasady
add(
  h1("1. Najważniejsze zasady"),
  bullet("**Tylko dane fikcyjne.** Żadnych prawdziwych imion i nazwisk zmarłych, numerów PESEL ani telefonów rodzin. Prawdziwe dane dopiero po przeglądzie bezpieczeństwa i RODO."),
  bullet("**Nie wpisujemy przyczyny zgonu**, także w notatkach zakładu."),
  bullet("**Linki dla rodzin** (adresy /r/…) nie trafiają w miejsca publiczne: grupy, maile do wielu osób, prezentacje."),
  bullet("**Klucze i hasła** są tylko w ustawieniach Vercel, Supabase i GitHub. Nigdy w tym dokumencie, w czacie ani w mailu."),
  bullet("Wersja testowa nie pojawia się w Google: aplikacja blokuje indeksowanie, gdy działa w trybie testowym."),
);

// 2. Adresy
add(
  h1("2. Adresy"),
  p("Po pierwszym wdrożeniu wpisz w miejsce [adres] adres z Vercel, np. ostoja-test.vercel.app."),
  table([2600, 4738, 2300], ["Co", "Adres", "Dla kogo"], [
    ["Strona dla rodzin", "[adres]/", "rodzina"],
    ["Sprawdź ceny (kreator)", "[adres]/zapytanie", "rodzina"],
    ["Link rodziny przed umową", `[adres]${URL_MAZUR}`, "rodzina"],
    ["Link rodziny po umowie", `[adres]${URL_NOWAK}`, "rodzina"],
    ["Strona pamięci", "[adres]/pamiec/halina-nowak", "rodzina, goście"],
    ["Panel zakładu", "[adres]/logowanie", "zakład"],
    ["Panel administratora", "[adres]/admin", "opiekunowie Ostoi"],
    ["Polityka prywatności, regulamin", "[adres]/prywatnosc, [adres]/regulamin", "wszyscy"],
    ["System wizualny", "[adres]/styleguide", "zespół Ostoi"],
  ]),
  gap(),
);

// 3. Postawienie
add(
  h1("3. Postawienie wersji testowej"),
  p("Jednorazowo, około godziny. Potrzebne są konta w GitHub (repozytorium **Popcol101/Ostoja** już jest), Supabase i Vercel. Na testy wewnętrzne wystarczą plany bezpłatne. Na pilot z prawdziwymi zakładami potrzebne są Supabase Pro i Vercel Pro, bo plan Vercel Hobby nie pozwala na użytek komercyjny (koszty: arkusz Ostoja-kosztorys.xlsx)."),
  h2("3.1. Baza danych w Supabase"),
  steps([
    "Na supabase.com utwórz projekt **ostoja-test** w regionie **Frankfurt (eu-central-1)**. Hasło bazy zapisz w menedżerze haseł.",
    "Kliknij **Connect** i skopiuj adres połączenia **Session pooler** (zaczyna się od postgresql://postgres.). Wstaw w nim hasło bazy. To jest wartość **DATABASE_URL** i jednocześnie **STAGING_DATABASE_URL**.",
    "Authentication, Sign In / Providers: wyłącz **Allow new users to sign up**. Konta pracowników zakładów zakłada tylko Ostoja.",
    "Authentication, URL Configuration: **Site URL** ustaw na adres wersji testowej (uzupełnisz po kroku 3.3).",
    "Authentication, Emails, szablon **Magic Link**: temat „Zaloguj się do Ostoi”, a link w treści zamień na `{{ .SiteURL }}/logowanie/potwierdz?token_hash={{ .TokenHash }}&type=email`.",
    "Project Settings, API: skopiuj **Project URL** (to SUPABASE_URL) i klucz **anon / publishable** (to SUPABASE_ANON_KEY).",
  ]),
  p("Wbudowana poczta Supabase wysyła tylko kilka e-maili na godzinę. Na testy wewnętrzne to wystarczy. Na pilot podłącz własny serwer poczty (np. Resend; plan bezpłatny to 3000 e-maili miesięcznie) w Project Settings, Authentication, SMTP."),
  h2("3.2. Tabele i dane testowe (GitHub)"),
  steps([
    "W repozytorium: Settings, Environments, **New environment** o nazwie `wersja-testowa`.",
    "W tym środowisku dodaj sekret **STAGING_DATABASE_URL** z adresem z kroku 3.1.2.",
    "Actions, **Wersja testowa – baza danych**, Run workflow, opcja **migracje i przywrócenie danych testowych**.",
    "Po 1–2 minutach zadanie ma zielony znacznik. Czerwony znacznik oznacza błąd: otwórz zadanie i prześlij Claude ostatnie linie logu.",
  ]),
  h2("3.3. Aplikacja w Vercel"),
  steps([
    "Na vercel.com: Add New, Project, zaimportuj repozytorium **Popcol101/Ostoja**. Framework Next.js rozpozna się sam; region Frankfurt jest ustawiony w repozytorium.",
    "Przed pierwszym wdrożeniem dodaj zmienne środowiskowe z tabeli poniżej i kliknij **Deploy**.",
    "Skopiuj adres wdrożenia i wpisz go w **APP_URL** (Vercel) oraz w **Site URL** (Supabase, krok 3.1.4). Potem Deployments, **Redeploy**.",
  ]),
  table([3900, 5738], ["Zmienna", "Wartość na wersji testowej"], [
    ["DATABASE_URL", "adres Session pooler z kroku 3.1.2"],
    ["SESSION_SECRET", "losowy ciąg, min. 32 znaki (poproś Claude o wygenerowanie i wklej od razu do Vercel)"],
    ["APP_URL", "adres wersji testowej, bez ukośnika na końcu"],
    ["DEMO_MODE", "true (lista kont testowych na stronie logowania)"],
    ["SUPABASE_URL, SUPABASE_ANON_KEY", "z kroku 3.1.6"],
    ["SUPABASE_SERVICE_ROLE_KEY", "Project Settings, API, klucz service_role – tylko w Vercel, nigdy w zmiennych NEXT_PUBLIC_; potrzebny do zakładania kont zaproszonych osób"],
    ["NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY", "para kluczy do powiadomień push (poproś Claude o wygenerowanie)"],
    ["VAPID_SUBJECT", "mailto: i adres opiekuna Ostoi"],
    ["CRON_SECRET", "losowy ciąg, min. 16 znaków"],
    ["SMSAPI_TEST", "true: SMS-y nie wychodzą i nic nie kosztują"],
    ["SMSAPI_TOKEN, SMSAPI_SENDER", "puste na testach; uzupełnij, gdy chcesz sprawdzić prawdziwy SMS (scenariusz P3)"],
    ["NEXT_PUBLIC_OPIEKUN_PHONE", "numer opiekuna, np. +48 000 000 000"],
  ]),
  gap(),
  h2("3.4. Harmonogram powiadomień"),
  p("Powiadomienia wysyłają się od razu po akcji. Harmonogram co minutę dosyła te, które czekają, np. gdy zapytanie po 15 minutach przechodzi do kolejnego zakładu."),
  steps([
    "Supabase, Database, Extensions: włącz **pg_cron** i **pg_net**.",
    "SQL Editor: wklej plik `scripts/supabase/harmonogram-powiadomien.sql` z repozytorium, podmień ADRES_APLIKACJI i SEKRET (ten sam co CRON_SECRET) i uruchom raz.",
  ]),
  h2("3.5. Sprawdzenie"),
  steps([
    "Adres wersji testowej pokazuje stronę „Pomożemy zorganizować pogrzeb”.",
    "/logowanie pokazuje listę pięciu kont testowych.",
    "Po zalogowaniu jako Anna Cichońska w Zapytaniach jest nowe zapytanie z licznikiem 15 minut.",
  ]),
);

// 4. Konta
add(
  h1("4. Konta testowe i logowanie"),
  table([2300, 2500, 3338, 1500], ["Osoba", "E-mail", "Zakład", "Rola"], [
    ["Anna Cichońska", "anna@cisza.test", "Dom Pogrzebowy Cisza (Łódź)", "właściciel"],
    ["Ewa Rogalska", "ewa@cisza.test", "Dom Pogrzebowy Cisza", "biuro"],
    ["Adam Sowiński", "adam@cisza.test", "Dom Pogrzebowy Cisza", "ekipa"],
    ["Piotr Lipski", "piotr@podlipami.test", "Usługi Pogrzebowe Pod Lipami", "właściciel"],
    ["Katarzyna Kalinowska", "kasia@kalina.test", "Zakład Pogrzebowy Kalina", "właściciel"],
    ["Ola Maj", "ola@ostoja.test", "Ostoja (panel /admin)", "administrator"],
  ]),
  gap(),
  p("**Role.** Właściciel i biuro mogą wszystko w swoim zakładzie. Ekipa widzi zapytania, zlecenia i kalendarz, ale nie zmienia profilu zakładu ani cennika. Nikt nie widzi danych innego zakładu."),
  p("**Konto testowe:** na stronie /logowanie kliknij osobę. Działa tylko przy DEMO_MODE=true i tylko dla adresów kończących się na .test – prawdziwe konta logują się zawsze linkiem z e-maila."),
  p("**Nowy zakład** dodaje administrator Ostoi w panelu /admin: Dodaj partnera, a na karcie zakładu Zaproś do panelu (rola Właściciel). Zakład pojawia się rodzinom dopiero po weryfikacji i z pełnym cennikiem."),
  p("**Pracowników zakładu** zaprasza właściciel w panelu: Zespół, Utwórz zaproszenie. Link wysyła SMS-em albo e-mailem; działa 7 dni i raz. Osoba otwiera link, klika **Przyjmij zaproszenie**, a potem loguje się linkiem z e-maila: wpisuje e-mail na /logowanie, klika **Wyślij link**, w mailu **Zaloguj się do Ostoi** i na stronie **Zaloguj się**. Link logowania działa godzinę i tylko raz."),
  p("Zakładanie kont przy przyjęciu zaproszenia wymaga zmiennej SUPABASE_SERVICE_ROLE_KEY (krok 3.3). Bez Supabase (lokalnie) konto zakłada się samo i osoba od razu trafia do panelu."),
);

// 5. Scenariusze
const OBSZARY = [
  ["Rodzina", "5.1. Rodzina (najlepiej na telefonie, bez logowania)"],
  ["Zakład", "5.2. Zakład pogrzebowy"],
  ["Administracja", "5.3. Administracja Ostoi (konto Ola Maj)"],
  ["Logowanie", "5.4. Logowanie"],
  ["Powiadomienia", "5.5. Powiadomienia"],
  ["Prywatność", "5.6. Prywatność"],
];
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1("5. Scenariusze testów"),
  p("Te same scenariusze są w arkuszu **Ostoja-scenariusze-testow.xlsx**, zakładka **Scenariusze**: przy każdym wybierz wynik (OK, Błąd, Nie sprawdzono), datę i tester. Błąd opisz w zakładce **Błędy** i wpisz jego numer w uwagach scenariusza."),
  p("Scenariusze zakładu zakładają, że rodzina wysłała wcześniej zapytanie (R4). Przed testami przywróć dane (rozdział 7)."),
);
for (const [key, title] of OBSZARY) {
  add(
    h2(title),
    table([620, 1900, 3600, 3518], ["Nr", "Scenariusz", "Co zrobić", "Oczekiwany wynik"],
      scen.filter((s) => s.obszar === key).map((s) => [s.id, `**${s.nazwa}**${s.konto && s.konto !== "bez logowania" ? ` (konto: ${s.konto})` : ""}`, s.kroki, s.oczekiwane])),
    gap(),
  );
}

// 6. Powiadomienia
add(
  h1("6. Powiadomienia push i SMS"),
  p("**Push o nowym zapytaniu** działa w Chrome, Edge i Firefox na Androidzie i komputerze. Na iPhonie (iOS 16.4 lub nowszy) trzeba najpierw dodać panel do ekranu początkowego: w Safari Udostępnij, **Do ekranu początkowego**, a potem otworzyć panel z ikony Ostoi. Powiadomienie zawiera tylko rodzaj pogrzebu i miasto, nigdy dane rodziny."),
  p("Powiadomienia włącza się osobno na każdym urządzeniu: Zapytania, **Włącz powiadomienia**. Wyłączyć można tym samym przyciskiem albo w ustawieniach przeglądarki."),
  p("**Kod SMS dla rodziny:** zapytanie trafia do zakładów dopiero po wpisaniu kodu wysłanego na numer z formularza. Na wersji testowej bez klucza SMSAPI kod pokazuje się na ekranie (żółta ramka „Wersja testowa”). Limity: 5 prób, 3 kody na formularz, 3 formularze na numer w godzinie."),
  p("**SMS z linkiem dla rodziny:** przy SMSAPI_TEST=true SMS-y nie wychodzą i nic nie kosztują, a w karcie zlecenia widać status „nie wysłano”. Żeby sprawdzić prawdziwą wysyłkę, załóż konto w SMSAPI, wygeneruj token, ustaw SMSAPI_TOKEN i SMSAPI_TEST=false, a w zleceniu testowym wpisz własny numer. Pole nadawcy (np. nazwę zakładu) trzeba zgłosić w panelu SMSAPI i poczekać na jego akceptację."),
);

// 7. Dane i wersje
add(
  h1("7. Przywracanie danych i nowe wersje"),
  bullet("**Przywrócenie danych testowych** (przed każdym spotkaniem): GitHub, Actions, Wersja testowa – baza danych, Run workflow, opcja migracje i przywrócenie danych testowych. Daty przesuwają się względem dnia przywrócenia, więc kalendarz zawsze pokazuje bieżący tydzień. Konta logowania zostają."),
  bullet("**Nowa wersja aplikacji:** każda zmiana w gałęzi main wdraża się w Vercel sama w ciągu 2–3 minut."),
  bullet("**Zmiana w bazie** (nowa migracja): po wdrożeniu uruchom ten sam workflow z opcją migracje."),
  bullet("**Testy automatyczne** uruchamiają się przy każdej zmianie (Actions, Testy). Zielony znacznik przed spotkaniem to warunek pokazu."),
);

// 8. Zgłaszanie
add(
  h1("8. Zgłaszanie błędów i uwag"),
  p("Każdy błąd wpisz w arkuszu, zakładka **Błędy** (albo w GitHubie: Issues, New issue). Dobre zgłoszenie zawiera:"),
  bullet("adres strony, konto i kolejne kliknięcia;"),
  bullet("czego się spodziewałeś i co się stało;"),
  bullet("zrzut ekranu, urządzenie, przeglądarkę i godzinę;"),
  bullet("wagę: **blokuje** (nie da się dokończyć zadania), **przeszkadza** (da się, ale z trudem) albo **drobiazg**."),
  p("Po spotkaniu z zakładem zapisz w zakładce **Spotkania** odpowiedzi na pięć pytań:"),
  ...steps([
    "Co w panelu zajęło najwięcej czasu albo było niejasne?",
    "Czy 15 minut na odpowiedź jest realne o każdej porze, także w nocy?",
    "Czego brakuje w karcie zlecenia, żeby nie wracać do zeszytu?",
    "Czy cennik i sposób porównania cen są uczciwe wobec zakładu?",
    "Czy zapłaciłby 250 zł za zlecenie z podpisaną umową? Jeśli nie, ile i za co?",
  ]),
);

// 9. Problemy
add(
  h1("9. Gdy coś nie działa"),
  table([3400, 6238], ["Objaw", "Co sprawdzić"], [
    ["Na /logowanie nie ma listy kont", "Zmienna DEMO_MODE musi mieć wartość true; po zmianie zrób Redeploy w Vercel."],
    ["Link logowania nie przychodzi", "Folder spam; limit wbudowanej poczty Supabase (kilka e-maili na godzinę); czy konto istnieje w Authentication, Users i ma przypisany zakład."],
    ["Link logowania prowadzi na złą stronę", "Site URL w Supabase i szablon Magic Link (krok 3.1.5) muszą wskazywać adres wersji testowej."],
    ["Nie przychodzą powiadomienia push", "Zgoda przeglądarki na powiadomienia; na iPhonie panel otwarty z ikony na ekranie początkowym; klucze VAPID w Vercel; harmonogram z kroku 3.4."],
    ["Zapytanie zniknęło ze skrzynki", "To zamierzone: po 15 minutach bez odpowiedzi zapytanie przechodzi do kolejnego zakładu i jest widoczne w „Wcześniejszych zapytaniach”."],
    ["Kalendarz pokazuje stary tydzień albo pustą skrzynkę", "Przywróć dane testowe (rozdział 7)."],
    ["Workflow ma czerwony znacznik", "Sekret STAGING_DATABASE_URL w środowisku wersja-testowa; hasło w adresie; w razie wątpliwości prześlij Claude ostatnie linie logu."],
    ["Strona pokazuje „Nie udało się wczytać strony”", "Połączenie z internetem; Vercel, Deployments (czy ostatnie wdrożenie się udało); Supabase (czy projekt nie jest wstrzymany po tygodniu bezczynności na planie bezpłatnym)."],
  ]),
  gap(),
);

// 10. Techniczne
add(
  h1("10. Dla osoby technicznej"),
  p("Instrukcja uruchomienia na komputerze jest w pliku README.md w repozytorium. W skrócie: PostgreSQL 16 na porcie 54322, `npm install`, skopiowanie .env.example do .env.local, `./scripts/db-reset.sh` i `npm run dev`. Testy: `npm test`, `npm run test:db`, `npm run build` i `npm run e2e`. Stan prac i następne kroki: docs/STAN.md."),
);

const doc = new Document({
  creator: "Ostoja",
  title: "Ostoja – poradnik wersji testowej",
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
        t("Ostoja · poradnik wersji testowej · strona ", { size: 16, color: C.muted }),
        new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 16, color: C.muted }),
        t(" z ", { size: 16, color: C.muted }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: SANS, size: 16, color: C.muted }),
      ] })] }),
    },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(DIR, "Ostoja-poradnik-wersji-testowej.docx"), buf);
  console.log("ok");
});
