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
  "link-hasla-wyslany": "Jeśli ten adres ma konto w Ostoi, wysłaliśmy na niego link do ustawienia hasła. Link działa godzinę.",
  "haslo-ustawione": "Hasło ustawione. Od teraz logujesz się e-mailem i tym hasłem.",
  "sms-zlecony": "SMS z linkiem jest w drodze do rodziny.",
  "powiadomienia-wlaczone": "Powiadomienia są włączone na tym urządzeniu.",
  // Błędy formularzy
  "sprawdz-dane": "Sprawdź wpisane dane.",
  "potwierdz-usuniecie": "Zaznacz potwierdzenie usunięcia.",
  "zly-identyfikator": "Nieprawidłowy identyfikator",
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
  "zle-dane-logowania": "Nieprawidłowy e-mail lub hasło.",
  "zle-haslo": "Nieprawidłowe hasło.",
  "wpisz-haslo": "Wpisz hasło",
  "limit-logowania": "Zbyt wiele prób logowania. Spróbuj ponownie za kwadrans.",
  "poczta-niedostepna": "Wysyłka e-maili jest chwilowo niedostępna. Zadzwoń do opiekuna partnerów Ostoi.",
  "haslo-za-krotkie": "Hasło musi mieć co najmniej 12 znaków.",
  "haslo-za-dlugie": "Hasło jest za długie – najwyżej 72 znaki.",
  "hasla-rozne": "Hasła się różnią. Wpisz to samo hasło dwa razy.",
  "haslo-jak-email": "Hasło nie może być adresem e-mail.",
  "haslo-wyciek": "To hasło wyciekło kiedyś z innego serwisu i jest znane włamywaczom. Wybierz inne.",
  "haslo-slabe": "To hasło jest za słabe. Wybierz dłuższe, np. kilka słów.",
  "haslo-slabe-nowy-link": "To hasło jest za słabe. Poproś o nowy link i wybierz dłuższe, np. kilka słów.",
  "brak-zakladu": "To konto nie jest przypisane do żadnego zakładu. Zadzwoń do opiekuna partnerów Ostoi.",
  "demo-wylaczone": "Logowanie kontami testowymi jest wyłączone.",
  "brak-telefonu": "Brak numeru telefonu rodziny w zleceniu",
  "limit-sms": "Do rodziny poszły już 3 SMS-y w ciągu doby. Zadzwoń zamiast pisać.",
  // Zespół
  "zaproszenie-utworzone": "Zaproszenie gotowe. Wyślij link tej osobie – działa 7 dni.",
  "zaproszenie-odwolane": "Zaproszenie odwołane. Link przestał działać.",
  "dostep-odebrany": "Dostęp odebrany.",
  "zaproszenie-wyslane": "Zaproszenie wysłane e-mailem. Link do ustawienia hasła działa 7 dni.",
  "zaproszenie-niewyslane": "Nie udało się wysłać e-maila z zaproszeniem. Spróbuj ponownie za chwilę.",
  "witaj": "Witaj w panelu Ostoi.",
  "witaj-haslo": "Witaj w panelu Ostoi. Logujesz się tym adresem e-mail i hasłem.",
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
  "podaj-nazwe-zakladu": "Podaj nazwę zakładu",
  "podaj-adres": "Podaj adres",
  "nip-zajety": "Zakład z tym NIP-em już jest w Ostoi",
  "brak-zakladu-admin": "Nie znaleziono zakładu",
  "tylko-haslo": "To konto loguje się e-mailem i hasłem.",
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
  // Wnioski RODO
  "podaj-pelny-numer": "Podaj pełny numer telefonu (9 cyfr)",
  // Klepsydra
  "klepsydra-zapisana": "Zapisano klepsydrę.",
  "klepsydra-opublikowana": "Klepsydra jest w sieci. Udostępnij link rodzinie i znajomym.",
  "klepsydra-wycofana": "Klepsydra wycofana z sieci.",
  "klepsydra-ekipa": "Klepsydrę zmienia właściciel albo biuro.",
  "klepsydra-dlugosc": "Sprawdź długość pól klepsydry.",
  "klepsydra-publikuje": "Klepsydrę publikuje właściciel albo biuro zakładu",
  "klepsydra-zapisz": "Najpierw zapisz klepsydrę",
  "klepsydra-zgoda": "Potwierdź, że rodzina zgodziła się na publikację klepsydry",
  "klepsydra-dane": "Uzupełnij imię, nazwisko i datę zgonu przed publikacją",
  "klepsydra-adres": "Nie udało się przygotować adresu klepsydry",
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
