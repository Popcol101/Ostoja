// Wysyłka e-maili z aplikacji przez API Brevo (zaproszenia do panelu, linki do ustawienia hasła).
// Klucz tylko po stronie serwera (BREVO_API_KEY, nigdy NEXT_PUBLIC_). Bez klucza wysyłka jest wyłączona,
// a panel pokazuje link zaproszenia do skopiowania (wersja lokalna i testowa).
// W logach nie zapisujemy adresów ani treści – tylko rodzaj wiadomości i kod odpowiedzi.

export type MailConfig = { apiKey: string; apiUrl: string; from: string; fromName: string };

export function mailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig | null {
  const apiKey = env.BREVO_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return {
    apiKey,
    apiUrl: (env.BREVO_API_URL?.trim() || "https://api.brevo.com").replace(/\/+$/, ""),
    from,
    fromName: env.MAIL_FROM_NAME?.trim() || "Ostoja",
  };
}

export function mailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return mailConfig(env) !== null;
}

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Rodzaj wiadomości – trafia do Brevo jako tag i do logów zamiast adresu. */
  kind: "zaproszenie" | "haslo";
};

export async function sendMail(mail: Mail, cfg: MailConfig, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetcher(`${cfg.apiUrl}/v3/smtp/email`, {
      method: "POST",
      headers: { "api-key": cfg.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: cfg.from, name: cfg.fromName },
        to: [{ email: mail.to }],
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
        tags: [mail.kind],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[mail] ${mail.kind}: Brevo odpowiedział ${res.status}`);
    return res.ok;
  } catch (error) {
    console.error(`[mail] ${mail.kind}: brak połączenia z Brevo (${error instanceof Error ? error.name : "błąd"})`);
    return false;
  }
}
