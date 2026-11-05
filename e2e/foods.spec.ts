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
  const create = page.getByRole("link", { name: "Crear “empanada árabe” a mano" });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("empanada árabe");
});

test("registro manual: un alimento genérico se toma de USDA sin cargarlo antes", async ({ page }) => {
  await page.goto("/registrar?comida=lunch");
  await page.getByLabel("Buscar alimento").fill("pechuga de pollo asada");
  const refs = page.getByRole("region", { name: "Referencias" });
  await expect(refs.getByText("No está en tu catálogo.")).toHaveCount(0);
  await expect(page.getByText("No está en tu catálogo.")).toBeVisible();
  await refs.getByRole("button", { name: "Agregar Chicken, broilers or fryers, breast, meat only, cooked, roasted" }).click();
  const lines = page.getByRole("list", { name: "Para registrar" });
  await expect(lines.getByText("Pechuga de pollo asada")).toBeVisible();
  await expect(page.getByLabel("Unidad de Pechuga de pollo asada")).toContainText("1 cup, chopped or diced (140 g)");
  await page.getByLabel("Cantidad de Pechuga de pollo asada").fill("200");
  await expect(page.getByRole("button", { name: "Registrar · 330 kcal" })).toBeVisible();
});

test("inicio muestra las comidas del día y el campo + ofrece carga manual", async ({ page }) => {
  await page.goto("/");
  for (const meal of ["Desayuno", "Almuerzo", "Merienda", "Cena"]) {
    await expect(page.getByRole("region", { name: meal })).toBeVisible();
  }
  await expect(page.getByTestId("consumed")).toHaveText("0 kcal");
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

test("referencias: elegir un resultado de USDA carga los valores y la fuente", async ({ page }) => {
  await page.goto("/alimentos/nuevo?nombre=Pechuga%20de%20pollo");
  await page.getByRole("button", { name: /Buscar valores en USDA/ }).click();
  await expect(page.getByText("En USDA se buscó: “breast chicken”.")).toBeVisible();
  // Open Food Facts falla en el simulador: se informa y USDA sigue sirviendo.
  await expect(page.getByText("Open Food Facts: Open Food Facts no está disponible ahora.")).toBeVisible();
  await page.getByRole("button", { name: "Usar estos valores" }).click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Pechuga de pollo");
  await expect(page.getByLabel("Calorías (kcal)")).toHaveValue("165");
  await expect(page.getByLabel("Proteínas (g)")).toHaveValue("31,02");
  await expect(page.getByLabel("Fuente")).toHaveValue("usda");
  await expect(page.getByLabel("Referencia (opcional)")).toHaveValue("171477");
  await expect(page.getByLabel("Nombre de la unidad")).toHaveValue("1 cup, chopped or diced");
});

test("recetas: opcionales, con ingredientes de USDA y vista previa por peso final y porciones", async ({ page }) => {
  await page.goto("/alimentos");
  await page.getByRole("navigation", { name: "Catálogo" }).getByRole("link", { name: "Recetas" }).click();
  await expect(page.getByText("Todavía no tenés recetas")).toBeVisible();
  await page.getByRole("link", { name: "Nueva" }).click();
  await page.getByLabel("Nombre").fill("Pollo al horno");
  await page.getByLabel("Agregar ingrediente").fill("pechuga de pollo");
  await page.getByRole("button", { name: /^Agregar Chicken, broilers/ }).click();
  await page.getByLabel("Cantidad de Pechuga de pollo").fill("1000");
  await expect(page.getByTestId("recipe-total")).toHaveText("1.650 kcal");
  await expect(page.getByTestId("recipe-per100")).toHaveText("165 kcal");
  await page.getByLabel("Peso final (g)").fill("750");
  await page.getByLabel("Porciones").fill("3");
  await expect(page.getByTestId("recipe-per100")).toHaveText("220 kcal");
  await expect(page.getByTestId("recipe-portion")).toHaveText("550 kcal");
});
