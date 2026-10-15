import type { Metadata } from "next";
import { SubmitButton } from "@/components/client";
import { param, type SearchParams } from "@/components/flash";
import { Logo } from "@/components/site";
import { EmptyState, LinkButton } from "@/components/ui";
import { TOKEN_HASH } from "@/lib/auth";
import { confirmLoginLink } from "../actions";

export const metadata: Metadata = { title: "Potwierdź logowanie", robots: { index: false } };
export const dynamic = "force-dynamic";

// Link z e-maila otwiera tę stronę, a logowanie następuje dopiero po kliknięciu przycisku.
// Dzięki temu skanery poczty (np. Outlook), które same otwierają linki, nie zużywają jednorazowego linku.
export default async function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const tokenHash = (await param(searchParams, "token_hash")) ?? "";
  const valid = TOKEN_HASH.test(tokenHash);

  return (
    <main className="min-h-dvh bg-ground px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <Logo />
        {valid ? (
          <form action={confirmLoginLink} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-5">
            <h1 className="font-serif text-[28px] leading-tight">Zaloguj się do panelu</h1>
            <p className="text-muted">Link jest jednorazowy i działa godzinę.</p>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <SubmitButton full pendingLabel="Loguję…">
              Zaloguj się
            </SubmitButton>
          </form>
        ) : (
          <EmptyState title="Ten link jest nieprawidłowy." action={<LinkButton href="/logowanie">Poproś o nowy link</LinkButton>}>
            Skopiuj cały link z e-maila albo poproś o nowy.
          </EmptyState>
        )}
      </div>
    </main>
  );
}
