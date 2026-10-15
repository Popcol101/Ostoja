import { describe, expect, it } from "vitest";
import { addDays, dayKey, formatBankAccount, formatPln, mondayOf, plural, slugify, warsawToUtc } from "./format";

describe("formatPln", () => {
  it("formatuje kwoty po polsku bez groszy", () => {
    expect(formatPln(5790)).toBe("5\u00a0790\u00a0zł");
    expect(formatPln(null)).toBe("—");
  });
});

describe("plural", () => {
  it("odmienia liczebniki", () => {
    expect(plural(1, "zlecenie", "zlecenia", "zleceń")).toBe("zlecenie");
    expect(plural(3, "zlecenie", "zlecenia", "zleceń")).toBe("zlecenia");
    expect(plural(5, "zlecenie", "zlecenia", "zleceń")).toBe("zleceń");
    expect(plural(12, "zlecenie", "zlecenia", "zleceń")).toBe("zleceń");
    expect(plural(22, "zlecenie", "zlecenia", "zleceń")).toBe("zlecenia");
  });
});

describe("warsawToUtc", () => {
  it("uwzględnia czas letni", () => {
    expect(warsawToUtc("2026-07-10", "11:00").toISOString()).toBe("2026-07-10T09:00:00.000Z");
  });
  it("uwzględnia czas zimowy", () => {
    expect(warsawToUtc("2026-12-10", "11:00").toISOString()).toBe("2026-12-10T10:00:00.000Z");
  });
  it("działa w dniu zmiany czasu w październiku", () => {
    // 25 października 2026 r. zegary cofa się z 3:00 na 2:00.
    expect(warsawToUtc("2026-10-25", "12:00").toISOString()).toBe("2026-10-25T11:00:00.000Z");
    expect(warsawToUtc("2026-10-24", "12:00").toISOString()).toBe("2026-10-24T10:00:00.000Z");
  });
});

describe("daty", () => {
  it("liczy dzień w strefie Warszawy", () => {
    expect(dayKey(new Date("2026-10-15T22:30:00Z"))).toBe("2026-10-16");
  });
  it("znajduje poniedziałek tygodnia", () => {
    expect(mondayOf("2026-10-15")).toBe("2026-10-12");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("slugify i konto", () => {
  it("tworzy adres strony pamięci bez polskich znaków", () => {
    expect(slugify("Stanisław Żółkiewski")).toBe("stanislaw-zolkiewski");
  });
  it("formatuje numer konta", () => {
    expect(formatBankAccount("12345678901234567890123456")).toBe("12 3456 7890 1234 5678 9012 3456");
  });
});
