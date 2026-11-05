import { expect, type Page } from "@playwright/test";

export const TEST_USER = { email: "prueba@example.com", password: "contraseña-segura" };

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Contraseña").fill(TEST_USER.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
}
