import type { Metadata } from "next";
import { PasswordInput, SubmitButton } from "@/components/client";
import { Flash, param, type SearchParams } from "@/components/flash";
import { Logo } from "@/components/site";
import { EmptyState, Field, LinkButton } from "@/components/ui";
import { TOKEN_HASH } from "@/lib/auth";
import { PASSWORD_HINT } from "@/lib/password";
import { setNewPassword } from "../actions";

export const metadata: Metadata = { title: "Nowe hasło", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

// Link z e-maila otwiera tę stronę, a token wymieniamy dopiero po wysłaniu formularza.
// Skanery poczty, które same otwierają linki, nie zużyją więc jednorazowego linku.
export default async function NewPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const tokenHash = (await param(searchParams, "token_hash")) ?? "";
  const valid = TOKEN_HASH.test(tokenHash);

  return (
    <main className="min-h-dvh bg-ground px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <Logo />
        <Flash searchParams={searchParams} />
        {valid ? (
          <form action={setNewPassword} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-5">
            <h1 className="font-serif text-[28px] leading-tight">Ustaw nowe hasło</h1>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <Field id="password" label="Nowe hasło" hint={PASSWORD_HINT}>
              <PasswordInput id="password" name="password" autoComplete="new-password" describedBy="password-hint" minLength={12} />
            </Field>
            <Field id="repeat" label="Powtórz hasło">
              <PasswordInput id="repeat" name="repeat" autoComplete="new-password" minLength={12} />
            </Field>
            <SubmitButton full pendingLabel="Zapisuję…">
              Zapisz hasło i zaloguj się
            </SubmitButton>
          </form>
        ) : (
          <EmptyState title="Ten link jest nieprawidłowy." action={<LinkButton href="/logowanie/haslo">Poproś o nowy link</LinkButton>}>
            Skopiuj cały link z e-maila albo poproś o nowy.
          </EmptyState>
        )}
      </div>
    </main>
  );
}
