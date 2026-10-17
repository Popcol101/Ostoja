import { describe, expect, it, vi } from "vitest";
import { invitationEmail, passwordEmail } from "./emails";
import { mailConfig, sendMail } from "./mail";
import { PASSWORD_MESSAGE, isPwned, passwordProblem } from "./password";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe("konfiguracja poczty", () => {
  it("bez klucza i nadawcy wysyłka wyłączona", () => {
    expect(mailConfig(env({}))).toBeNull();
    expect(mailConfig(env({ BREVO_API_KEY: "k" }))).toBeNull();
    expect(mailConfig(env({ BREVO_API_KEY: "k", MAIL_FROM: "logowanie@ostoja.org" }))).toEqual({
      apiKey: "k",
      apiUrl: "https://api.brevo.com",
      from: "logowanie@ostoja.org",
      fromName: "Ostoja",
    });
  });
});

describe("wysyłka przez Brevo", () => {
  const cfg = { apiKey: "klucz", apiUrl: "https://api.brevo.com", from: "logowanie@ostoja.org", fromName: "Ostoja" };

  it("wysyła HTML i tekst z kluczem w nagłówku", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    await expect(sendMail({ to: "a@b.pl", subject: "T", html: "<p>x</p>", text: "x", kind: "zaproszenie" }, cfg, fetcher)).resolves.toBe(true);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("klucz");
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: "logowanie@ostoja.org", name: "Ostoja" },
      to: [{ email: "a@b.pl" }],
      subject: "T",
      htmlContent: "<p>x</p>",
      textContent: "x",
      tags: ["zaproszenie"],
    });
  });

  it("błąd i brak sieci = false, bez adresu w logach", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendMail({ to: "tajny@b.pl", subject: "T", html: "", text: "", kind: "haslo" }, cfg, vi.fn().mockResolvedValue(new Response("", { status: 401 })))).resolves.toBe(false);
    await expect(sendMail({ to: "tajny@b.pl", subject: "T", html: "", text: "", kind: "haslo" }, cfg, vi.fn().mockRejectedValue(new TypeError("fetch failed")))).resolves.toBe(false);
    expect(log.mock.calls.flat().join(" ")).not.toContain("tajny");
    log.mockRestore();
  });
});

describe("treść e-maili", () => {
  it("zaproszenie: nazwa zakładu i imię są escapowane, link w przycisku i w tekście", () => {
    const m = invitationEmail({ name: "<b>Marek</b>", homeName: 'Kalina & "Syn"', role: "biuro", link: "https://ostoja.org/zaproszenie?t=abc" });
    expect(m.subject).toBe('Zaproszenie do panelu Ostoi – Kalina & "Syn"');
    expect(m.html).toContain("&lt;b&gt;Marek&lt;/b&gt;");
    expect(m.html).toContain("Kalina &amp; &quot;Syn&quot;");
    expect(m.html).not.toContain("<b>Marek");
    expect(m.html).toContain('href="https://ostoja.org/zaproszenie?t=abc"');
    expect(m.html).toContain("rola: Biuro");
    expect(m.text).toContain("https://ostoja.org/zaproszenie?t=abc");
    expect(m.html).not.toMatch(/<img/);
  });

  it("zmiana hasła", () => {
    const m = passwordEmail("https://ostoja.org/logowanie/nowe-haslo?token_hash=xyz");
    expect(m.subject).toBe("Ustaw hasło do panelu Ostoi");
    expect(m.html).toContain("Ustaw nowe hasło");
    expect(m.text).toContain("token_hash=xyz");
  });
});

describe("hasło", () => {
  it("co najmniej 12 znaków (liczone jak litery, także polskie), najwyżej 72 bajty", () => {
    expect(passwordProblem("krótkie", "krótkie")).toBe("za-krotkie");
    expect(passwordProblem("żółć gęślą1", null)).toBe("za-krotkie");
    expect(passwordProblem("żółć gęślą 12", null)).toBeNull();
    expect(passwordProblem("ą".repeat(40), null)).toBe("za-dlugie");
    expect(passwordProblem("x".repeat(72), null)).toBeNull();
  });

  it("powtórzenie i adres e-mail", () => {
    expect(passwordProblem("trzy zielone kubki", "trzy zielone kubkI")).toBe("rozne");
    expect(passwordProblem("anna@cisza.test", "anna@cisza.test", "Anna@Cisza.test")).toBe("jak-email");
    expect(PASSWORD_MESSAGE["za-krotkie"]).toBe("Hasło musi mieć co najmniej 12 znaków.");
  });

  it("baza wycieków: wysyła tylko 5 znaków skrótu i rozpoznaje hasło", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const prefix = url.split("/").pop()!;
      expect(prefix).toHaveLength(5);
      const { createHash } = await import("node:crypto");
      const suffix = createHash("sha1").update("password123456").digest("hex").toUpperCase().slice(5);
      return new Response(`0000000000000000000000000000000000A:0\r\n${suffix}:123\r\n`, { status: 200 });
    });
    await expect(isPwned("password123456", fetcher as unknown as typeof fetch, env({}))).resolves.toBe(true);
    expect(fetcher.mock.calls[0][0]).toMatch(/\/range\/[0-9A-F]{5}$/);
  });

  it("wpis z licznikiem 0 (dopełnienie) nie jest wyciekiem; awaria sieci przepuszcza; można wyłączyć", async () => {
    const { createHash } = await import("node:crypto");
    const suffix = createHash("sha1").update("moje bezpieczne haslo").digest("hex").toUpperCase().slice(5);
    await expect(isPwned("moje bezpieczne haslo", vi.fn().mockResolvedValue(new Response(`${suffix}:0`)), env({}))).resolves.toBe(false);
    await expect(isPwned("x", vi.fn().mockRejectedValue(new Error("timeout")), env({}))).resolves.toBe(false);
    const fetcher = vi.fn();
    await expect(isPwned("x", fetcher, env({ PWNED_CHECK: "off" }))).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
