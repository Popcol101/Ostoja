import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

beforeAll(() => {
  process.env.INTEGRATIONS_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("szyfrowanie sekretów zakładów", async () => {
  const { decryptSecret, encryptSecret, integrationsEnabled } = await import("./crypto");

  it("szyfruje i odszyfrowuje, za każdym razem inny szyfrogram", () => {
    const a = encryptSecret("klucz-api-123", "home-1");
    const b = encryptSecret("klucz-api-123", "home-1");
    expect(a).not.toBe(b);
    expect(a).not.toContain("klucz-api-123");
    expect(decryptSecret(a, "home-1")).toBe("klucz-api-123");
    expect(integrationsEnabled()).toBe(true);
  });

  it("sekretu jednego zakładu nie da się odczytać jako sekretu innego", () => {
    const a = encryptSecret("klucz", "home-1");
    expect(() => decryptSecret(a, "home-2")).toThrow();
  });

  it("odrzuca zmieniony szyfrogram", () => {
    const [v, iv, tag, data] = encryptSecret("klucz", "home-1").split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."), "home-1")).toThrow();
  });
});
