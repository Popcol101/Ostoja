import { describe, expect, it } from "vitest";
import { parseDemoCode, smsCodeText } from "./phone";

describe("kod SMS dla rodziny", () => {
  it("mieści się w jednym SMS-ie bez polskich znaków", () => {
    const text = smsCodeText("123456");
    expect(text).toContain("123456");
    expect(text.length).toBeLessThanOrEqual(160);
    expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
  });

  it("kod z ciasteczka wersji testowej tylko dla tego samego formularza", () => {
    const raw = JSON.stringify({ d: "abc", c: "004211" });
    expect(parseDemoCode(raw, "abc")).toBe("004211");
    expect(parseDemoCode(raw, "inny")).toBeNull();
    expect(parseDemoCode('{"d":"abc","c":"12"}', "abc")).toBeNull();
    expect(parseDemoCode("zepsute", "abc")).toBeNull();
    expect(parseDemoCode(undefined, "abc")).toBeNull();
  });
});
