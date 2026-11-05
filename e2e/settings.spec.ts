import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => login(page));

test("la vista previa calcula BMR, TDEE y objetivo con los datos cargados", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByLabel("Fecha de nacimiento").fill("1990-01-01");
  await page.getByLabel("Altura (cm)").fill("180");
  await page.getByLabel("Peso actual (kg)").fill("80");
  await page.getByRole("button", { name: "Masculino" }).click();
  await page.getByRole("radio", { name: /Moderada/ }).click();

  // La edad depende de la fecha de hoy; se verifica la relación entre valores, no un número fijo.
  const bmrText = await page.getByText("Basal (BMR)").locator("..").locator("p").nth(1).innerText();
  const bmr = Number(bmrText.replace(/\D/g, ""));
  expect(bmr).toBeGreaterThan(1600);
  expect(bmr).toBeLessThan(1800);

  await page.getByRole("radio", { name: /−500 kcal/ }).click();
  await expect(page.getByRole("radio", { name: /−500 kcal/ })).toContainText("455 g/semana");
  await expect(page.getByRole("radio", { name: /−500 kcal/ })).toContainText("1,9 kg/mes");
  await expect(page.getByText("Automático").first()).toBeVisible();
});

test("el objetivo manual se marca como manual y advierte valores bajos", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Masculino" }).click();
  await page.getByRole("button", { name: "Manual", exact: true }).click();
  await page.getByLabel("Objetivo manual (kcal/día)").fill("1300");
  await expect(page.getByText(/Por debajo de 1\.500 kcal\/día/)).toBeVisible();
  await expect(page.getByText("Manual", { exact: true }).last()).toBeVisible();
});

test("sin datos, no inventa valores", async ({ page }) => {
  await page.goto("/ajustes");
  await expect(page.getByText(/Completá la fecha de nacimiento, el sexo, la altura, el peso y la actividad/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Objetivo sin definir")).toBeVisible();
});
