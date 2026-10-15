// Weryfikacja numeru rodziny kodem SMS (wspólne dla akcji i strony).

/** Wersja testowa bez SMSAPI: kod trafia do ciasteczka tej przeglądarki i jest pokazywany na ekranie. */
export const DEMO_CODE_COOKIE = "ostoja_kod_testowy";

export function parseDemoCode(raw: string | undefined, draftId: string): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { d?: unknown; c?: unknown };
    return v.d === draftId && typeof v.c === "string" && /^\d{6}$/.test(v.c) ? v.c : null;
  } catch {
    return null;
  }
}

/** SMS z kodem dla rodziny. Bez polskich znaków (1 SMS = 160 znaków), bez nazwy zakładu. */
export function smsCodeText(code: string): string {
  return `Ostoja: Twoj kod to ${code}. Wpisz go na stronie, zeby zaklad mogl oddzwonic. Nie podawaj go nikomu.`;
}
