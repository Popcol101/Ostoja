import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton, SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { ShareButtons } from "@/components/share";
import { Card, CardTitle, Notice } from "@/components/ui";
import { buildObituary, shareText } from "@/lib/obituary";
import { loadPanelObituary } from "@/lib/obituary-data";
import { requireMember } from "@/lib/session";
import { publishObituary } from "../../../actions";
import { ObituaryEditor } from "./editor";

export const metadata: Metadata = { title: "Klepsydra" };
export const dynamic = "force-dynamic";

export default async function KlepsydraPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMember();
  const data = await loadPanelObituary(me.userId, id);
  if (!data) notFound();
  const canEdit = me.role !== "ekipa";
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = data.slug ? `${origin}/klepsydra/${data.slug}` : null;
  const saved = buildObituary(data.input);
  const { input } = data;
  const base = {
    ceremony: input.ceremony,
    burial: input.burial,
    firstName: input.firstName,
    lastName: input.lastName,
    bornOn: input.bornOn,
    diedAt: input.diedAt,
    events: input.events,
    homeName: input.homeName,
    homePhone: input.homePhone,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/panel/zlecenia/${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">
          ← Karta zlecenia
        </Link>
        <PrintButton label="Drukuj klepsydrę (A4)" />
      </div>
      <h1 className="font-serif text-[28px] leading-tight print:hidden">Klepsydra</h1>
      <div className="print:hidden">
        <Flash searchParams={searchParams} />
      </div>

      <ObituaryEditor
        orderId={id}
        base={{ ...base, diedAt: base.diedAt ? new Date(base.diedAt).toISOString() : null }}
        initial={data.fields}
        orderCeremony={data.orderCeremony}
        canEdit={canEdit}
      />

      <Card className="print:hidden">
        <CardTitle>Klepsydra w internecie</CardTitle>
        {data.published && data.visible && url ? (
          <div className="flex flex-col gap-4">
            <p className="text-[15px]">
              Klepsydra jest pod adresem{" "}
              <a href={url} className="break-all font-semibold text-brand" target="_blank" rel="noopener noreferrer">
                {url}
              </a>
              . Rodzina widzi ten link także na swojej stronie. Zniknie z sieci 30 dni po pogrzebie.
            </p>
            <ShareButtons url={url} text={shareText(saved)} subject={`Klepsydra – ${saved.name}`} />
            {canEdit ? (
              <form action={publishObituary}>
                <input type="hidden" name="orderId" value={id} />
                <input type="hidden" name="publish" value="nie" />
                <SubmitButton variant="secondary" pendingLabel="Wycofuję…">
                  Wycofaj z sieci
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : data.published && !data.visible ? (
          <Notice>Minęło 30 dni od pogrzebu – klepsydra nie jest już widoczna w sieci.</Notice>
        ) : canEdit && !data.saved ? (
          <p className="text-[15px]">
            Po zapisaniu treści klepsydrę można opublikować pod własnym adresem i wysłać SMS-em, e-mailem, przez WhatsApp albo udostępnić na
            Facebooku.
          </p>
        ) : canEdit ? (
          <form action={publishObituary} className="flex flex-col gap-3">
            <p className="text-[15px]">
              Opublikowana klepsydra ma własny adres do wysłania SMS-em, e-mailem, przez WhatsApp albo do udostępnienia na Facebooku. Nie
              pokazujemy w niej danych rodziny.
            </p>
            <input type="hidden" name="orderId" value={id} />
            <input type="hidden" name="publish" value="tak" />
            <label className="flex min-h-11 items-start gap-3 text-[15px]">
              <input type="checkbox" name="consent" value="tak" required className="mt-0.5 size-5 accent-brand" />
              Rodzina zgodziła się na publikację klepsydry w internecie.
            </label>
            <SubmitButton pendingLabel="Publikuję…">Opublikuj klepsydrę</SubmitButton>
          </form>
        ) : (
          <p className="text-[15px] text-muted">Klepsydrę publikuje właściciel albo biuro.</p>
        )}
      </Card>
    </div>
  );
}
