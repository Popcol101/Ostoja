import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal";
import { OPIEKUN_PHONE } from "@/components/site";
import { formatPln } from "@/lib/format";
import { OSTOJA_FEE_PLN } from "@/lib/labels";

export const metadata: Metadata = { title: "Regulamin – Ostoja" };

export default function TermsPage() {
  return (
    <LegalPage title="Regulamin serwisu dla rodzin" updated="16 października 2026">
      <h2>Czym jest Ostoja</h2>
      <p>
        Ostoja to serwis, w którym porównasz ceny zakładów pogrzebowych i poprosisz wybrany zakład o kontakt. Ostoja nie jest zakładem
        pogrzebowym i nie świadczy usług pogrzebowych. Umowę o organizację pogrzebu zawierasz bezpośrednio z zakładem.
      </p>

      <h2>Ile to kosztuje</h2>
      <p>
        Dla rodzin korzystanie z Ostoi jest bezpłatne. Zakład płaci Ostoi {formatPln(OSTOJA_FEE_PLN)} netto za zlecenie, tylko gdy podpiszecie
        umowę. Ta opłata jest taka sama dla wszystkich zakładów i nie zmienia ceny, którą widzisz.
      </p>

      <h2>Jak ustalamy kolejność ofert</h2>
      <ul>
        <li>Domyślnie od najbliższego zakładu (odległość od środka wybranego miasta).</li>
        <li>Możesz posortować oferty po cenie (od najniższej) albo po ocenach (od najwyższej).</li>
        <li>Zakłady nie płacą za miejsce na liście i nie ma ofert wyróżnionych ani sponsorowanych.</li>
        <li>Pokazujemy tylko zakłady zweryfikowane przez Ostoję, które obsługują wybrane miasto i mają pełny cennik.</li>
      </ul>

      <h2>Ceny i oceny</h2>
      <p>
        Ceny podają zakłady za ten sam standardowy zakres usług, dlatego da się je porównać. Ostateczną cenę ustalasz z zakładem w umowie.
        Oceny pochodzą od [źródło ocen i sposób ich weryfikacji – DO UZUPEŁNIENIA przed publikacją ocen].
      </p>

      <h2>Zapytanie i kod SMS</h2>
      <p>
        Zapytanie wysyłamy po potwierdzeniu numeru kodem SMS. Zakład ma 15 minut na odpowiedź; jeśli nie zdąży, zapytanie trafia do kolejnego
        najbliższego zakładu, najwyżej trzy razy. Potem zadzwoni do Ciebie opiekun Ostoi.
      </p>

      <h2>Reklamacje</h2>
      <p>
        Uwagi do działania serwisu zgłoś opiekunowi: {OPIEKUN_PHONE} albo [e-mail – DO UZUPEŁNIENIA]. Odpowiemy w ciągu 14 dni. Reklamacje usług
        pogrzebowych składasz w zakładzie, z którym zawarłeś umowę – chętnie w tym pomożemy.
      </p>

      <h2>Dane osobowe</h2>
      <p>
        Zasady opisuje <Link href="/prywatnosc" className="font-semibold text-brand">polityka prywatności</Link>.
      </p>
    </LegalPage>
  );
}
