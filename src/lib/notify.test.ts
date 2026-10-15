import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ sql: vi.fn() }));

const { pushPayload, sendSms, smsNumber, smsText } = await import("./notify");

describe("treść powiadomień", () => {
  it("push nie zawiera danych rodziny, tylko rodzaj pogrzebu i miejsce", () => {
    const p = pushPayload({ burial: "kremacja", ceremony: "religijna", city_name: "Łódź", distance_km: 1.5 });
    expect(p.title).toBe("Nowe zapytanie – odpowiedz w 15 minut");
    expect(p.body).toBe("Kremacja, ceremonia religijna · Łódź, 1,5 km");
    expect(p.url).toBe("/panel/zapytania");
  });

  it("SMS podpisuje zakład i zawiera link oraz telefon zakładu", () => {
    const t = smsText({ home_name: "Dom Pogrzebowy Cisza", home_phone: "+48 600 000 001", family_token: "abc" }, "https://ostoja.example/");
    expect(t).toBe("Dzień dobry, tu Dom Pogrzebowy Cisza. Terminy, koszty i dane do dokumentów: https://ostoja.example/r/abc Pytania: +48 600 000 001");
  });

  it("numer telefonu w formacie SMSAPI", () => {
    expect(smsNumber("+48 600 100 200")).toBe("48600100200");
    expect(smsNumber("600100200")).toBe("48600100200");
    expect(smsNumber("12345")).toBeNull();
  });
});

describe("SMSAPI", () => {
  const cfg = { token: "t", sender: "Cisza", test: true };

  it("wysyła z tokenem, w UTF-8 i w trybie testowym", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ count: 1, list: [{ id: "1" }] })));
    await expect(sendSms("48600100200", "Treść", cfg, fetcher)).resolves.toEqual({ status: "wyslano" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.smsapi.pl/sms.do");
    expect(init.headers.authorization).toBe("Bearer t");
    const body = init.body as URLSearchParams;
    expect(body.get("encoding")).toBe("utf-8");
    expect(body.get("test")).toBe("1");
    expect(body.get("from")).toBe("Cisza");
  });

  it("zły numer nie jest ponawiany, awaria serwera tak", async () => {
    const bad = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 13, message: "Lack of valid recipients" })));
    await expect(sendSms("48000", "x", cfg, bad)).resolves.toMatchObject({ status: "pominieto" });
    const down = vi.fn().mockResolvedValue(new Response("oops", { status: 503 }));
    await expect(sendSms("48600100200", "x", cfg, down)).resolves.toMatchObject({ status: "blad" });
  });
});
