import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SubmitButton } from "@/components/client";
import { InviteLinkCard, parseInviteCookie } from "@/components/invite-link";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, CardTitle, EmptyState, Field, Input, Notice, PageTitle, Select } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { mailEnabled } from "@/lib/mail";
import { ROLE_LABEL } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { INVITE_COOKIE, ROLE_DESCRIPTION, inviteLink } from "@/lib/team";
import { inviteMember, removeMember, revokeInvitation } from "./actions";

export const metadata: Metadata = { title: "Zespół – Ostoja" };
export const dynamic = "force-dynamic";

type Member = { user_id: string; display_name: string; email: string; role: string; is_me: boolean };
type Invitation = { id: string; email: string; role: string; display_name: string; created_at: Date; expires_at: Date };

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const owner = me.role === "wlasciciel";
  const { members, invitations } = await withUser(me.userId, async (tx) => ({
    members: await tx<Member[]>`select * from team_members()`,
    invitations: owner ? await tx<Invitation[]>`select * from team_invitations()` : [],
  }));
  const fresh = owner ? parseInviteCookie((await cookies()).get(INVITE_COOKIE)?.value) : null;
  const freshUrl = fresh ? inviteLink(fresh.token) : null;
  const byMail = mailEnabled();
  return (
    <>
      <PageTitle sub={`${members.length} ${members.length === 1 ? "osoba ma" : members.length < 5 ? "osoby mają" : "osób ma"} dostęp do panelu`}>
        Zespół
      </PageTitle>
      <Flash searchParams={searchParams} />

      {fresh && freshUrl ? <InviteLinkCard url={freshUrl} name={fresh.name} email={fresh.email} homeName={me.homeName} /> : null}

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
                <Field
                  id="email"
                  label="E-mail służbowy"
                  hint={byMail ? "Na ten adres wyślemy zaproszenie z linkiem do ustawienia hasła." : "Tym adresem ta osoba będzie się logować."}
                >
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
                <SubmitButton pendingLabel={byMail ? "Wysyłam…" : "Tworzę…"}>{byMail ? "Wyślij zaproszenie" : "Utwórz zaproszenie"}</SubmitButton>
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
                      <div className="flex flex-wrap gap-2">
                        {byMail ? (
                          <form action={inviteMember}>
                            <input type="hidden" name="display_name" value={i.display_name} />
                            <input type="hidden" name="email" value={i.email} />
                            <input type="hidden" name="role" value={i.role} />
                            <SubmitButton variant="secondary" pendingLabel="Wysyłam…">
                              Wyślij ponownie
                            </SubmitButton>
                          </form>
                        ) : null}
                        <form action={revokeInvitation}>
                          <input type="hidden" name="id" value={i.id} />
                          <SubmitButton variant="secondary" pendingLabel="Odwołuję…">
                            Odwołaj
                          </SubmitButton>
                        </form>
                      </div>
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
            {byMail
              ? "Wysyłamy e-mail z linkiem. Osoba otwiera go, ustawia hasło i od razu jest w panelu. Potem loguje się tym adresem e-mail i hasłem."
              : "Tworzysz link i wysyłasz go SMS-em albo e-mailem. Osoba otwiera link, ustawia hasło i od razu jest w panelu."}{" "}
            Link działa 7 dni. Przy kilku zaproszeniach na ten sam adres działa tylko ostatnie.
          </Notice>
        </div>
      ) : null}
    </>
  );
}
