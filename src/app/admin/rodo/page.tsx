import { Notice, PageTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { RodoTool } from "./tool";

export default async function RodoPage() {
  await requireAdmin();
  return (
    <>
      <PageTitle sub="Dostęp do danych, kopia i usunięcie – dla osób, które wysłały zapytanie przez Ostoję.">Wnioski RODO</PageTitle>
      <div className="mb-4">
        <Notice title="Zanim wyszukasz">
          Potwierdź tożsamość: oddzwoń na numer z wniosku. Odpowiedz w ciągu miesiąca. Każde wyszukanie, kopia i usunięcie zapisują się w dzienniku.
          Procedura: dokument „RODO i bezpieczeństwo”, rozdział 10.
        </Notice>
      </div>
      <RodoTool />
    </>
  );
}
