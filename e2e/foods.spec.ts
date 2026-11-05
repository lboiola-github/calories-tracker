import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => login(page));

test("catálogo vacío y alta de alimento con control de energía", async ({ page }) => {
  await page.goto("/alimentos");
  await expect(page.getByText("Tu catálogo está vacío")).toBeVisible();
  await page.getByRole("link", { name: "Nuevo" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Pechuga de pollo");
  await page.getByLabel("Preparación (cómo se pesa)").selectOption("cooked");
  await page.getByLabel("Calorías (kcal)").fill("690"); // kJ cargados por error
  await page.getByLabel("Proteínas (g)").fill("31");
  await page.getByLabel("Carbohidratos (g)").fill("0");
  await page.getByLabel("Grasas (g)").fill("3,6");
  await expect(page.getByText(/no coinciden con los macros/)).toBeVisible();
  await page.getByLabel("Calorías (kcal)").fill("165");
  await expect(page.getByText(/no coinciden con los macros/)).toHaveCount(0);
});

test("unidades: se agregan y quitan filas", async ({ page }) => {
  await page.goto("/alimentos/nuevo");
  await page.getByRole("button", { name: "+ Agregar unidad" }).click();
  await page.getByLabel("Nombre de la unidad").fill("unidad");
  await page.getByLabel("Gramos por unidad").fill("50");
  await expect(page.getByLabel("Nombre de la unidad")).toHaveCount(1);
  await page.getByRole("button", { name: "Quitar unidad" }).click();
  await expect(page.getByLabel("Nombre de la unidad")).toHaveCount(0);
});

test("registro manual: sin resultados ofrece crear el alimento y vuelve al registro", async ({ page }) => {
  await page.goto("/registrar?comida=lunch");
  await expect(page.getByRole("radio", { name: "Almuerzo" })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Buscar alimento").fill("empanada árabe");
  const create = page.getByRole("link", { name: "Crear “empanada árabe”" });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("empanada árabe");
});

test("inicio muestra las comidas del día y el campo + ofrece carga manual", async ({ page }) => {
  await page.goto("/");
  for (const meal of ["Desayuno", "Almuerzo", "Merienda", "Cena"]) {
    await expect(page.getByRole("region", { name: meal })).toBeVisible();
  }
  await expect(page.getByTestId("consumed")).toHaveText("0 kcal consumidas");
  await page.getByRole("button", { name: "Registrar comida" }).click();
  await page.getByRole("link", { name: "Cargar a mano" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Registrar" })).toBeVisible();
});

test("historial navega entre días sin pasar de hoy", async ({ page }) => {
  await page.goto("/historial");
  const label = page.getByRole("navigation", { name: "Cambiar de día" });
  await label.getByRole("link", { name: "Día anterior" }).click();
  await expect(page).toHaveURL(/fecha=\d{4}-\d{2}-\d{2}/);
  await page.goto("/historial?fecha=2999-01-01");
  await expect(label.getByRole("link", { name: "Día siguiente" })).toBeVisible(); // cae en ayer: se puede ir a hoy
  await label.getByRole("link", { name: "Día siguiente" }).click();
  await expect(label.getByRole("link", { name: "Día siguiente" })).toHaveCount(0);
});
