import { describe, expect, it, vi } from "vitest";
import { authConfig, requestMagicLink, verifyMagicLink } from "./auth";

const cfg = { url: "https://abc.supabase.co", anonKey: "anon" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("konfiguracja", () => {
  it("bez SUPABASE_URL i klucza logowanie linkiem jest wyłączone", () => {
    expect(authConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(authConfig({ SUPABASE_URL: "https://x.supabase.co/", SUPABASE_ANON_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toEqual({
      url: "https://x.supabase.co",
      anonKey: "k",
    });
  });
});

describe("wysyłka linku", () => {
  it("nie tworzy nowych kont i wysyła klucz publiczny", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, {}));
    await expect(requestMagicLink("anna@cisza.test", cfg, fetcher)).resolves.toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://abc.supabase.co/auth/v1/otp");
    expect(JSON.parse(init.body)).toEqual({ email: "anna@cisza.test", create_user: false });
    expect(init.headers.apikey).toBe("anon");
  });

  it("nie zdradza, że konta nie ma", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(422, { msg: "Signups not allowed for otp" }));
    await expect(requestMagicLink("obcy@example.com", cfg, fetcher)).resolves.toEqual({ ok: true });
  });

  it("zgłasza limit wysyłki", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(429, {}));
    await expect(requestMagicLink("anna@cisza.test", cfg, fetcher)).resolves.toEqual({ ok: false, reason: "limit" });
  });
});

describe("potwierdzenie linku", () => {
  const hash = "a".repeat(56);

  it("zwraca identyfikator użytkownika", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { access_token: "t", user: { id: "00000000-0000-4000-8000-000000000001" } }));
    await expect(verifyMagicLink(hash, cfg, fetcher)).resolves.toEqual({ ok: true, userId: "00000000-0000-4000-8000-000000000001" });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ type: "email", token_hash: hash });
  });

  it("odrzuca wygasły link i dziwny format bez pytania serwera", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(403, { msg: "Token has expired" }));
    await expect(verifyMagicLink(hash, cfg, fetcher)).resolves.toEqual({ ok: false });
    await expect(verifyMagicLink("<script>", cfg, fetcher)).resolves.toEqual({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
