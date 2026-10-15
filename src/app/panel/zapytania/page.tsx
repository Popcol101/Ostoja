import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Countdown, SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, DefinitionList, EmptyState, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { countLabel, formatDateTime, formatPln } from "@/lib/format";
import {
  BUDGET_LABEL,
  BURIAL_LABEL,
  CEREMONY_LABEL,
  FUNERAL_BENEFIT_PLN,
  OFFER_STATUS_LABEL,
  PLACE_LABEL,
  type Burial,
  type Ceremony,
  type OfferStatus,
  type PlaceOfDeath,
} from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { acceptOffer, declineOffer } from "../actions";

export const metadata: Metadata = { title: "Zapytania" };
export const dynamic = "force-dynamic";

type InboxRow = {
  offer_id: string;
  status: OfferStatus;
  sent_at: Date;
  expires_at: Date;
  quote_pln: number;
  distance_km: number;
  city_name: string;
  burial: Burial;
  ceremony: Ceremony;
  place_of_death: PlaceOfDeath;
  budget: string | null;
  guests_estimate: number | null;
  order_id: string | null;
};

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const rows = await withUser(me.userId, (tx) => tx<InboxRow[]>`select * from get_inbox()`);
  const fresh = rows.filter((r) => r.status === "nowe");
  const history = rows.filter((r) => r.status !== "nowe");

  return (
    <>
      <PageTitle sub={fresh.length ? `${countLabel(fresh.length, "nowe zapytanie", "nowe zapytania", "nowych zapytań")} czeka na odpowiedź` : undefined}>
        Zapytania
      </PageTitle>
      <Flash searchParams={searchParams} />

      {!me.acceptingToday ? (
        <div className="mb-4 rounded-xl bg-warn-tint px-4 py-3 text-warn-ink">
          <p className="font-semibold">Zapytania są wstrzymane.</p>
          <p>Rodziny nie wyślą Ci nowych zapytań, dopóki nie włączysz przełącznika „Przyjmuję zapytania” u góry ekranu.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        {fresh.length === 0 ? (
          <EmptyState title="Brak nowych zapytań">
            {me.acceptingToday
              ? "Gdy rodzina wybierze Twój zakład, dostaniesz powiadomienie. Na odpowiedź masz 15 minut."
              : "Włącz przyjmowanie zapytań, żeby rodziny mogły wybrać Twój zakład."}
          </EmptyState>
        ) : (
          fresh.map((r) => (
            <Card key={r.offer_id} className="border-2 border-warn" aria-labelledby={`zap-${r.offer_id}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id={`zap-${r.offer_id}`} className="text-[13px] font-bold uppercase tracking-wide text-warn-ink">
                  Nowe zapytanie
                </h2>
                <span className="text-sm text-muted">{formatDateTime(r.sent_at)}</span>
              </div>
              <Countdown expiresAt={r.expires_at.toISOString()} />
              <div className="mt-4">
                <DefinitionList
                  items={[
                    { term: "Forma", value: BURIAL_LABEL[r.burial] },
                    { term: "Ceremonia", value: CEREMONY_LABEL[r.ceremony] },
                    { term: "Miejsce zgonu", value: PLACE_LABEL[r.place_of_death] },
                    {
                      term: "Odległość",
                      value: (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={15} aria-hidden="true" />
                          {r.city_name}, {r.distance_km.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km od Ciebie
                        </span>
                      ),
                    },
                    { term: "Budżet", value: r.budget ? BUDGET_LABEL[r.budget] : "Nie podano" },
                    ...(r.guests_estimate ? [{ term: "Goście", value: `ok. ${r.guests_estimate} osób` }] : []),
                  ]}
                />
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-2 rounded-[10px] bg-ground-family px-3 py-2.5">
                <span className="text-sm text-ink">Wycena z Twojego cennika</span>
                <span className="text-lg font-bold">{formatPln(r.quote_pln)}</span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Z zasiłku pogrzebowego zostanie rodzinie {formatPln(FUNERAL_BENEFIT_PLN - r.quote_pln)}.
              </p>
              <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
                <form action={declineOffer}>
                  <input type="hidden" name="offerId" value={r.offer_id} />
                  <SubmitButton variant="secondary" full pendingLabel="Przekazuję…">
                    Nie mogę
                  </SubmitButton>
                </form>
                <form action={acceptOffer}>
                  <input type="hidden" name="offerId" value={r.offer_id} />
                  <SubmitButton full pendingLabel="Przyjmuję…">
                    Przyjmij i zadzwoń
                  </SubmitButton>
                </form>
              </div>
              <p className="mt-3 text-[13px] text-muted">
                Imię i telefon rodziny zobaczysz po przyjęciu. Opłata 250 zł netto dopiero po podpisaniu umowy.
              </p>
            </Card>
          ))
        )}

        {history.length > 0 ? (
          <section aria-labelledby="historia">
            <h2 id="historia" className="mb-2 mt-2 text-[17px] font-semibold">
              Wcześniejsze zapytania
            </h2>
            <ul className="flex flex-col gap-2">
              {history.map((r) => (
                <li key={r.offer_id} className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
                  <span className="flex flex-col">
                    <span className="font-semibold">
                      {BURIAL_LABEL[r.burial]} · {CEREMONY_LABEL[r.ceremony].toLowerCase()}
                    </span>
                    <span className="text-[13px] text-muted">
                      {formatDateTime(r.sent_at)} · {formatPln(r.quote_pln)}
                    </span>
                  </span>
                  {r.order_id ? (
                    <Link href={`/panel/zlecenia/${r.order_id}`} className="font-semibold text-brand">
                      Otwórz zlecenie
                    </Link>
                  ) : (
                    <Badge tone={r.status === "przyjete" ? "brand" : "neutral"}>{OFFER_STATUS_LABEL[r.status]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
