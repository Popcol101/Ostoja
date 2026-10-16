import { describe, expect, it } from "vitest";
import { fingerprint, normalizePath, scrubMessage } from "./error-report";

describe("zgłoszenia błędów bez danych osobowych", () => {
  it("usuwa telefony, PESEL, e-maile i tokeny z komunikatu", () => {
    const s = scrubMessage(
      "Nie wysłano SMS do +48 600 100 200 (anna.kowalska@example.com), PESEL 85010112345, token Zx9_Ab12Cd34Ef56Gh78Ij90",
    );
    expect(s).not.toMatch(/600|100 200|anna|kowalska|85010112345|Zx9_/);
    expect(s).toContain("[liczba]");
    expect(s).toContain("[e-mail]");
    expect(s).toContain("[token]");
  });

  it("zostawia zwykły opis błędu i skraca do 300 znaków", () => {
    expect(scrubMessage('relation "orders" does not exist')).toBe('relation "orders" does not exist');
    expect(scrubMessage("x".repeat(1000)).length).toBeLessThanOrEqual(300);
  });

  it("zamienia identyfikatory i tokeny w adresie na znaczniki", () => {
    expect(normalizePath("/panel/zlecenia/3f1c2a4e-1b2c-4d5e-8f90-123456789abc?ok=x")).toBe("/panel/zlecenia/[id]");
    expect(normalizePath("/r/demo-rodzina-mazur-0000000000000000000000000000")).toBe("/r/[token]");
    expect(normalizePath("/zaproszenie?t=abcdef")).toBe("/zaproszenie");
    expect(normalizePath("/pamiec/halina-nowak")).toBe("/pamiec/[slug]");
    expect(normalizePath("/panel/kalendarz")).toBe("/panel/kalendarz");
  });

  it("ten sam błąd na tej samej trasie ma ten sam odcisk", () => {
    expect(fingerprint("serwer", "/panel/zlecenia/[id]", "boom")).toBe(fingerprint("serwer", "/panel/zlecenia/[id]", "boom"));
    expect(fingerprint("serwer", "/a", "boom")).not.toBe(fingerprint("serwer", "/b", "boom"));
  });
});
