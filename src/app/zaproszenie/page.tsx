import type { Metadata } from "next";
import Link from "next/link";
import { PasswordInput, SubmitButton } from "@/components/client";
import { Flash, param, type SearchParams } from "@/components/flash";
import { Logo, OPIEKUN_PHONE } from "@/components/site";
import { DefinitionList, EmptyState, Field } from "@/components/ui";
import { INVITE_TOKEN, findAuthUser } from "@/lib/accounts";
import { adminConfig, authConfig } from "@/lib/auth";
import { asAnon, asServer } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { PASSWORD_HINT } from "@/lib/password";
import { ROLE_DESCRIPTION } from "@/lib/team";
import { acceptInvitation } from "./actions";

export const metadata: Metadata = { title: "Zaproszenie do panelu – Ostoja", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Preview = { home_name: string; role: string; display_name: string; email_hint: string; status: string };

const STATUS_TEXT: Record<string, string> = {
  przyjete: "To zaproszenie zostało już przyjęte. Zaloguj się e-mailem i hasłem.",
  wygaslo: "To zaproszenie wygasło. Poproś właściciela zakładu o nowe.",
  odwolane: "To zaproszenie zostało odwołane. Poproś właściciela zakładu o nowe.",
};

export default async function InvitationPage({ searchParams }: { searchParams: SearchParams }) {
  const token = (await param(searchParams, "t")) ?? "";
  const preview = INVITE_TOKEN.test(token)
    ? await asAnon(async (tx) => {
        const [p] = await tx<Preview[]>`select * from invitation_preview(${token})`;
        return p ?? null;
      })
    : null;
  // Tryb formularza: nowa osoba ustawia hasło, osoba z kontem potwierdza swoim hasłem, wersja lokalna bez haseł.
  const withPasswords = authConfig() !== null && adminConfig() !== null;
  const hasAccount =
    preview?.status === "aktywne" && withPasswords
      ? await asServer(async (tx) => {
          const [row] = await tx<{ email: string | null }[]>`select invitation_email(${token}) as email`;
          return row?.email ? (await findAuthUser(row.email)) !== null : false;
        })
      : false;

  return (
    <main className="min-h-dvh bg-ground px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <Logo />
        <Flash searchParams={searchParams} />
        {preview?.status === "aktywne" ? (
          <form action={acceptInvitation} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-5">
            <h1 className="font-serif text-[28px] leading-tight">{preview.home_name} zaprasza Cię do panelu Ostoi</h1>
            <DefinitionList
              items={[
                { term: "Osoba", value: preview.display_name },
                { term: "E-mail", value: preview.email_hint },
                { term: "Rola", value: ROLE_LABEL[preview.role] },
              ]}
            />
            <p className="text-[15px] text-muted">{ROLE_DESCRIPTION[preview.role]}</p>
            <input type="hidden" name="token" value={token} />
            {withPasswords && hasAccount ? (
              <>
                <p className="text-[15px]">Masz już konto w Ostoi. Wpisz swoje hasło, żeby dołączyć do tego zakładu.</p>
                <Field id="password" label="Twoje hasło">
                  <PasswordInput id="password" name="password" autoComplete="current-password" />
                </Field>
                <SubmitButton full pendingLabel="Sprawdzam…">
                  Dołącz do zakładu
                </SubmitButton>
                <Link href="/logowanie/haslo" className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
                  Nie pamiętam hasła
                </Link>
              </>
            ) : withPasswords ? (
              <>
                <p className="text-[15px]">Ustaw hasło do panelu. Logujesz się potem tym adresem e-mail i hasłem.</p>
                <Field id="password" label="Hasło" hint={PASSWORD_HINT}>
                  <PasswordInput id="password" name="password" autoComplete="new-password" describedBy="password-hint" minLength={12} />
                </Field>
                <Field id="repeat" label="Powtórz hasło">
                  <PasswordInput id="repeat" name="repeat" autoComplete="new-password" minLength={12} />
                </Field>
                <SubmitButton full pendingLabel="Zapisuję…">
                  Ustaw hasło i dołącz
                </SubmitButton>
              </>
            ) : (
              <SubmitButton full pendingLabel="Przyjmuję…">
                Przyjmij zaproszenie
              </SubmitButton>
            )}
            <p className="text-[14px] text-muted">Jeśli to nie Twój adres, nie przyjmuj zaproszenia.</p>
          </form>
        ) : (
          <>
            <h1 className="sr-only">Zaproszenie do panelu</h1>
            <EmptyState title={preview ? (STATUS_TEXT[preview.status] ?? "To zaproszenie nie działa.") : "Ten link zaproszenia jest nieprawidłowy."}>
              W razie pytań zadzwoń do opiekuna partnerów Ostoi: {OPIEKUN_PHONE}.
            </EmptyState>
          </>
        )}
      </div>
    </main>
  );
}
