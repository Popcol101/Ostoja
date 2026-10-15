import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { OPIEKUN_PHONE } from "@/components/site";

export const metadata: Metadata = { title: "Polityka prywatności – Ostoja" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Polityka prywatności" updated="16 października 2026">
      <p>
        Piszemy prosto, co robimy z Twoimi danymi. Zbieramy tylko to, co potrzebne, żeby zakład pogrzebowy mógł do Ciebie oddzwonić. Nie pytamy
        o przyczynę zgonu ani o numer PESEL.
      </p>

      <h2>Kto odpowiada za dane</h2>
      <p>
        Administratorem danych podanych w formularzu na tej stronie jest Ostoja sp. z o.o., [adres – DO UZUPEŁNIENIA], NIP [DO UZUPEŁNIENIA].
        Kontakt w sprawie danych: [e-mail – DO UZUPEŁNIENIA] albo telefon opiekuna {OPIEKUN_PHONE}.
      </p>
      <p>
        Po przyjęciu zapytania zakład pogrzebowy staje się osobnym administratorem danych, których potrzebuje do organizacji pogrzebu. Dane
        uzupełniane pod linkiem od zakładu (np. dane do aktu zgonu, numer konta do zasiłku) przetwarzamy w imieniu zakładu, na podstawie
        umowy powierzenia.
      </p>

      <h2>Jakie dane i po co</h2>
      <ul>
        <li>
          <strong>Imię i nazwisko, numer telefonu, odpowiedzi z formularza</strong> (miasto, forma pochówku, ceremonia, miejsce zgonu, budżet,
          liczba gości) – żeby przekazać zapytanie zakładom i umożliwić kontakt. Podstawa: działania na Twoje żądanie przed zawarciem umowy
          i Twoja zgoda na przekazanie numeru zakładowi (art. 6 ust. 1 lit. a i b RODO).
        </li>
        <li>
          <strong>Kod SMS</strong> – żeby sprawdzić, że numer należy do Ciebie i zakład zadzwoni do właściwej osoby. Podstawa: nasz uzasadniony
          interes, czyli zapobieganie nadużyciom (art. 6 ust. 1 lit. f RODO).
        </li>
        <li>
          <strong>Skrót adresu IP</strong> – żeby ograniczyć liczbę prób (ochrona przed spamem). Nie przechowujemy samego adresu IP.
        </li>
      </ul>

      <h2>Kto zobaczy Twój numer</h2>
      <p>
        Tylko zakład, który przyjmie zapytanie. Zakłady, do których trafia zapytanie, widzą najpierw wyłącznie miasto, rodzaj pogrzebu
        i odległość. Gdy żaden zakład nie przyjmie zapytania, zadzwoni do Ciebie opiekun Ostoi.
      </p>
      <p>
        Korzystamy z usług zewnętrznych firm, które przetwarzają dane w naszym imieniu: Supabase (baza danych, serwery we Frankfurcie), Vercel
        (serwer strony, region Frankfurt; firma z USA – przekazanie danych na podstawie Ram ochrony danych UE–USA i standardowych klauzul
        umownych), SMSAPI (wysyłka SMS, Polska) oraz [dostawca poczty – DO UZUPEŁNIENIA].
      </p>

      <h2>Jak długo</h2>
      <ul>
        <li>Niedokończony formularz (bez kodu SMS): do 24 godzin.</li>
        <li>Imię i telefon z zapytania: 90 dni od wysłania. Potem je usuwamy, zostają dane statystyczne bez danych osobowych.</li>
        <li>Dane w zleceniu przyjętym przez zakład: tak długo, jak wymagają tego przepisy obowiązujące zakład (np. podatkowe).</li>
      </ul>

      <h2>Twoje prawa</h2>
      <p>
        Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia oraz sprzeciwu. Zgodę możesz cofnąć
        w każdej chwili – nie wpływa to na to, co zrobiliśmy wcześniej. Możesz złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych
        (ul. Stawki 2, 00-193 Warszawa).
      </p>

      <h2>Pliki cookie</h2>
      <p>
        Używamy wyłącznie plików niezbędnych do działania: sesji panelu zakładu, zaproszenia do panelu i (tylko w wersji testowej) kodu
        testowego. Nie używamy plików reklamowych ani analitycznych, dlatego nie pytamy o zgodę na cookie.
      </p>
    </LegalPage>
  );
}
