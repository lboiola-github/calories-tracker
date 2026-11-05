import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith("el manifest")) return;
  await login(page);
});

test("el manifest permite instalar la app en modo standalone", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.lang).toBe("es-AR");
  for (const icon of manifest.icons) {
    const iconRes = await request.get(icon.src);
    expect(iconRes.ok(), icon.src).toBeTruthy();
    expect(iconRes.headers()["content-type"]).toContain("image/png");
  }
});

test("el HTML incluye metadatos de iOS y viewport-fit=cover", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
});

test("la navegación inferior recorre todas las secciones", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  for (const [label, heading] of [
    ["Historial", "Historial"],
    ["Peso", "Peso"],
    ["Alimentos", "Alimentos"],
    ["Inicio", "Inicio"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("link", { name: "Configuración" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Configuración" })).toBeVisible();
});

test("el botón + abre el campo de registro ya enfocado y conserva el borrador", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Registrar comida" }).click();
  const field = page.getByRole("textbox", { name: "Describí la comida" });
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("enterkeyhint", "send");
  await field.fill("Almorcé 230 gramos de pollo");
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).last().click();
  await expect(field).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Registrar comida" }).click();
  await expect(page.getByRole("textbox", { name: "Describí la comida" })).toHaveValue("Almorcé 230 gramos de pollo");
});

test("las secciones no generan scroll horizontal en iPhone", async ({ page }) => {
  for (const path of ["/", "/historial", "/peso", "/alimentos", "/ajustes"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
