import { expect, test, type Page } from "@playwright/test";

// Wniosek o zasiłek (Z-12): dane ze zlecenia + PESEL i oświadczenia, walidacja PESEL, wydruk A4.

const ORDER = "/panel/zlecenia/00000000-0000-4000-d000-000000000003"; // Teresa Lis

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

test("wniosek o zasiłek z danych zlecenia", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna Cichońska/ }).click();
  await page.waitForURL(/\/panel/);
  await page.goto(ORDER);
  await page.getByRole("link", { name: "Wniosek o zasiłek (ZUS Z-12)" }).click();
  await expect(page.getByRole("heading", { name: "Wniosek o zasiłek pogrzebowy", level: 1 })).toBeVisible();
  await expect(page.getByText(/Termin złożenia: do \d+ \S+ 2027/)).toBeVisible();

  await page.getByLabel("PESEL osoby zmarłej").fill("44051401459");
  await page.getByRole("button", { name: "Zapisz dane wniosku" }).click();
  await expect(page.getByText("Sprawdź PESEL osoby zmarłej.")).toBeVisible();

  await page.getByLabel("PESEL osoby zmarłej").fill("44051401458");
  await page.getByLabel("Miejsce zgonu (miejscowość)").fill("Łódź");
  await page.getByLabel("PESEL: Tomasz Lis").fill("02070803628");
  await page.getByLabel("Kim jest dla osoby zmarłej (np. syn, żona)").fill("syn");
  await page.getByLabel(/nie pobrała zasiłku pogrzebowego/).check();
  await page.getByRole("button", { name: "Zapisz dane wniosku" }).click();
  await expect(page.getByText("Zapisano dane wniosku.")).toBeVisible();

  const doc = page.getByRole("article", { name: "Wniosek do druku" });
  await expect(doc.getByText("44051401458")).toBeVisible();
  await expect(doc.getByText("Jestem dla osoby zmarłej:")).toContainText("syn");
  await expect(doc.getByText("Dom Pogrzebowy Cisza")).toBeVisible();
  await shot(page, "57-wniosek-zasilek");
  if (test.info().project.name === "komputer") {
    const pdf = (await page.pdf({ format: "A4", printBackground: true })).toString("latin1");
    expect(pdf.match(/\/Type\s*\/Page(?!s)/g)?.length).toBeLessThanOrEqual(2);
  }
});
