import { Mail, MessageSquare } from "lucide-react";
import { CopyButton } from "./client";
import { Card, CardTitle, LinkButton } from "./ui";

/** Świeżo utworzony link zaproszenia: kopiowanie, SMS, e-mail. Token pokazujemy tylko raz, zaraz po utworzeniu. */
export function InviteLinkCard({ url, name, email, homeName }: { url: string; name: string; email: string; homeName: string }) {
  const message = `Dzień dobry, zapraszam Cię do panelu Ostoi (${homeName}). Otwórz link i ustaw hasło: ${url}`;
  return (
    <Card className="mb-4 border-brand">
      <CardTitle>Link zaproszenia dla: {name}</CardTitle>
      <p className="mb-3 text-[15px] text-muted">
        Wyślij go tylko tej osobie. Link jest ważny 7 dni i działa raz. Po otwarciu ta osoba ustawi hasło i będzie logować się adresem {email}.
      </p>
      <p className="mb-3 break-all rounded-[10px] bg-ground-family px-3 py-2.5 font-mono text-[13px]">{url}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={url} />
        <LinkButton variant="secondary" href={`sms:?body=${encodeURIComponent(message)}`} prefetch={false}>
          <MessageSquare size={18} aria-hidden="true" /> Wyślij SMS-em
        </LinkButton>
        <LinkButton
          variant="secondary"
          href={`mailto:${email}?subject=${encodeURIComponent("Zaproszenie do panelu Ostoi")}&body=${encodeURIComponent(message)}`}
          prefetch={false}
        >
          <Mail size={18} aria-hidden="true" /> Wyślij e-mailem
        </LinkButton>
      </div>
    </Card>
  );
}

export function parseInviteCookie(raw: string | undefined): { token: string; name: string; email: string } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { token?: unknown; name?: unknown; email?: unknown };
    if (typeof v.token === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(v.token) && typeof v.name === "string" && typeof v.email === "string") {
      return { token: v.token, name: v.name, email: v.email };
    }
  } catch {}
  return null;
}
