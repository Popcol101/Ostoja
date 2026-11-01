import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/client";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Card, CardTitle, Notice } from "@/components/ui";
import { gravePaymentsMode, payGraveOrderTest } from "@/app/groby-actions";
import { asAnon } from "@/lib/db";
import { formatPln } from "@/lib/format";

export const metadata: Metadata = { title: "Płatność – opieka nad grobem", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Bramka płatności w trybie testowym. Po podpisaniu umowy z operatorem (Przelewy24 albo Stripe) ta strona przekieruje
// do operatora, a opłacenie potwierdzi powiadomienie od niego (webhook) – mark_grave_order_paid przyjmuje już nazwę i numer płatności.
export default async function TestPaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  const [row] = await asAnon((tx) => tx<{ o: { status: string; total_pln: number; deceased_name: string } | null }[]>`select grave_order_by_token(${token}) as o`);
  if (!row?.o) notFound();
  if (row.o.status !== "do_zaplaty" || (await gravePaymentsMode()) !== "test") redirect(`/usluga/${token}`);

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Card>
          <CardTitle>Płatność</CardTitle>
          <Notice tone="warn" title="Płatność testowa">
            To wersja testowa. Nie podajesz danych karty i nic nie zostanie pobrane.
          </Notice>
          <p className="mt-4 text-[15px] text-muted">Opieka nad grobem: {row.o.deceased_name}</p>
          <p className="text-[28px] font-semibold">{formatPln(row.o.total_pln)}</p>
          <form action={payGraveOrderTest} className="mt-4">
            <input type="hidden" name="token" value={token} />
            <SubmitButton full pendingLabel="Płacę…">
              Zapłać {formatPln(row.o.total_pln)} (test)
            </SubmitButton>
          </form>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
