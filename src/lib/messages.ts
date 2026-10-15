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
  "brak-telefonu": "Brak numeru telefonu rodziny w zleceniu.",
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
