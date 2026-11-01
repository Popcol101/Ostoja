import type { Metadata } from "next";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, EmptyState, Field, Input, Notice, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { setReviewHidden } from "../actions";

export const metadata: Metadata = { title: "Oceny – administracja" };
export const dynamic = "force-dynamic";

type Review = {
  order_id: string;
  home_name: string;
  rating: number;
  comment: string | null;
  hidden_at: Date | null;
  hidden_reason: string | null;
  updated_at: Date;
};

export default async function AdminReviews({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const rows = await withUser(admin.userId, (tx) => tx<Review[]>`select * from admin_reviews()`);

  return (
    <>
      <PageTitle sub="Oceny wystawione przez rodziny z linku po pogrzebie. Ostatnie 200.">Oceny</PageTitle>
      <Flash searchParams={searchParams} />
      <div className="mb-4">
        <Notice>
          Ukrywaj tylko oceny łamiące regulamin, np. z danymi osobowymi albo obraźliwe. Niska ocena sama w sobie nie jest powodem. Każde ukrycie trafia do
          dziennika działań.
        </Notice>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Jeszcze nie ma ocen" />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.order_id}>
              <Card>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{r.home_name}</span>
                  <Badge tone="brand">Ocena {r.rating} z 5</Badge>
                  {r.hidden_at ? <Badge tone="warn">Ukryta</Badge> : null}
                  <span className="ml-auto text-sm text-muted">{formatDateTime(r.updated_at)}</span>
                </p>
                {r.comment ? <p className="mt-2 whitespace-pre-line break-words text-[15px]">{r.comment}</p> : <p className="mt-2 text-muted">Bez komentarza</p>}
                {r.hidden_at ? (
                  <form action={setReviewHidden} className="mt-3 flex flex-wrap items-center gap-3">
                    <input type="hidden" name="orderId" value={r.order_id} />
                    <p className="text-sm text-muted">Powód ukrycia: {r.hidden_reason}</p>
                    <SubmitButton variant="secondary">Przywróć ocenę</SubmitButton>
                  </form>
                ) : (
                  <form action={setReviewHidden} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input type="hidden" name="orderId" value={r.order_id} />
                    <input type="hidden" name="hide" value="tak" />
                    <Field id={`reason-${r.order_id}`} label="Powód ukrycia">
                      <Input id={`reason-${r.order_id}`} name="reason" maxLength={300} required minLength={5} />
                    </Field>
                    <SubmitButton variant="danger">Ukryj ocenę</SubmitButton>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
