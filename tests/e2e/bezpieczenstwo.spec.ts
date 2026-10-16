import { expect, test } from "@playwright/test";

// CSP z nonce: skrypty Next.js działają, a obcy skrypt wstrzyknięty w stronę się nie wykona.

test("strony działają pod ścisłą CSP i nie zgłaszają naruszeń", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to (execute|load)/i.test(msg.text())) violations.push(msg.text());
  });

  const res = await page.goto("/");
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");

  // Nawigacja po stronie (router klienta) i interakcja w panelu wymagają działających skryptów.
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna Cichońska/ }).click();
  await page.waitForURL(/\/panel\/zapytania/);
  await page.getByRole("link", { name: "Kalendarz" }).first().click();
  await expect(page).toHaveURL(/\/panel\/kalendarz/);

  // Typowy wektor XSS – atrybut zdarzenia we wstrzykniętym HTML – jest blokowany (brak 'unsafe-inline').
  const ran = await page.evaluate(async () => {
    const box = document.createElement("div");
    box.innerHTML = '<img src="/nie-ma-takiego-obrazka.png" onerror="window.__wstrzykniety = true">';
    document.body.appendChild(box);
    await new Promise((r) => setTimeout(r, 300));
    return (window as unknown as { __wstrzykniety?: boolean }).__wstrzykniety === true;
  });
  expect(ran).toBe(false);
  // Jedyne naruszenie to zablokowany wstrzyknięty atrybut zdarzenia.
  expect(violations.filter((v) => !/inline event handler|script-src-attr/i.test(v))).toEqual([]);

  // Każda odpowiedź ma inny nonce.
  const again = await page.request.get("/");
  expect(again.headers()["content-security-policy"]).not.toBe(csp);
});
