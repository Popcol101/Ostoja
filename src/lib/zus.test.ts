import { describe, expect, it } from "vitest";
import { claimDeadline, missingForClaim, validPesel, zusClaimSchema } from "./zus";

describe("wniosek o zasiłek pogrzebowy", () => {
  it("PESEL: suma kontrolna i data", () => {
    expect(validPesel("44051401458")).toBe(true); // przykład z dokumentacji MSWiA
    expect(validPesel("02070803628")).toBe(true);
    expect(validPesel("44051401459")).toBe(false);
    expect(validPesel("4405140145")).toBe(false);
    expect(validPesel("44143101450")).toBe(false); // 31 dzień 14 (=kwietnia) nie istnieje… i zła suma
  });

  it("termin: 12 miesięcy od dnia śmierci, także dla 29 lutego", () => {
    expect(claimDeadline("2026-10-31")).toBe("2027-10-31");
    expect(claimDeadline("2028-02-29")).toBe("2029-02-28");
  });

  it("formularz: PESEL bez spacji, część zasiłku wymaga kwoty", () => {
    const base = { orderId: "00000000-0000-4000-d000-000000000003", costs_covered: "calosc", payout_to_home: "brak" };
    expect(zusClaimSchema.parse({ ...base, applicant_pesel: "440 514 014 58" }).applicant_pesel).toBe("44051401458");
    expect(zusClaimSchema.safeParse({ ...base, applicant_pesel: "44051401459" }).success).toBe(false);
    expect(zusClaimSchema.safeParse({ ...base, payout_to_home: "czesc", payout_home_pln: "" }).success).toBe(false);
    expect(zusClaimSchema.parse({ ...base, payout_to_home: "czesc", payout_home_pln: "4 640,50" }).payout_home_pln).toBe(4640.5);
  });

  it("lista braków", () => {
    const missing = missingForClaim({
      claim: null,
      deceasedName: true,
      diedAt: true,
      applicantAddress: false,
      applicantAccount: false,
      invoice: false,
      homeRegon: false,
      homeAccount: false,
    });
    expect(missing).toContain("Adres osoby, która pokryła koszty");
    expect(missing).toContain("Faktura lub rachunek za pogrzeb");
    expect(missing).not.toContain("Data zgonu");
  });
});
