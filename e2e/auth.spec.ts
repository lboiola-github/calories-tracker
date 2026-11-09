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

test("dispositivo recordado: si se pierde la sesión, vuelve a entrar sin pedir login", async ({ page, context }) => {
  await login(page);
  const device = (await context.cookies()).find((c) => c.name === "cal_device");
  expect(device?.httpOnly).toBe(true);
  expect(device?.value).not.toContain("contraseña");

  // Simula una sesión revocada por Supabase: quedan solo las cookies del dispositivo.
  await page.goto("about:blank");
  const keep = (await context.cookies()).filter((c) => !c.name.startsWith("sb-"));
  await context.clearCookies();
  await context.addCookies(keep);
  await page.goto("/historial");
  await expect(page.getByRole("heading", { level: 1, name: "Historial" })).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);

  // Una cookie inválida no sirve y se descarta (antes se sale de la app para cortar prefetches).
  await page.goto("about:blank");
  await context.clearCookies();
  await context.addCookies([{ ...device!, value: "v1.basura" }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.cookies()).find((c) => c.name === "cal_device")).toBeUndefined();
});

test("los campos de login permiten autocompletar con el llavero de iOS", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("autocomplete", "current-password");
});

test("la exportación sin sesión no devuelve datos", async ({ request }) => {
  const res = await request.get("/exportar/comidas", { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(res.status());
  expect(res.headers()["location"]).toContain("/login");
});
