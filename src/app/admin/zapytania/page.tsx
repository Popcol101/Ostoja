import { Phone } from "lucide-react";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, DefinitionList, EmptyState, Field, LinkButton, Notice, PageTitle, Textarea } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { BUDGET_LABEL, BURIAL_LABEL, CEREMONY_LABEL, PLACE_LABEL, type Burial, type Ceremony, type PlaceOfDeath } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";
import { markHandled } from "../actions";

type Escalation = {
  id: string;
  created_at: Date;
  city_name: string;
  burial: Burial;
  ceremony: Ceremony;
  place_of_death: PlaceOfDeath;
  budget: string | null;
  contact_name: string;
  contact_phone: string;
  handled_at: Date | null;
  handled_note: string | null;
};

export default async function Escalations({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const rows = await withUser(admin.userId, (tx) => tx<Escalation[]>`select * from admin_escalations()`);
  const open = rows.filter((r) => !r.handled_at);
  const done = rows.filter((r) => r.handled_at);

  return (
    <>
      <PageTitle sub="Zapytania, których nie przyjął żaden zakład w trzech rundach. Zadzwoń do rodziny i pomóż znaleźć zakład.">
        Do opiekuna
      </PageTitle>
      <Flash searchParams={searchParams} />
      <div className="mb-4">
        <Notice>Te dane widzą tylko opiekunowie Ostoi. Każde otwarcie tej strony zapisuje się w dzienniku.</Notice>
      </div>
      {open.length === 0 ? (
        <EmptyState title="Nikt nie czeka na telefon">Gdy żaden zakład nie przyjmie zapytania, pojawi się ono tutaj.</EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {open.map((r) => (
            <li key={r.id}>
              <Card className="border-2 border-warn">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone="warn">Czeka od {formatDateTime(r.created_at)}</Badge>
                </div>
                <p className="text-[19px] font-semibold">{r.contact_name}</p>
                <LinkButton href={`tel:${r.contact_phone.replace(/\s/g, "")}`} className="mt-2" prefetch={false}>
                  <Phone size={18} aria-hidden="true" /> {r.contact_phone}
                </LinkButton>
                <div className="mt-4">
                  <DefinitionList
                    items={[
                      { term: "Miasto", value: r.city_name },
                      { term: "Forma", value: BURIAL_LABEL[r.burial] },
                      { term: "Ceremonia", value: CEREMONY_LABEL[r.ceremony] },
                      { term: "Miejsce zgonu", value: PLACE_LABEL[r.place_of_death] },
                      { term: "Budżet", value: r.budget ? BUDGET_LABEL[r.budget] : "Nie podano" },
                    ]}
                  />
                </div>
                <form action={markHandled} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                  <input type="hidden" name="inquiryId" value={r.id} />
                  <Field id={`note-${r.id}`} label="Notatka (bez danych wrażliwych)">
                    <Textarea id={`note-${r.id}`} name="note" maxLength={500} placeholder="np. Rodzina wybrała zakład Kalina, oddzwonią sami." />
                  </Field>
                  <SubmitButton variant="secondary" pendingLabel="Zapisuję…">
                    Oznacz jako obsłużone
                  </SubmitButton>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {done.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-[17px] font-semibold">Obsłużone w ostatnim tygodniu</h2>
          <ul className="flex flex-col gap-2">
            {done.map((r) => (
              <li key={r.id} className="rounded-[14px] border border-line bg-card px-4 py-3 text-[15px]">
                <span className="font-semibold">{r.city_name}</span> · {BURIAL_LABEL[r.burial]} · obsłużone {r.handled_at ? formatDateTime(r.handled_at) : ""}
                {r.handled_note ? <span className="block text-muted">{r.handled_note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
