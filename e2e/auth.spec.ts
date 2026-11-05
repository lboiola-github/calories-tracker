import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("sin sesión, cualquier pantalla redirige a /login", async ({ page }) => {
  for (const path of ["/", "/historial", "/ajustes"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("el manifest y los íconos se sirven sin sesión (instalación en iOS)", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  const icon = await request.get("/icons/apple-touch-icon.png", { maxRedirects: 0 });
  expect(icon.status()).toBe(200);
});

test("credenciales incorrectas muestran un error claro", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("prueba@example.com");
  await page.getByLabel("Contraseña").fill("incorrecta123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("login, sesión persistente y cierre de sesión", async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/ajustes");
  await expect(page.getByText("prueba@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("los campos de login permiten autocompletar con el llavero de iOS", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("autocomplete", "current-password");
});
