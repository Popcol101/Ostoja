import { describe, expect, it, vi } from "vitest";
import {
  adminConfig,
  authConfig,
  createPasswordToken,
  createUserWithPassword,
  setUserPassword,
  signInWithPassword,
  verifyPasswordToken,
} from "./auth";

const cfg = { url: "https://abc.supabase.co", anonKey: "anon" };
const admin = { url: "https://abc.supabase.co", serviceKey: "service" };
const ANNA = "00000000-0000-4000-8000-000000000001";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("konfiguracja", () => {
  it("bez SUPABASE_URL i klucza logowanie jest wyłączone", () => {
    expect(authConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(authConfig({ SUPABASE_URL: "https://x.supabase.co/", SUPABASE_ANON_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toEqual({
      url: "https://x.supabase.co",
      anonKey: "k",
    });
  });

  it("Admin API tylko z kluczem service_role", () => {
    const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k" } as unknown as NodeJS.ProcessEnv;
    expect(adminConfig(env)).toBeNull();
    expect(adminConfig({ ...env, SUPABASE_SERVICE_ROLE_KEY: "s" })).toEqual({ url: "https://x.supabase.co", serviceKey: "s" });
  });
});

describe("logowanie hasłem", () => {
  it("wysyła e-mail i hasło kluczem publicznym, zwraca konto", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { access_token: "t", user: { id: ANNA } }));
    await expect(signInWithPassword("anna@cisza.test", "dlugie haslo 123", cfg, fetcher)).resolves.toEqual({ ok: true, userId: ANNA });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://abc.supabase.co/auth/v1/token?grant_type=password");
    expect(init.headers.apikey).toBe("anon");
    expect(JSON.parse(init.body)).toEqual({ email: "anna@cisza.test", password: "dlugie haslo 123" });
  });

  it("złe hasło i brak konta dają ten sam wynik", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(400, { error_code: "invalid_credentials" }));
    await expect(signInWithPassword("x@example.com", "cokolwiek-123", cfg, fetcher)).resolves.toEqual({ ok: false, reason: "dane" });
  });

  it("zgłasza limit i awarię", async () => {
    await expect(signInWithPassword("a@b.pl", "p", cfg, vi.fn().mockResolvedValue(json(429, {})))).resolves.toEqual({ ok: false, reason: "limit" });
    await expect(signInWithPassword("a@b.pl", "p", cfg, vi.fn().mockResolvedValue(json(500, {})))).resolves.toEqual({ ok: false, reason: "blad" });
  });
});

describe("token do ustawienia hasła", () => {
  const hash = "f".repeat(56);

  it("Admin API tworzy token recovery bez wysyłki e-maila", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { id: ANNA, properties: { hashed_token: hash, verification_type: "recovery" } }));
    await expect(createPasswordToken("anna@cisza.test", admin, fetcher)).resolves.toBe(hash);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://abc.supabase.co/auth/v1/admin/generate_link");
    expect(init.headers.authorization).toBe("Bearer service");
    expect(JSON.parse(init.body)).toEqual({ type: "recovery", email: "anna@cisza.test" });
  });

  it("przyjmuje też token na najwyższym poziomie odpowiedzi; brak konta = null", async () => {
    await expect(createPasswordToken("a@b.pl", admin, vi.fn().mockResolvedValue(json(200, { hashed_token: hash })))).resolves.toBe(hash);
    await expect(createPasswordToken("a@b.pl", admin, vi.fn().mockResolvedValue(json(404, { msg: "User not found" })))).resolves.toBeNull();
  });

  it("wymiana tokenu na konto (typ recovery); zły format bez pytania serwera", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { access_token: "t", user: { id: ANNA } }));
    await expect(verifyPasswordToken(hash, cfg, fetcher)).resolves.toEqual({ ok: true, userId: ANNA });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ type: "recovery", token_hash: hash });
    await expect(verifyPasswordToken("<script>", cfg, fetcher)).resolves.toEqual({ ok: false });
    await expect(verifyPasswordToken(hash, cfg, vi.fn().mockResolvedValue(json(403, {})))).resolves.toEqual({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("konta i hasła (Admin API)", () => {
  it("zakłada potwierdzone konto z hasłem", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { id: ANNA }));
    await expect(createUserWithPassword("nowy@cisza.test", "dlugie haslo 123", admin, fetcher)).resolves.toEqual({ ok: true, userId: ANNA });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: "nowy@cisza.test", password: "dlugie haslo 123", email_confirm: true });
  });

  it("rozpoznaje istniejące konto i słabe hasło", async () => {
    await expect(createUserWithPassword("a@b.pl", "p", admin, vi.fn().mockResolvedValue(json(422, { error_code: "email_exists" })))).resolves.toEqual({
      ok: false,
      reason: "istnieje",
    });
    await expect(createUserWithPassword("a@b.pl", "p", admin, vi.fn().mockResolvedValue(json(422, { error_code: "weak_password" })))).resolves.toEqual({
      ok: false,
      reason: "slabe",
    });
  });

  it("ustawia hasło konta; odrzuca dziwne id", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(200, { id: ANNA }));
    await expect(setUserPassword(ANNA, "dlugie haslo 123", admin, fetcher)).resolves.toBe("ok");
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`https://abc.supabase.co/auth/v1/admin/users/${ANNA}`);
    expect(init.method).toBe("PUT");
    await expect(setUserPassword("../admin", "x", admin, fetcher)).resolves.toBe("blad");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
