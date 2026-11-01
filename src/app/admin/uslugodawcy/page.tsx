import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { InviteLinkCard, parseInviteCookie } from "@/components/invite-link";
import { Badge, Card, CardTitle, EmptyState, Field, Input, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { INVITE_COOKIE, inviteLink } from "@/lib/team";
import { createProvider, inviteProvider, updateProvider } from "../actions";

export const metadata: Metadata = { title: "Usługodawcy – administracja" };
export const dynamic = "force-dynamic";

type Provider = { id: string; name: string; nip: string; phone: string; email: string; city: string; verified_at: Date | null; cemetery_ids: string[]; members: number; open_visits: number };
type Cemetery = { id: string; name: string; city: string; locator: "grobonet" | "miejska" | "brak" };

const LOCATOR_LABEL = { grobonet: "Grobonet", miejska: "wyszukiwarka miejska", brak: "bez wyszukiwarki – tylko GPS" } as const;

export default async function AdminProviders({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const { providers, cemeteries } = await withUser(admin.userId, async (tx) => ({
    providers: await tx<Provider[]>`select * from admin_providers()`,
    cemeteries: await tx<Cemetery[]>`select id, name, city, locator from cemeteries order by city, name`,
  }));
  const fresh = parseInviteCookie((await cookies()).get(INVITE_COOKIE)?.value);
  const cities = [...new Set(cemeteries.map((c) => c.city))];

  return (
    <>
      <PageTitle sub="Firmy, które zapalają znicze, stawiają kwiaty i sprzątają groby. Klienci widzą tylko cmentarze zweryfikowanych usługodawców.">
        Usługodawcy
      </PageTitle>
      <Flash searchParams={searchParams} />
      {fresh ? <InviteLinkCard url={inviteLink(fresh.token)} name={fresh.name} email={fresh.email} homeName="opieka nad grobami" /> : null}

      {providers.length === 0 ? <EmptyState title="Nie ma jeszcze usługodawców" /> : null}
      <ul className="flex flex-col gap-4">
        {providers.map((p) => (
          <li key={p.id}>
            <Card>
              <CardTitle aside={p.verified_at ? <Badge tone="brand">Zweryfikowany</Badge> : <Badge tone="warn">Czeka na weryfikację</Badge>}>{p.name}</CardTitle>
              <p className="text-[15px] text-muted">
                NIP {p.nip} · {p.city} · {p.phone} · {p.email} · osoby w panelu: {p.members} · wizyty do zrobienia: {p.open_visits}
              </p>
              <form action={updateProvider} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="providerId" value={p.id} />
                <details>
                  <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Cmentarze ({p.cemetery_ids.length})</summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {cities.map((city) => (
                      <fieldset key={city}>
                        <legend className="font-semibold">{city}</legend>
                        {cemeteries
                          .filter((c) => c.city === city)
                          .map((c) => (
                            <label key={c.id} className="flex min-h-11 items-center gap-3 text-[15px]">
                              <input type="checkbox" name="cemetery" value={c.id} defaultChecked={p.cemetery_ids.includes(c.id)} className="size-5 accent-brand" />
                              <span>
                                {c.name} <span className="text-muted">· {LOCATOR_LABEL[c.locator]}</span>
                              </span>
                            </label>
                          ))}
                      </fieldset>
                    ))}
                  </div>
                </details>
                <label className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" name="verified" value="tak" defaultChecked={!!p.verified_at} className="size-5 accent-brand" />
                  Zweryfikowany (sprawdzone dokumenty i umowa)
                </label>
                <SubmitButton variant="secondary">Zapisz</SubmitButton>
              </form>
              <details className="mt-2 border-t border-line-soft pt-2">
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Zaproś osobę do panelu</summary>
                <form action={inviteProvider} className="mt-2 grid gap-3 sm:grid-cols-2 sm:items-end">
                  <input type="hidden" name="providerId" value={p.id} />
                  <input type="hidden" name="providerName" value={p.name} />
                  <Field id={`pi-name-${p.id}`} label="Imię i nazwisko">
                    <Input id={`pi-name-${p.id}`} name="display_name" required maxLength={120} />
                  </Field>
                  <Field id={`pi-email-${p.id}`} label="E-mail">
                    <Input id={`pi-email-${p.id}`} name="email" type="email" required />
                  </Field>
                  <SubmitButton>Wyślij zaproszenie</SubmitButton>
                </form>
              </details>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="mt-4">
        <CardTitle>Dodaj usługodawcę</CardTitle>
        <form action={createProvider} className="grid gap-3 sm:grid-cols-2">
          <Field id="np-name" label="Nazwa firmy">
            <Input id="np-name" name="name" required maxLength={120} />
          </Field>
          <Field id="np-nip" label="NIP">
            <Input id="np-nip" name="nip" inputMode="numeric" required />
          </Field>
          <Field id="np-phone" label="Telefon">
            <Input id="np-phone" name="phone" type="tel" required />
          </Field>
          <Field id="np-email" label="E-mail">
            <Input id="np-email" name="email" type="email" required />
          </Field>
          <Field id="np-city" label="Miasto">
            <Input id="np-city" name="city" required maxLength={80} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Dodaj usługodawcę</SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}
