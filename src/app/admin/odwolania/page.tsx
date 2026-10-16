import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, EmptyState, Field, Notice, PageTitle, Textarea } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { SUSPENSION_GROUND_LABEL } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";
import { answerAppeal } from "../actions";

type Appeal = {
  id: string;
  home_id: string;
  home_name: string;
  ground: string | null;
  reason: string | null;
  suspended_at: Date | null;
  author_name: string;
  body: string;
  created_at: Date;
  answer: string | null;
  outcome: "przywrocony" | "utrzymane" | null;
  answered_at: Date | null;
};

export default async function Appeals({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const rows = await withUser(admin.userId, (tx) => tx<Appeal[]>`select * from admin_appeals()`);
  const open = rows.filter((r) => !r.answered_at);
  const done = rows.filter((r) => r.answered_at);

  return (
    <>
      <PageTitle sub="Odwołania zakładów od wstrzymania. Odpowiedz w ciągu 7 dni – zakład zobaczy odpowiedź w panelu.">Odwołania</PageTitle>
      <Flash searchParams={searchParams} />
      {open.length === 0 ? (
        <EmptyState title="Brak odwołań do rozpatrzenia">Gdy wstrzymany zakład się odwoła, odwołanie pojawi się tutaj.</EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {open.map((r) => (
            <li key={r.id}>
              <Card className="border-2 border-warn">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/zaklady/${r.home_id}`} className="text-[19px] font-semibold text-ink">
                    {r.home_name}
                  </Link>
                  <Badge tone="warn">Złożone {formatDateTime(r.created_at)}</Badge>
                </div>
                <p className="text-sm font-semibold text-muted">Wstrzymanie{r.suspended_at ? ` z ${formatDateTime(r.suspended_at)}` : ""}</p>
                {r.ground ? <p className="font-semibold">{SUSPENSION_GROUND_LABEL[r.ground]}</p> : null}
                {r.reason ? <p className="text-[15px]">{r.reason}</p> : null}
                <p className="mt-4 text-sm font-semibold text-muted">Odwołanie · {r.author_name}</p>
                <p className="whitespace-pre-line text-[15px]">{r.body}</p>
                <form action={answerAppeal} className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                  <input type="hidden" name="appealId" value={r.id} />
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-[15px] font-semibold">Decyzja</legend>
                    <label className="flex min-h-11 items-center gap-3 text-[15px]">
                      <input type="radio" name="decision" value="przywroc" required className="size-5 accent-brand" />
                      Przywracam zakład na listę ofert
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-[15px]">
                      <input type="radio" name="decision" value="utrzymaj" className="size-5 accent-brand" />
                      Utrzymuję wstrzymanie
                    </label>
                  </fieldset>
                  <Field id={`answer-${r.id}`} label="Odpowiedź dla zakładu" hint="Odnieś się do argumentów zakładu. Zakład zobaczy ją w panelu.">
                    <Textarea id={`answer-${r.id}`} name="answer" required minLength={20} maxLength={2000} rows={4} aria-describedby={`answer-${r.id}-hint`} />
                  </Field>
                  <SubmitButton pendingLabel="Zapisuję…">Zapisz odpowiedź</SubmitButton>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {done.length ? (
        <section className="mt-6">
          <h2 className="mb-2 font-serif text-[22px]">Rozpatrzone w ostatnich 30 dniach</h2>
          <ul className="flex flex-col gap-2">
            {done.map((r) => (
              <li key={r.id}>
                <Card>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.home_name}</span>
                    <Badge tone={r.outcome === "przywrocony" ? "brand" : "neutral"}>
                      {r.outcome === "przywrocony" ? "Przywrócony" : "Wstrzymanie utrzymane"}
                    </Badge>
                    <span className="text-sm text-muted">{r.answered_at ? formatDateTime(r.answered_at) : ""}</span>
                  </p>
                  <p className="mt-1 text-[15px]">{r.answer}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-6">
        <Notice>Odwołania i odpowiedzi zostają w historii zakładu. Rozporządzenie P2B wymaga, by rozpatrywać je w rozsądnym terminie i na piśmie.</Notice>
      </div>
    </>
  );
}
