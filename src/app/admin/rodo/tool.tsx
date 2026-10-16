"use client";
import { Download } from "lucide-react";
import { useActionState, useMemo } from "react";
import { SubmitButton } from "@/components/client";
import { Badge, Card, CardTitle, Field, Input, Notice } from "@/components/ui";
import { rodoAction, type RodoState } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  otwarte: "czeka na zakład",
  przyjete: "przyjęte",
  do_opiekuna: "przekazane opiekunowi",
  zamkniete: "zamknięte",
};

const KIND_LABEL = { zapytanie: "Zapytanie", szkic: "Szkic przed kodem SMS", zlecenie: "Zlecenie u zakładu" } as const;

function fmt(iso: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(new Date(iso));
}

export function RodoTool() {
  const [state, action] = useActionState<RodoState, FormData>(rodoAction, { step: "start" });
  const download = useMemo(
    () => (state.step === "wyniki" && state.exported ? URL.createObjectURL(new Blob([state.exported], { type: "application/json" })) : null),
    [state],
  );
  const ostoja = state.step === "wyniki" ? state.rows.filter((r) => r.kind !== "zlecenie") : [];
  const homes = state.step === "wyniki" ? state.rows.filter((r) => r.kind === "zlecenie") : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="intent" value="szukaj" />
          <div className="flex-1">
            <Field id="phone" label="Numer telefonu osoby składającej wniosek" hint="Numer nie trafia do adresu strony ani do dziennika.">
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                required
                defaultValue={state.step === "wyniki" ? state.phone : ""}
                aria-describedby="phone-hint"
              />
            </Field>
          </div>
          <SubmitButton pendingLabel="Szukam…">Szukaj danych</SubmitButton>
        </form>
      </Card>

      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}

      {state.step === "wyniki" ? (
        <>
          {state.erased !== undefined ? (
            <Notice>
              Usunięto imię i numer z {state.erased} {state.erased === 1 ? "zapytania" : "zapytań"} i szkice. Odpowiedz osobie w ciągu miesiąca od
              wniosku.
            </Notice>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle aside={`${ostoja.length}`}>Dane w Ostoi</CardTitle>
              {ostoja.length === 0 ? (
                <p className="text-muted">Brak zapytań i szkiców z tym numerem.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-soft">
                  {ostoja.map((r) => (
                    <li key={r.id} className="py-2.5 text-[15px]">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge>{KIND_LABEL[r.kind]}</Badge>
                        <span className="text-muted">{fmt(r.created_at)}</span>
                      </span>
                      <span className="mt-1 block">
                        {[r.name, r.city_name, r.home_name ? `przyjął: ${r.home_name}` : null, STATUS_LABEL[r.status] ?? r.status].filter(Boolean).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                <form action={action}>
                  <input type="hidden" name="intent" value="eksport" />
                  <input type="hidden" name="phone" value={state.phone} />
                  <SubmitButton variant="secondary" pendingLabel="Przygotowuję…">
                    Przygotuj kopię danych (art. 15)
                  </SubmitButton>
                </form>
                {download ? (
                  <a
                    href={download}
                    download="ostoja-kopia-danych.json"
                    className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand"
                  >
                    <Download size={18} aria-hidden="true" /> Pobierz kopię danych (JSON)
                  </a>
                ) : null}
                {ostoja.length ? (
                  <form action={action} className="flex flex-col gap-3">
                    <input type="hidden" name="intent" value="usun" />
                    <input type="hidden" name="phone" value={state.phone} />
                    <label className="flex items-start gap-3 text-[15px]">
                      <input type="checkbox" name="potwierdzam" value="tak" required className="mt-0.5 size-5 accent-brand" />
                      Potwierdzam tożsamość osoby (oddzwoniłem na ten numer) i usuwam jej imię i numer z zapytań Ostoi (art. 17).
                    </label>
                    <SubmitButton variant="danger" pendingLabel="Usuwam…">
                      Usuń dane z zapytań
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </Card>
            <Card>
              <CardTitle aside={`${homes.length}`}>Zlecenia u zakładów</CardTitle>
              {homes.length === 0 ? (
                <p className="text-muted">Brak zleceń z tym numerem.</p>
              ) : (
                <>
                  <p className="text-[15px]">
                    Te dane prowadzi zakład jako administrator. Przekaż mu wniosek w ciągu 2 dni i poinformuj o tym osobę.
                  </p>
                  <ul className="mt-2 flex flex-col divide-y divide-line-soft">
                    {homes.map((r) => (
                      <li key={r.id} className="py-2.5 text-[15px]">
                        <span className="font-semibold">{r.home_name}</span>
                        <span className="block text-muted">od {fmt(r.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
