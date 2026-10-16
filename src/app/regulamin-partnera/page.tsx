import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal";
import { OPIEKUN_PHONE } from "@/components/site";
import { formatPln } from "@/lib/format";
import { OSTOJA_FEE_PLN } from "@/lib/labels";

export const metadata: Metadata = { title: "Zasady dla zakładów partnerskich – Ostoja" };

// Warunki dla użytkowników biznesowych wg rozporządzenia (UE) 2019/1150 (P2B): kolejność ofert (art. 5),
// ograniczenie i zawieszenie z uzasadnieniem (art. 4), skargi (art. 11), mediacja (art. 12), dostęp do danych (art. 9).
export default function PartnerTermsPage() {
  return (
    <LegalPage title="Zasady dla zakładów partnerskich" updated="16 października 2026">
      <p>
        Te zasady uzupełniają umowę partnerską między Ostoją a zakładem pogrzebowym. Opisują, jak zakład pojawia się na liście ofert, kiedy
        możemy go wstrzymać i jak się od tego odwołać.
      </p>

      <h2>Opłaty</h2>
      <p>
        Zakład płaci {formatPln(OSTOJA_FEE_PLN)} netto za zlecenie, w którym rodzina podpisała umowę. Nie ma opłat za miejsce na liście ani za
        zapytania, które nie skończyły się umową. Rozliczenie miesięczne widać w panelu (Rozliczenia).
      </p>

      <h2>Kolejność ofert</h2>
      <ul>
        <li>Domyślnie od zakładu najbliższego środkowi wybranego przez rodzinę miasta.</li>
        <li>Rodzina może posortować oferty po cenie (od najniższej) albo po ocenach (od najwyższej).</li>
        <li>Kolejności nie da się kupić. Nie ma ofert wyróżnionych, sponsorowanych ani lepszych warunków dla wybranych zakładów.</li>
        <li>Na liście są zakłady zweryfikowane, z pełnym cennikiem, obsługujące wybrane miasto i z włączonym „Przyjmuję zapytania”.</li>
      </ul>

      <h2 id="wstrzymanie">Wstrzymanie zakładu</h2>
      <p>Opiekun partnerów może wstrzymać zakład – zakład znika wtedy z listy ofert i nie dostaje nowych zapytań – tylko z tych powodów:</p>
      <ol className="ml-5 flex flex-col gap-1.5">
        {[
          "brak aktualnego wpisu do CEIDG lub KRS albo wygaśnięcie ubezpieczenia OC zakładu;",
          "ceny lub kosztorysy niezgodne z cennikiem pokazanym rodzinom w Ostoi, bez zgody rodziny na zmianę;",
          "powtarzające się skargi rodzin, które potwierdziliśmy po wyjaśnieniach zakładu;",
          "inne naruszenie umowy partnerskiej;",
          "prośba zakładu, np. na czas urlopu albo przerwy w działalności;",
          "wymóg prawa albo decyzja sądu lub organu.",
        ].map((text) => (
          <li key={text} style={{ listStyleType: "decimal" }}>
            {text}
          </li>
        ))}
      </ol>
      <p>
        Razem z wstrzymaniem zakład dostaje w panelu (Status zakładu) uzasadnienie: podstawę z listy powyżej i konkretne fakty, których dotyczy
        decyzja. Uzasadnienie można wydrukować albo zapisać jako PDF. Trwające zlecenia zakład prowadzi w panelu normalnie.
      </p>

      <h2>Odwołanie</h2>
      <p>
        Właściciel albo biuro zakładu może złożyć odwołanie w panelu, na stronie Status zakładu. Odwołanie rozpatruje opiekun partnerów i odpowiada
        na piśmie w ciągu 7 dni – odpowiedź z uzasadnieniem pojawia się w panelu. Jeśli odwołanie jest zasadne, zakład wraca na listę ofert od
        razu. Pytania: opiekun partnerów, {OPIEKUN_PHONE}.
      </p>

      <h2>Zakończenie współpracy</h2>
      <p>
        Ostoja może wypowiedzieć umowę partnerską z 30-dniowym wyprzedzeniem, podając powody. Bez wyprzedzenia – tylko gdy wymaga tego prawo albo
        zakład wielokrotnie naruszył zasady, i zawsze z uzasadnieniem. Zakład może wypowiedzieć umowę w każdej chwili, z rozliczeniem zleceń już
        podpisanych.
      </p>

      <h2>Mediacja</h2>
      <p>
        Jeśli odwołanie nie rozwiąże sporu, proponujemy mediację: [mediator lub ośrodek mediacji – DO UZUPEŁNIENIA]. Udział w mediacji nie
        odbiera prawa do sądu.
      </p>

      <h2>Dane</h2>
      <p>
        Zakład widzi w panelu swoje zapytania, zlecenia, oceny i rozliczenia. Telefon rodziny dostaje dopiero po przyjęciu zapytania. Ostoja
        nie sprzedaje danych zakładów ani rodzin. Szczegóły: <Link href="/prywatnosc" className="font-semibold text-brand">polityka prywatności</Link>.
      </p>
    </LegalPage>
  );
}
