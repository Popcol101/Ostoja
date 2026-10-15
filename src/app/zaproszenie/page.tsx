import type { Metadata } from "next";
import { SubmitButton } from "@/components/client";
import { Flash, param, type SearchParams } from "@/components/flash";
import { Logo, OPIEKUN_PHONE } from "@/components/site";
import { DefinitionList, EmptyState } from "@/components/ui";
import { INVITE_TOKEN } from "@/lib/accounts";
import { asAnon } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { ROLE_DESCRIPTION } from "@/lib/team";
import { acceptInvitation } from "./actions";

export const metadata: Metadata = { title: "Zaproszenie do panelu – Ostoja", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Preview = { home_name: string; role: string; display_name: string; email_hint: string; status: string };

const STATUS_TEXT: Record<string, string> = {
  przyjete: "To zaproszenie zostało już przyjęte. Zaloguj się linkiem z e-maila.",
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
            <SubmitButton full pendingLabel="Przyjmuję…">
              Przyjmij zaproszenie
            </SubmitButton>
            <p className="text-[14px] text-muted">
              Logujesz się linkiem wysłanym na ten e-mail, bez hasła. Jeśli to nie Twój adres, nie przyjmuj zaproszenia.
            </p>
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
