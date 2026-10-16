import { expect, test, type Page } from "@playwright/test";

// Wstrzymanie zakładu z uzasadnieniem i odwołanie (P2B): administratorka → właścicielka → administratorka.

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function loginAs(page: Page, who: RegExp) {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: who }).click();
  await page.waitForURL(/\/(admin|panel)/);
}

const REASON = "W październiku dwie rodziny dostały kosztorys o 800 zł wyższy niż cena pokazana w Ostoi.";

test("wstrzymanie z uzasadnieniem, odwołanie zakładu i przywrócenie", async ({ page, browser }) => {
  await loginAs(page, /Ola Maj/);
  await page.getByRole("link", { name: /Zakład Pogrzebowy Kalina/ }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Podstawa z zasad dla partnerów").selectOption("ceny");
  await page.getByLabel("Uzasadnienie dla zakładu").fill(REASON);
  await page.getByRole("button", { name: "Wstrzymaj zakład" }).click();
  await expect(page.getByText("Zakład wstrzymany. Uzasadnienie widzi właściciel", { exact: false })).toBeVisible();
  await expect(page.getByText(REASON).first()).toBeVisible(); // historia statusu (w drugim projekcie dwa wpisy)
  await shot(page, "28-admin-wstrzymanie");

  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await loginAs(owner, /Katarzyna Kalinowska/);
  await expect(owner.getByText("Zakład jest wstrzymany.")).toBeVisible();
  await owner.getByRole("link", { name: "Uzasadnienie i odwołanie" }).click();
  await expect(owner.getByRole("heading", { name: "Status zakładu" })).toBeVisible();
  await expect(owner.getByText(REASON)).toBeVisible();
  await expect(owner.getByText("Ceny lub kosztorysy niezgodne z cennikiem w Ostoi (pkt 2)")).toBeVisible();
  await owner.getByLabel("Dlaczego decyzja jest błędna?").fill(
    "Obie rodziny zamówiły dodatkowo przewóz z innego miasta i podpisały aneks. Mamy oba aneksy.",
  );
  await owner.getByRole("button", { name: "Wyślij odwołanie" }).click();
  await expect(owner.getByText("Odwołanie wysłane.", { exact: false })).toBeVisible();
  await expect(owner.getByText("Czeka na odpowiedź")).toBeVisible();
  await shot(owner, "29-panel-wstrzymanie");

  await page.goto("/admin/odwolania");
  await page.waitForLoadState("networkidle");
  const card = page.locator("li", { hasText: "Zakład Pogrzebowy Kalina" }).first();
  await expect(card.getByText("Obie rodziny zamówiły", { exact: false })).toBeVisible();
  await card.getByLabel("Przywracam zakład na listę ofert").check();
  await card.getByLabel("Odpowiedź dla zakładu").fill("Aneksy potwierdzają zgodę rodzin na dopłatę. Przywracamy zakład na listę ofert.");
  await shot(page, "30-admin-odwolania");
  await card.getByRole("button", { name: "Zapisz odpowiedź" }).click();
  await expect(page.getByText("Odpowiedź zapisana. Zakład widzi ją w panelu.")).toBeVisible();

  await owner.reload();
  await expect(owner.getByText("Zakład przywrócony")).toBeVisible();
  await expect(owner.getByText("Aneksy potwierdzają", { exact: false })).toBeVisible();
  await expect(owner.getByText("Zakład jest wstrzymany.")).toHaveCount(0);
  await ctx.close();
});

test("zasady dla zakładów partnerskich są publiczne", async ({ page }) => {
  await page.goto("/regulamin-partnera");
  await expect(page.getByRole("heading", { name: "Zasady dla zakładów partnerskich" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wstrzymanie zakładu" })).toBeVisible();
  await expect(page.getByText("Kolejności nie da się kupić.", { exact: false })).toBeVisible();
});
