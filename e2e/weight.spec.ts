import path from "node:path";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => login(page));

test("peso: valida el valor, sube fotos achicadas a una carpeta privada del usuario", async ({ page, request }) => {
  await page.goto("/peso");
  await expect(page.getByText("Sin registros de peso")).toBeVisible();
  const form = page.getByRole("form", { name: "Registrar peso" });
  await form.getByLabel("Peso (kg)").fill("5");
  await form.getByRole("button", { name: "Guardar peso" }).click();
  await expect(form.getByText("Ingresá un peso entre 20 y 400 kg")).toBeVisible();

  await form.getByLabel("Peso (kg)").fill("82,4");
  await form.getByLabel("Agregar fotos").setInputFiles(path.join(__dirname, "fixtures-foto.png"));
  await expect(form.getByRole("img", { name: "Foto 1 para subir" })).toBeVisible();
  await form.getByRole("button", { name: "Guardar peso" }).click();
  await expect(form.getByRole("status")).toHaveText("Guardado");
  await expect(form.getByRole("img", { name: "Foto 1 para subir" })).toHaveCount(0);

  const uploads: string[] = await (await request.get("http://127.0.0.1:54321/__mock/uploads")).json();
  expect(uploads.at(-1)).toMatch(/^11111111-1111-4111-8111-111111111111\/44444444-4444-4444-8444-444444444444\/[0-9a-f-]{36}\.jpg$/);
});
