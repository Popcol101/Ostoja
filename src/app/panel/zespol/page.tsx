import { Mail, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CopyButton, SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, CardTitle, EmptyState, Field, Input, LinkButton, Notice, PageTitle, Select } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { INVITE_COOKIE, ROLE_DESCRIPTION, inviteLink } from "@/lib/team";
import { inviteMember, removeMember, revokeInvitation } from "./actions";

export const metadata: Metadata = { title: "Zespół – Ostoja" };
export const dynamic = "force-dynamic";

type Member = { user_id: string; display_name: string; email: string; role: string; is_me: boolean };
type Invitation = { id: string; email: string; role: string; display_name: string; created_at: Date; expires_at: Date };

function freshInvite(raw: string | undefined): { token: string; name: string; email: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { token?: unknown; name?: unknown; email?: unknown };
    if (typeof v.token === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(v.token) && typeof v.name === "string" && typeof v.email === "string") {
      return { token: v.token, name: v.name, email: v.email };
    }
  } catch {}
  return null;
}

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const owner = me.role === "wlasciciel";
  const { members, invitations } = await withUser(me.userId, async (tx) => ({
    members: await tx<Member[]>`select * from team_members()`,
    invitations: owner ? await tx<Invitation[]>`select * from team_invitations()` : [],
  }));
  const fresh = owner ? freshInvite((await cookies()).get(INVITE_COOKIE)?.value) : null;
  const freshUrl = fresh ? inviteLink(fresh.token) : null;
  const message = fresh
    ? `Dzień dobry, zapraszam Cię do panelu Ostoi naszego zakładu (${me.homeName}). Otwórz link i kliknij „Przyjmij zaproszenie”: ${freshUrl}`
    : "";

  return (
    <>
      <PageTitle sub={`${members.length} ${members.length === 1 ? "osoba ma" : members.length < 5 ? "osoby mają" : "osób ma"} dostęp do panelu`}>
        Zespół
      </PageTitle>
      <Flash searchParams={searchParams} />

      {fresh && freshUrl ? (
        <Card className="mb-4 border-brand">
          <CardTitle>Link zaproszenia dla: {fresh.name}</CardTitle>
          <p className="mb-3 text-[15px] text-muted">
            Wyślij go tylko tej osobie. Link jest ważny 7 dni i działa raz. Po przyjęciu {fresh.email} zaloguje się linkiem z e-maila.
          </p>
          <p className="mb-3 break-all rounded-[10px] bg-ground-family px-3 py-2.5 font-mono text-[13px]">{freshUrl}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={freshUrl} />
            <LinkButton variant="secondary" href={`sms:?body=${encodeURIComponent(message)}`} prefetch={false}>
              <MessageSquare size={18} aria-hidden="true" /> Wyślij SMS-em
            </LinkButton>
            <LinkButton
              variant="secondary"
              href={`mailto:${fresh.email}?subject=${encodeURIComponent("Zaproszenie do panelu Ostoi")}&body=${encodeURIComponent(message)}`}
              prefetch={false}
            >
              <Mail size={18} aria-hidden="true" /> Wyślij e-mailem
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle>Osoby z dostępem</CardTitle>
          <ul className="flex flex-col divide-y divide-line-soft">
            {members.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {m.display_name} {m.is_me ? <span className="font-normal text-muted">(Ty)</span> : null}
                  </p>
                  <p className="break-all text-[14px] text-muted">{m.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={m.role === "wlasciciel" ? "brand" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                  {owner && !m.is_me ? (
                    <details className="text-right">
                      <summary className="min-h-11 cursor-pointer py-2.5 text-[14px] font-semibold text-danger">Odbierz dostęp</summary>
                      <form action={removeMember} className="mt-1 flex flex-col items-end gap-2">
                        <input type="hidden" name="userId" value={m.user_id} />
                        <label className="flex items-center gap-2 text-[14px]">
                          <input type="checkbox" name="confirm" value="tak" required className="size-5 accent-brand" />
                          Potwierdzam
                        </label>
                        <SubmitButton variant="danger" pendingLabel="Odbieram…">
                          Odbierz dostęp
                        </SubmitButton>
                      </form>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[14px] text-muted">
            Odebranie dostępu działa od razu: przy następnym kliknięciu w panelu ta osoba zostanie wylogowana.
          </p>
        </Card>

        {owner ? (
          <div className="flex flex-col gap-4">
            <Card>
              <CardTitle>Zaproś osobę</CardTitle>
              <form action={inviteMember} className="flex flex-col gap-3">
                <Field id="display_name" label="Imię i nazwisko">
                  <Input id="display_name" name="display_name" required minLength={2} maxLength={120} autoComplete="off" />
                </Field>
                <Field id="email" label="E-mail służbowy" hint="Na ten adres przyjdzie link do logowania.">
                  <Input id="email" name="email" type="email" required autoComplete="off" aria-describedby="email-hint" />
                </Field>
                <Field id="role" label="Rola">
                  <Select id="role" name="role" defaultValue="biuro" aria-describedby="role-opis">
                    {(["biuro", "ekipa", "wlasciciel"] as const).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                  <dl id="role-opis" className="mt-1 flex flex-col gap-1 text-[14px] text-muted">
                    {(["biuro", "ekipa", "wlasciciel"] as const).map((r) => (
                      <div key={r}>
                        <dt className="inline font-semibold text-ink">{ROLE_LABEL[r]}: </dt>
                        <dd className="inline">{ROLE_DESCRIPTION[r]}</dd>
                      </div>
                    ))}
                  </dl>
                </Field>
                <SubmitButton pendingLabel="Tworzę…">Utwórz zaproszenie</SubmitButton>
              </form>
            </Card>

            <Card>
              <CardTitle aside={invitations.length ? String(invitations.length) : undefined}>Zaproszenia w drodze</CardTitle>
              {invitations.length === 0 ? (
                <p className="text-muted">Brak otwartych zaproszeń.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-soft">
                  {invitations.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {i.display_name} · {ROLE_LABEL[i.role]}
                        </p>
                        <p className="text-[14px] text-muted">
                          <span className="break-all">{i.email}</span> · ważne do {formatDate(i.expires_at)}
                        </p>
                      </div>
                      <form action={revokeInvitation}>
                        <input type="hidden" name="id" value={i.id} />
                        <SubmitButton variant="secondary" pendingLabel="Odwołuję…">
                          Odwołaj
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        ) : (
          <EmptyState title="Zespół zmienia właściciel zakładu">
            Jeśli ktoś potrzebuje dostępu do panelu, poproś właściciela o zaproszenie.
          </EmptyState>
        )}
      </div>

      {owner ? (
        <div className="mt-4">
          <Notice title="Jak działa zaproszenie">
            Tworzysz link i wysyłasz go SMS-em albo e-mailem. Osoba otwiera link, przyjmuje zaproszenie i loguje się linkiem z e-maila –
            bez haseł. Przy kilku zaproszeniach na ten sam adres działa tylko ostatnie.
          </Notice>
        </div>
      ) : null}
    </>
  );
}
