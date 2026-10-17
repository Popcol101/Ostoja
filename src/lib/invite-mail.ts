import "server-only";
// Wysyłka zaproszenia do panelu e-mailem. Link prowadzi do strony ustawienia hasła (/zaproszenie?t=…).
// Bez skonfigurowanej poczty (lokalnie) panel pokazuje link do skopiowania – wtedy wynik „bez-poczty”.
import { invitationEmail } from "./emails";
import { mailConfig, sendMail } from "./mail";
import { inviteLink } from "./team";

export type InvitationDelivery = "wyslane" | "bez-poczty" | "blad";

export async function deliverInvitation(i: { token: string; email: string; name: string; role: string; homeName: string }): Promise<InvitationDelivery> {
  const cfg = mailConfig();
  if (!cfg) return "bez-poczty";
  const m = invitationEmail({ name: i.name, homeName: i.homeName, role: i.role, link: inviteLink(i.token) });
  return (await sendMail({ to: i.email, ...m, kind: "zaproszenie" }, cfg)) ? "wyslane" : "blad";
}
