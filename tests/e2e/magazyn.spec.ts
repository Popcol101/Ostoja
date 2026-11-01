import { expect, test, type Page } from "@playwright/test";

// Magazyn: dostawa zwiększa stan, wydanie do zlecenia zdejmuje ze stanu, zwrot oddaje.

const ORDER = "/panel/zlecenia/00000000-0000-4000-d000-000000000001"; // Halina Nowak, kremacja

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

test("dostawa, wydanie urny do zlecenia i zwrot na stan", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna Cichońska/ }).click();
  await page.waitForURL(/\/panel/);

  await page.goto("/panel/magazyn");
  await expect(page.getByRole("heading", { name: "Magazyn", level: 1 })).toBeVisible();
  await expect(page.getByText(/Do zamówienia:.*Urna metalowa/)).toBeVisible();

  const metal = page.locator("li", { hasText: "Urna metalowa" });
  await metal.getByText("Przyjmij dostawę").click();
  await metal.getByLabel("Ile sztuk przyszło").fill("2");
  await metal.getByLabel("Uwagi (np. nr faktury)").fill("FV 12/11/2026");
  await metal.getByRole("button", { name: "Przyjmij" }).click();
  await expect(page.getByText("Przyjęto dostawę.")).toBeVisible();
  await expect(page.getByText(/Dostawa · Urna metalowa · FV 12\/11\/2026/).first()).toBeVisible();
  await shot(page, "53-magazyn");

  const before = Number((await page.locator("li", { hasText: "Urna ceramiczna" }).getByText(/^\d+ szt\.$/).textContent())!.split(" ")[0]);
  await page.goto(ORDER);
  const value = await page.locator("#stock-item option", { hasText: "Urna ceramiczna" }).getAttribute("value");
  await page.getByLabel("Wydaj z magazynu").selectOption(value!);
  await page.getByRole("button", { name: "Wydaj", exact: true }).click();
  await expect(page.getByText("Produkt przypisany do zlecenia i zdjęty ze stanu.")).toBeVisible();
  await expect(page.locator("section", { hasText: "Trumna, urna i dodatki" }).getByText("Urna ceramiczna")).toBeVisible();
  await shot(page, "54-zlecenie-magazyn");

  await page.goto("/panel/magazyn");
  await expect(page.locator("li", { hasText: "Urna ceramiczna" }).getByText(`${before - 1} szt.`, { exact: true })).toBeVisible();
  await expect(page.getByText(/Do zlecenia · Urna ceramiczna/).first()).toBeVisible();

  // Zwrot przywraca stan (kolejny przebieg zaczyna tak samo).
  await page.goto(ORDER);
  await page.getByRole("button", { name: "Oddaj na stan" }).click();
  await expect(page.getByText("Produkt wrócił na stan magazynu.")).toBeVisible();
});
