import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton, SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, CardTitle, DefinitionList, Field, Notice, PageTitle, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { homeStatus } from "@/lib/home-status";
import { SUSPENSION_GROUND_LABEL } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { submitAppeal } from "../actions";

export const metadata: Metadata = { title: "Status zakładu – Ostoja" };
export const dynamic = "force-dynamic";

export default async function StatusPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const s = await homeStatus(me.userId, me.homeId);
  const canAppeal = me.role === "wlasciciel" || me.role === "biuro";
  const openAppeal = s.appeal_id && !s.appeal_answered_at;
  // Odpowiedź dotyczy bieżącego wstrzymania albo ostatniego przywrócenia.
  const answered = s.appeal_id && s.appeal_answered_at;

  return (
    <>
      <PageTitle
        sub={me.homeName}
        aside={
          s.status === "zweryfikowany" ? (
            <Badge tone="brand">Zweryfikowany</Badge>
          ) : s.status === "wstrzymany" ? (
            <Badge tone="warn">Wstrzymany</Badge>
          ) : (
            <Badge tone="neutral">Do weryfikacji</Badge>
          )
        }
      >
        Status zakładu
      </PageTitle>
      <Flash searchParams={searchParams} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {s.status === "wstrzymany" ? (
            <Card>
              <CardTitle aside={<PrintButton label="Drukuj lub zapisz" />}>Uzasadnienie wstrzymania</CardTitle>
              <DefinitionList
                items={[
                  { term: "Od kiedy", value: s.since ? formatDateTime(s.since) : "—" },
                  { term: "Podstawa", value: s.ground ? SUSPENSION_GROUND_LABEL[s.ground] : "—" },
                  { term: "Opis", value: <span className="whitespace-pre-line">{s.reason}</span> },
                ]}
              />
              <p className="mt-4 text-[15px]">
                Na czas wstrzymania zakład nie jest widoczny na liście ofert i nie dostaje nowych zapytań. Trwające zlecenia prowadzisz w panelu
                normalnie. Zasady opisują{" "}
                <Link href="/regulamin-partnera#wstrzymanie" className="font-semibold text-brand">
                  zasady dla zakładów partnerskich
                </Link>
                .
              </p>
            </Card>
          ) : s.status === "zweryfikowany" ? (
            <Card>
              <CardTitle>Zakład jest widoczny dla rodzin</CardTitle>
              <p className="text-[15px]">
                Zweryfikowany{s.since ? ` ${formatDateTime(s.since)}` : ""}. Rodziny widzą zakład na liście ofert, gdy masz pełny cennik i włączone
                „Przyjmuję zapytania”.
              </p>
            </Card>
          ) : (
            <Card>
              <CardTitle>Zakład czeka na weryfikację</CardTitle>
              <p className="text-[15px]">
                Opiekun partnerów sprawdza dokumenty i umowę. Do tego czasu rodziny nie widzą zakładu. Uzupełnij profil i cennik, żeby po weryfikacji
                od razu pojawić się na liście ofert.
              </p>
            </Card>
          )}

          {answered ? (
            <Card>
              <CardTitle aside={<Badge tone={s.appeal_outcome === "przywrocony" ? "brand" : "neutral"}>
                {s.appeal_outcome === "przywrocony" ? "Zakład przywrócony" : "Wstrzymanie utrzymane"}
              </Badge>}>
                Odpowiedź na odwołanie
              </CardTitle>
              <p className="text-sm text-muted">{s.appeal_answered_at ? formatDateTime(s.appeal_answered_at) : ""}</p>
              <p className="mt-1 whitespace-pre-line text-[15px]">{s.appeal_answer}</p>
            </Card>
          ) : null}
        </div>

        {s.status === "wstrzymany" ? (
          <div className="flex flex-col gap-4">
            {openAppeal ? (
              <Card>
                <CardTitle aside={<Badge tone="warn">Czeka na odpowiedź</Badge>}>Twoje odwołanie</CardTitle>
                <p className="text-sm text-muted">Złożone {s.appeal_created_at ? formatDateTime(s.appeal_created_at) : ""}</p>
                <p className="mt-1 whitespace-pre-line text-[15px]">{s.appeal_body}</p>
                <p className="mt-3 text-[15px]">Opiekun partnerów odpowie na piśmie w ciągu 7 dni. Odpowiedź zobaczysz na tej stronie.</p>
              </Card>
            ) : canAppeal ? (
              <Card>
                <CardTitle>Odwołanie</CardTitle>
                <form action={submitAppeal} className="flex flex-col gap-3">
                  <Field
                    id="body"
                    label="Dlaczego decyzja jest błędna?"
                    hint="Odnieś się do opisu. Napisz, jakie masz dokumenty – opiekun poprosi o nie, jeśli będą potrzebne. Bez danych rodzin."
                  >
                    <Textarea id="body" name="body" required minLength={20} maxLength={2000} rows={6} aria-describedby="body-hint" />
                  </Field>
                  <SubmitButton pendingLabel="Wysyłam…">Wyślij odwołanie</SubmitButton>
                </form>
              </Card>
            ) : (
              <Notice>Odwołanie składa właściciel albo biuro zakładu.</Notice>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
