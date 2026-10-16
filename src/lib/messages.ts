// Komunikaty po akcjach. W adresie przekazujemy tylko krótki kod (?ok=umowa-podpisana), nigdy sam tekst:
// 1) nikt nie podrzuci rodzinie fałszywego komunikatu linkiem (np. „zadzwoń pod numer…”),
// 2) adres zostaje w ASCII – router Next.js gubił nawigację po adresach z zakodowanymi polskimi znakami.

export const MESSAGES = {
  // Sukces
  "zapytanie-przyjete": "Zapytanie przyjęte. Zadzwoń teraz do rodziny.",
  "zapytanie-przekazane": "Zapytanie trafi do innego zakładu.",
  "dane-zapisane": "Zapisano dane.",
  "umowa-podpisana": "Umowa oznaczona jako podpisana.",
  "pamiec-opublikowana": "Strona pamięci jest opublikowana.",
  "pamiec-zapisana": "Zapisano stronę pamięci.",
  "termin-dodany": "Dodano termin.",
  "profil-zapisany": "Zapisano profil.",
  "cennik-zapisany": "Zapisano cennik.",
  "rodzina-zapisano": "Dziękujemy. Zakład widzi już te informacje.",
  "link-wyslany": "Jeśli ten adres jest przypisany do zakładu, wysłaliśmy na niego link. Sprawdź skrzynkę – link działa godzinę.",
  "sms-zlecony": "SMS z linkiem jest w drodze do rodziny.",
  "powiadomienia-wlaczone": "Powiadomienia są włączone na tym urządzeniu.",
  // Błędy formularzy
  "sprawdz-dane": "Sprawdź wpisane dane.",
  "sprawdz-daty": "Sprawdź daty i długość pól.",
  "sprawdz-termin": "Sprawdź dane terminu.",
  "sprawdz-profil": "Sprawdź dane profilu.",
  "brak-uprawnien": "Profil i cennik zmienia właściciel albo biuro.",
  "potwierdz-umowe": "Zaznacz potwierdzenie podpisania umowy.",
  "ceny-zakres": "Ceny muszą być liczbami od 0 do 100 000 zł.",
  "podaj-date": "Podaj datę",
  "podaj-godzine": "Podaj godzinę",
  "podaj-imie": "Podaj imię i nazwisko",
  "podaj-telefon": "Podaj numer telefonu, np. 600 100 200",
  "zly-telefon": "Podaj poprawny numer telefonu",
  "zly-email": "Podaj poprawny e-mail",
  "zle-konto": "Numer konta ma 26 cyfr",
  "brak-zgody": "Potrzebujemy zgody, żeby przekazać Twój numer zakładowi",
  "limit-zapytan": "Wysłano już kilka zapytań. Zadzwoń do opiekuna – pomożemy od razu.",
  "limit-prob": "Zbyt wiele prób. Spróbuj za chwilę.",
  // Błędy z bazy (RAISE w supabase/migrations)
  "zasob-zajety": "Ten zasób jest już zarezerwowany w tym czasie.",
  "nieznane-miasto": "Nieznane miasto",
  "brak-dostepu": "Brak dostępu do zapytania",
  "zapytanie-nieaktywne": "Zapytanie nie jest już aktywne",
  "zapytanie-zajete": "Zapytanie przyjął już inny zakład",
  "umowa-juz-podpisana": "Umowa jest już podpisana",
  "aneks": "Po podpisaniu umowy zakres usług zmienia się aneksem",
  "link-wygasl": "Link wygasł lub jest nieprawidłowy",
  "zasob-odwolany": "Nie można zarezerwować zasobu dla odwołanego wydarzenia",
  "link-logowania-wygasl": "Link wygasł albo został już użyty. Poproś o nowy.",
  "limit-linkow": "Link można wysłać raz na minutę. Spróbuj za chwilę.",
  "brak-zakladu": "To konto nie jest przypisane do żadnego zakładu. Zadzwoń do opiekuna partnerów Ostoi.",
  "demo-wylaczone": "Logowanie kontami testowymi jest wyłączone.",
  "brak-telefonu": "Brak numeru telefonu rodziny w zleceniu",
  "limit-sms": "Do rodziny poszły już 3 SMS-y w ciągu doby. Zadzwoń zamiast pisać.",
  // Zespół
  "zaproszenie-utworzone": "Zaproszenie gotowe. Wyślij link tej osobie – działa 7 dni.",
  "zaproszenie-odwolane": "Zaproszenie odwołane. Link przestał działać.",
  "dostep-odebrany": "Dostęp odebrany.",
  "zaproszenie-przyjete-link": "Zaproszenie przyjęte. Wysłaliśmy link logowania na Twój e-mail – działa godzinę.",
  "witaj": "Witaj w panelu Ostoi.",
  "konto-blad": "Nie udało się przygotować konta. Zadzwoń do opiekuna partnerów Ostoi.",
  "tylko-wlasciciel": "Zapraszać może tylko właściciel zakładu",
  "juz-w-zespole": "Ta osoba ma już dostęp do panelu",
  "zaproszenie-nieaktywne": "Zaproszenie wygasło albo zostało już użyte",
  "konto-niepasuje": "Konto nie pasuje do zaproszenia",
  "brak-zaproszenia": "Nie znaleziono zaproszenia",
  "nie-siebie": "Nie możesz usunąć własnego dostępu",
  "brak-osoby": "Nie znaleziono osoby w Twoim zakładzie",
  // Administracja
  "brak-uprawnien-admina": "Ten panel jest tylko dla administratorów Ostoi.",
  "tylko-admin": "Tylko dla administratorów Ostoi",
  "partner-dodany": "Zakład dodany. Uzupełnij zaproszenie dla właściciela, a po sprawdzeniu dokumentów zweryfikuj zakład.",
  "zaklad-zweryfikowany": "Zakład zweryfikowany. Rodziny widzą go na liście ofert.",
  "zaklad-wstrzymany": "Zakład wstrzymany. Rodziny go nie widzą i nie dostaje zapytań.",
  "zapytanie-obsluzone": "Zapytanie oznaczone jako obsłużone.",
  "zapytanie-juz-obsluzone": "Zapytanie jest już obsłużone",
  "zly-nip": "NIP ma 10 cyfr",
  "nip-zajety": "Zakład z tym NIP-em już jest w Ostoi",
  "brak-zakladu-admin": "Nie znaleziono zakładu",
  "tylko-link": "To konto loguje się linkiem z e-maila.",
  // Kod SMS
  "sms-niedostepny": "Nie możemy teraz wysłać kodu SMS. Zadzwoń do opiekuna – pomożemy od razu.",
  "zly-kod": "Nieprawidłowy kod. Sprawdź SMS i wpisz go jeszcze raz.",
  "za-duzo-prob": "Za dużo prób. Wypełnij formularz jeszcze raz albo zadzwoń do opiekuna.",
  "nowy-kod": "Wysłaliśmy nowy kod. Poprzedni przestał działać.",
  "kody-limit": "Wysłaliśmy już kilka kodów na ten numer. Zadzwoń do opiekuna – pomożemy od razu.",
  "kod-za-wczesnie": "Nowy kod możesz wysłać po minucie od poprzedniego.",
  "formularz-wygasl": "Ten formularz wygasł. Wypełnij go jeszcze raz.",
  // Status zakładu i odwołania (P2B)
  "zaklad-wstrzymany-powod": "Zakład wstrzymany. Uzasadnienie widzi właściciel w panelu i może się odwołać.",
  "odwolanie-wyslane": "Odwołanie wysłane. Opiekun partnerów odpowie w ciągu 7 dni.",
  "odwolanie-rozpatrzone": "Odpowiedź zapisana. Zakład widzi ją w panelu.",
  "brak-dostepu-zaklad": "Brak dostępu do zakładu",
  "odwolanie-czeka": "Odwołanie czeka już na odpowiedź",
  "odwolanie-juz-rozpatrzone": "Odwołanie jest już rozpatrzone",
  "odwolanie-kto": "Odwołanie składa właściciel albo biuro zakładu",
  "opisz-fakty": "Opisz konkretne fakty (co najmniej 20 znaków)",
  "opisz-sprawe": "Opisz sprawę (co najmniej 20 znaków)",
  "uzasadnij-odpowiedz": "Uzasadnij odpowiedź (co najmniej 20 znaków)",
  "wstrzymanie-uzasadnienie": "Wstrzymanie zakładu wymaga uzasadnienia",
  "zaklad-niewstrzymany": "Zakład nie jest wstrzymany",
  "zaklad-niezweryfikowany": "Zakład nie jest zweryfikowany albo nie istnieje",
  "blad-zapisu": "Nie udało się zapisać. Spróbuj ponownie albo zadzwoń do opiekuna Ostoi.",
} as const;

export type MessageCode = keyof typeof MESSAGES;

const byText = new Map<string, MessageCode>(
  (Object.entries(MESSAGES) as [MessageCode, string][]).map(([code, text]) => [text, code]),
);

/** Kod dla tekstu komunikatu; nieznany tekst (np. z bazy) → ogólny komunikat błędu. */
export function messageCode(text: string): MessageCode {
  return byText.get(text) ?? "blad-zapisu";
}

export function messageText(code: string | undefined): string | null {
  return code && code in MESSAGES ? MESSAGES[code as MessageCode] : null;
}

/** Adres powrotu z komunikatem, np. withMessage("/panel/profil", "ok", "Zapisano profil.") → /panel/profil?ok=profil-zapisany */
export function withMessage(path: string, kind: "ok" | "blad", text: string): string {
  const url = new URL(path, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("blad");
  url.searchParams.set(kind, messageCode(text));
  return `${url.pathname}${url.search}`;
}
