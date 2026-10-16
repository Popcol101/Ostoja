import { expect, test, type Page } from "@playwright/test";

// Panel administratora Ostoi: ręczne dodanie partnera, zaproszenie właściciela, weryfikacja, zapytania do opiekuna.

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function loginAs(page: Page, who: RegExp) {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: who }).click();
  await page.waitForURL(/\/(admin|panel)/);
}

test("administratorka dodaje partnera, zaprasza właściciela i weryfikuje zakład", async ({ page, browser }) => {
  const p = test.info().project.name === "telefon" ? { nip: "725-000-11-22", name: "Zakład Pogrzebowy Wierzba", owner: "jan@wierzba.test" }
    : { nip: "725-000-33-44", name: "Usługi Pogrzebowe Jodła", owner: "ewa@jodla.test" };

  await loginAs(page, /Ola Maj/);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Zakłady partnerskie" })).toBeVisible();
  await shot(page, "17-admin-zaklady");

  await page.getByRole("link", { name: "Dodaj partnera" }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nazwa zakładu").fill(p.name);
  await page.getByLabel("NIP").fill(p.nip);
  await page.getByLabel("Miasto").selectOption("lodz");
  await page.getByLabel("Adres biura").fill("ul. Leśna 5, 90-001 Łódź");
  await page.getByLabel("Telefon dla rodzin").fill("+48 600 000 010");
  await page.getByLabel("E-mail zakładu").fill("biuro@zaklad.test");
  await page.getByLabel("Własna sala pożegnań").check();
  await page.getByRole("button", { name: "Dodaj zakład" }).click();

  await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
  await expect(page.getByText("Zakład dodany.", { exact: false })).toBeVisible();
  await expect(page.getByText("Do weryfikacji").first()).toBeVisible();

  // Ten sam NIP drugi raz – odmowa.
  await page.goto("/admin/zaklady/nowy");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nazwa zakładu").fill("Duplikat");
  await page.getByLabel("NIP").fill(p.nip);
  await page.getByLabel("Miasto").selectOption("lodz");
  await page.getByLabel("Adres biura").fill("ul. Leśna 6, 90-001 Łódź");
  await page.getByLabel("Telefon dla rodzin").fill("+48 600 000 011");
  await page.getByLabel("E-mail zakładu").fill("dup@zaklad.test");
  await page.getByRole("button", { name: "Dodaj zakład" }).click();
  await expect(page.getByText("Zakład z tym NIP-em już jest w Ostoi")).toBeVisible();

  // Zaproszenie właściciela.
  await page.goto("/admin?pokaz=do-weryfikacji");
  await page.getByRole("link", { name: new RegExp(p.name) }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Imię i nazwisko").fill("Jan Właściciel");
  await page.getByLabel("E-mail", { exact: true }).fill(p.owner);
  await expect(page.getByLabel("Rola")).toHaveValue("wlasciciel");
  await page.getByRole("button", { name: "Utwórz zaproszenie" }).click();
  await expect(page.getByText("Zaproszenie gotowe.", { exact: false })).toBeVisible();
  const link = (await page.locator("p.font-mono").innerText()).replace(/^https?:\/\/[^/]+/, "http://localhost:3100");
  await shot(page, "18-admin-zaklad");

  // Właściciel przyjmuje i loguje się linkiem z e-maila (atrapa Supabase).
  const ctx = await browser.newContext();
  const owner = await ctx.newPage();
  await owner.goto(link);
  await owner.waitForLoadState("networkidle");
  await expect(owner.getByRole("heading", { name: `${p.name} zaprasza Cię do panelu Ostoi` })).toBeVisible();
  await owner.getByRole("button", { name: "Przyjmij zaproszenie" }).click();
  await expect(owner.getByText("Zaproszenie przyjęte.", { exact: false })).toBeVisible();
  await owner.goto(`/logowanie/potwierdz?token_hash=${"c".repeat(56)}`);
  await owner.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(owner).toHaveURL(/\/panel\/zapytania/);
  await expect(owner.getByText(p.name).first()).toBeVisible();
  await owner.goto("/admin");
  await expect(owner).toHaveURL(/\/logowanie/); // właściciel zakładu nie wejdzie do administracji
  await ctx.close();

  // Weryfikacja.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("li", { hasText: "Jan Właściciel" }).getByText("Właściciel", { exact: true })).toBeVisible();
  await page.getByLabel(/Sprawdziłem dokumenty/).check();
  await page.getByRole("button", { name: "Zweryfikuj zakład" }).click();
  await expect(page.getByText("Zakład zweryfikowany. Rodziny widzą go na liście ofert.")).toBeVisible();
});

test("zapytania do opiekuna i rozliczenia", async ({ page }) => {
  await loginAs(page, /Ola Maj/);
  await page.goto("/admin/zapytania");
  await page.waitForLoadState("networkidle");
  const waiting = page.getByRole("button", { name: "Oznacz jako obsłużone" });
  if ((await waiting.count()) > 0) {
    await expect(page.getByText("Renata Testowa")).toBeVisible();
    await shot(page, "19-admin-opiekun");
    await page.getByLabel("Notatka (bez danych wrażliwych)").fill("Oddzwoniono, rodzina wybrała zakład.");
    await waiting.click();
    await expect(page.getByText("Zapytanie oznaczone jako obsłużone.")).toBeVisible();
  }
  await expect(page.getByText("Obsłużone w ostatnim tygodniu")).toBeVisible();

  await page.goto("/admin/rozliczenia");
  await expect(page.getByRole("cell", { name: "Dom Pogrzebowy Cisza" })).toBeVisible();
});

test("zakład nie wejdzie do administracji", async ({ page }) => {
  await loginAs(page, /Anna/);
  await page.waitForURL(/zapytania/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/logowanie/);
  await expect(page.getByText("Ten panel jest tylko dla administratorów Ostoi.")).toBeVisible();
});

test("błąd z przeglądarki trafia do administracji bez danych osobowych", async ({ page, request }) => {
  const res = await request.post("/api/bledy", {
    data: { path: "/r/demo-rodzina-mazur-0000000000000000000000000000?x=1", message: "TypeError: nie zadzwoniono pod +48 600 100 200 (jan@example.com)" },
  });
  expect(res.status()).toBe(204);
  await loginAs(page, /Ola Maj/);
  await page.goto("/admin/bledy");
  await expect(page.getByRole("heading", { name: "Błędy" })).toBeVisible();
  const card = page.locator("li", { hasText: "/r/[token]" }).first();
  await expect(card.getByText("TypeError: nie zadzwoniono pod [liczba] ([e-mail])")).toBeVisible();
  await expect(page.getByText("600 100 200")).toHaveCount(0);
  await expect(page.getByText("demo-rodzina-mazur")).toHaveCount(0);
});

test("wniosek RODO: wyszukanie po numerze, kopia danych i usunięcie z zapytań", async ({ page }) => {
  const phone = test.info().project.name === "telefon" ? "+48 500 100 203" : "500-100-204";
  const name = test.info().project.name === "telefon" ? "Tomasz Lis" : "Agata Mazur";
  await loginAs(page, /Ola Maj/);
  await page.goto("/admin/rodo");
  await page.getByLabel("Numer telefonu osoby składającej wniosek").fill(phone);
  await page.getByRole("button", { name: "Szukaj danych" }).click();
  await expect(page.getByText(name, { exact: false })).toBeVisible();
  await expect(page.locator("li", { hasText: "Dom Pogrzebowy Cisza" }).last()).toBeVisible(); // zlecenie u zakładu
  expect(page.url()).not.toMatch(/500/);

  await page.getByRole("button", { name: "Przygotuj kopię danych (art. 15)" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Pobierz kopię danych/ }).click()]);
  const json = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8")));
  expect(json.zapytania[0].imie_i_nazwisko).toBe(name);
  await shot(page, "31-admin-rodo");

  await page.getByLabel(/Potwierdzam tożsamość osoby/).check();
  await page.getByRole("button", { name: "Usuń dane z zapytań" }).click();
  await expect(page.getByText("Usunięto imię i numer z 1 zapytania", { exact: false })).toBeVisible();
  await expect(page.getByText("Brak zapytań i szkiców z tym numerem.")).toBeVisible();
});
