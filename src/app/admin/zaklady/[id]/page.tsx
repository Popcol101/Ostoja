import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { InviteLinkCard, parseInviteCookie } from "@/components/invite-link";
import { Badge, Card, CardTitle, DefinitionList, Field, Input, Notice, PageTitle, Select } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { requireAdmin } from "@/lib/session";
import { INVITE_COOKIE, inviteLink } from "@/lib/team";
import { inviteToHome, setVerified } from "../../actions";

type Home = {
  id: string;
  name: string;
  city_name: string;
  address: string;
  phone: string;
  email: string;
  nip: string;
  verified_at: Date | null;
  accepting_today: boolean;
  owners: number;
  price_complete: boolean;
  orders_month: number;
  created_at: Date;
};
type Person = { kind: "osoba" | "zaproszenie"; name: string; email: string; role: string; since: Date | null };

export default async function AdminHome({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { home, people } = await withUser(admin.userId, async (tx) => {
    const [home] = await tx<Home[]>`select * from admin_homes() where id = ${id}`;
    const people = home ? await tx<Person[]>`select * from admin_home_people(${id})` : [];
    return { home, people };
  });
  if (!home) notFound();
  const fresh = parseInviteCookie((await cookies()).get(INVITE_COOKIE)?.value);
  const members = people.filter((p) => p.kind === "osoba");
  const invites = people.filter((p) => p.kind === "zaproszenie");
  const ready = home.owners > 0 && home.price_complete;

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-brand">
        Wszystkie zakłady
      </Link>
      <PageTitle
        sub={`${home.city_name} · dodany ${formatDate(home.created_at)}`}
        aside={home.verified_at ? <Badge tone="brand">Zweryfikowany {formatDate(home.verified_at)}</Badge> : <Badge tone="warn">Do weryfikacji</Badge>}
      >
        {home.name}
      </PageTitle>
      <Flash searchParams={searchParams} />
      {fresh ? <InviteLinkCard url={inviteLink(fresh.token)} name={fresh.name} email={fresh.email} homeName={home.name} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Dane zakładu</CardTitle>
            <DefinitionList
              items={[
                { term: "NIP", value: home.nip },
                { term: "Adres", value: home.address },
                { term: "Telefon", value: home.phone },
                { term: "E-mail", value: <span className="break-all">{home.email}</span> },
                { term: "Cennik", value: home.price_complete ? "pełny" : "niepełny – rodziny nie zobaczą ceny" },
                { term: "Zlecenia w tym miesiącu", value: String(home.orders_month) },
              ]}
            />
          </Card>

          <Card>
            <CardTitle aside={`${members.length} os.`}>Osoby w panelu</CardTitle>
            {members.length === 0 ? (
              <p className="text-muted">Nikt jeszcze nie ma dostępu. Zaproś właściciela.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-soft">
                {members.map((p) => (
                  <li key={p.email} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block break-all text-[14px] text-muted">{p.email}</span>
                    </span>
                    <Badge tone={p.role === "wlasciciel" ? "brand" : "neutral"}>{ROLE_LABEL[p.role]}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {invites.length ? (
              <>
                <p className="mt-3 text-sm font-semibold text-muted">Zaproszenia w drodze</p>
                <ul className="mt-1 flex flex-col gap-1 text-[14px]">
                  {invites.map((p) => (
                    <li key={p.email}>
                      {p.name} ({ROLE_LABEL[p.role]}) · <span className="break-all">{p.email}</span> · ważne do {p.since ? formatDate(p.since) : "—"}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Widoczność dla rodzin</CardTitle>
            {home.verified_at ? (
              <form action={setVerified} className="flex flex-col gap-3">
                <p className="text-[15px]">Zakład jest na liście ofert i dostaje zapytania.</p>
                <input type="hidden" name="homeId" value={home.id} />
                <input type="hidden" name="verified" value="nie" />
                <label className="flex items-start gap-3 text-[15px]">
                  <input type="checkbox" required className="mt-0.5 size-5 accent-brand" />
                  Wstrzymuję zakład: znika z listy ofert i nie dostaje nowych zapytań. Trwające zlecenia zostają.
                </label>
                <SubmitButton variant="danger" pendingLabel="Wstrzymuję…">
                  Wstrzymaj zakład
                </SubmitButton>
              </form>
            ) : (
              <form action={setVerified} className="flex flex-col gap-3">
                {ready ? null : (
                  <Notice tone="warn">
                    {home.owners === 0 ? "Zakład nie ma jeszcze właściciela w panelu. " : ""}
                    {home.price_complete ? "" : "Cennik jest niepełny – bez niego zakład nie pojawi się na liście ofert."}
                  </Notice>
                )}
                <input type="hidden" name="homeId" value={home.id} />
                <input type="hidden" name="verified" value="tak" />
                <label className="flex items-start gap-3 text-[15px]">
                  <input type="checkbox" required className="mt-0.5 size-5 accent-brand" />
                  Sprawdziłem dokumenty (CEIDG lub KRS) i umowę partnerską.
                </label>
                <SubmitButton pendingLabel="Weryfikuję…">Zweryfikuj zakład</SubmitButton>
              </form>
            )}
          </Card>

          <Card>
            <CardTitle>Zaproś do panelu</CardTitle>
            <form action={inviteToHome} className="flex flex-col gap-3">
              <input type="hidden" name="homeId" value={home.id} />
              <Field id="display_name" label="Imię i nazwisko">
                <Input id="display_name" name="display_name" required minLength={2} maxLength={120} autoComplete="off" />
              </Field>
              <Field id="email" label="E-mail">
                <Input id="email" name="email" type="email" required autoComplete="off" />
              </Field>
              <Field id="role" label="Rola">
                <Select id="role" name="role" defaultValue={home.owners === 0 ? "wlasciciel" : "biuro"}>
                  <option value="wlasciciel">{ROLE_LABEL.wlasciciel}</option>
                  <option value="biuro">{ROLE_LABEL.biuro}</option>
                  <option value="ekipa">{ROLE_LABEL.ekipa}</option>
                </Select>
              </Field>
              <SubmitButton variant="secondary" pendingLabel="Tworzę…">
                Utwórz zaproszenie
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
