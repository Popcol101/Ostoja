// Wspólne dla zespołu zakładu (strona i akcje).

/** Ciasteczko z linkiem świeżo utworzonego zaproszenia – token w jawnej postaci istnieje tylko przez chwilę. */
export const INVITE_COOKIE = "ostoja_zaproszenie";

export const ROLE_DESCRIPTION: Record<string, string> = {
  wlasciciel: "Wszystko w panelu, także zespół, profil i cennik.",
  biuro: "Zapytania, zlecenia, kalendarz, profil i cennik. Bez zarządzania zespołem.",
  ekipa: "Zapytania, zlecenia i kalendarz. Bez zmian w profilu i cenniku.",
};

export function inviteLink(token: string, appUrl = process.env.APP_URL ?? "http://localhost:3000"): string {
  return `${appUrl.replace(/\/+$/, "")}/zaproszenie?t=${token}`;
}
