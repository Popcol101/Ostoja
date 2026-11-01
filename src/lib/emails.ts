// Treść e-maili z aplikacji. Styl jak strona: stonowane kolory, jeden przycisk, bez obrazków i śledzenia.
// Wszystko, co wpisał człowiek (nazwa zakładu, imię), jest escapowane – e-mail to HTML.
import { ROLE_LABEL } from "./labels";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function layout(paragraphs: string[], button: { href: string; label: string }, footer: string): string {
  const p = (html: string, extra = "") => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5${extra}">${html}</p>`;
  return `<div style="background:#ECEDEB;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1E2422">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #D8DAD7;border-radius:14px;padding:28px 24px">
    <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1E2422">Ostoja</p>
    ${paragraphs.map((x) => p(x)).join("\n    ")}
    <p style="margin:8px 0 24px">
      <a href="${esc(button.href)}" style="display:inline-block;background:#3F5650;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 22px;border-radius:10px">${esc(button.label)}</a>
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5C6461">Jeśli przycisk nie działa, skopiuj ten adres do przeglądarki:<br><span style="word-break:break-all">${esc(button.href)}</span></p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#5C6461">${footer}</p>
  </div>
</div>`;
}

export type InvitationEmailInput = { name: string; homeName: string; role: string; link: string; org?: "zaklad" | "uslugodawca" };

export function invitationEmail(i: InvitationEmailInput): { subject: string; html: string; text: string } {
  const role = ROLE_LABEL[i.role] ?? i.role;
  const subject = `Zaproszenie do panelu Ostoi – ${i.homeName}`;
  const html = layout(
    [
      `Dzień dobry ${esc(i.name)},`,
      i.org === "uslugodawca"
        ? `masz zaproszenie do panelu usługodawcy <strong>${esc(i.homeName)}</strong> w Ostoi (opieka nad grobami).`
        : `masz zaproszenie do panelu zakładu <strong>${esc(i.homeName)}</strong> w Ostoi (rola: ${esc(role)}).`,
      "Kliknij przycisk i ustaw hasło. Potem logujesz się tym adresem e-mail i hasłem. Link działa 7 dni i tylko raz.",
    ],
    { href: i.link, label: "Ustaw hasło i dołącz" },
    "Jeśli nie spodziewasz się tego zaproszenia, zignoruj tę wiadomość – bez ustawienia hasła konto nie powstanie.",
  );
  const text = [
    `Dzień dobry ${i.name},`,
    "",
    i.org === "uslugodawca"
      ? `masz zaproszenie do panelu usługodawcy ${i.homeName} w Ostoi (opieka nad grobami).`
      : `masz zaproszenie do panelu zakładu ${i.homeName} w Ostoi (rola: ${role}).`,
    "Otwórz link i ustaw hasło. Potem logujesz się tym adresem e-mail i hasłem. Link działa 7 dni i tylko raz.",
    "",
    i.link,
    "",
    "Jeśli nie spodziewasz się tego zaproszenia, zignoruj tę wiadomość.",
  ].join("\n");
  return { subject, html, text };
}

export function passwordEmail(link: string): { subject: string; html: string; text: string } {
  const subject = "Ustaw hasło do panelu Ostoi";
  const html = layout(
    ["Dzień dobry,", "ktoś – najpewniej Ty – poprosił o ustawienie nowego hasła do panelu Ostoi. Link działa godzinę i tylko raz."],
    { href: link, label: "Ustaw nowe hasło" },
    "Jeśli to nie Ty, zignoruj tę wiadomość – hasło się nie zmieni.",
  );
  const text = [
    "Dzień dobry,",
    "",
    "ktoś – najpewniej Ty – poprosił o ustawienie nowego hasła do panelu Ostoi. Link działa godzinę i tylko raz.",
    "",
    link,
    "",
    "Jeśli to nie Ty, zignoruj tę wiadomość – hasło się nie zmieni.",
  ].join("\n");
  return { subject, html, text };
}

export type GraveOrderEmailInput = { name: string; deceased: string; cemetery: string; total: string; firstOn: string; frequency: string; link: string };

export function graveOrderEmail(i: GraveOrderEmailInput): { subject: string; html: string; text: string } {
  const subject = `Potwierdzenie zamówienia – opieka nad grobem (${i.deceased})`;
  const lines = [
    `Dzień dobry ${i.name},`,
    `dziękujemy za zamówienie opieki nad grobem: ${i.deceased}, ${i.cemetery}.`,
    `Pierwsza wizyta: ${i.firstOn}. Częstotliwość: ${i.frequency}. Zapłacono: ${i.total}.`,
    "Po każdej wizycie dodamy zdjęcie grobu. Zobaczysz je pod linkiem poniżej – zachowaj tę wiadomość.",
  ];
  const html = layout(lines.map(esc), { href: i.link, label: "Zobacz zamówienie i zdjęcia" }, "Link jest tylko dla Ciebie. Nie udostępniaj go publicznie.");
  const text = [...lines, "", i.link].join("\n");
  return { subject, html, text };
}

export function graveVisitEmail(i: { name: string; deceased: string; link: string }): { subject: string; html: string; text: string } {
  const subject = `Wizyta przy grobie wykonana – ${i.deceased}`;
  const lines = [`Dzień dobry ${i.name},`, `byliśmy przy grobie: ${i.deceased}. Zdjęcie po wizycie jest już pod Twoim linkiem.`];
  const html = layout(lines.map(esc), { href: i.link, label: "Zobacz zdjęcie" }, "Link jest tylko dla Ciebie. Nie udostępniaj go publicznie.");
  return { subject, html, text: [...lines, "", i.link].join("\n") };
}
