import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => login(page));

test("texto libre: revisa lo que no está en el catálogo y después registra directo con Aceptar/Editar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Registrar comida" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Describí la comida").fill("Almorcé 200 g de lentejas hervidas");
  await dialog.getByRole("button", { name: "Registrar", exact: true }).click();

  // Primera vez: no está en el catálogo → se elige de USDA y la cantidad viene del texto.
  const review = dialog.getByRole("region", { name: "Revisar" });
  await expect(review.getByRole("radio", { name: "Almuerzo" })).toHaveAttribute("aria-checked", "true");
  await expect(review.getByText("No está en tu catálogo (hervido)")).toBeVisible();
  await review.getByRole("button", { name: /^Agregar Chicken, broilers/ }).click();
  await expect(review.getByLabel("Cantidad de Lentejas")).toHaveValue("200");
  await review.getByRole("button", { name: "Registrar" }).click();
  const logged = dialog.getByRole("region", { name: "Registrado" });
  await expect(logged.getByTestId("logged-total")).toHaveText("330 kcal");
  await logged.getByRole("button", { name: "Aceptar" }).click();
  await expect(dialog).toHaveCount(0);

  // Segunda vez: ya está en el catálogo y validado → se registra directo y se muestra el resumen.
  await page.getByRole("button", { name: "Registrar comida" }).click();
  await dialog.getByLabel("Describí la comida").fill("Almorcé 200 g de lentejas hervidas");
  await dialog.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Registrado" }).getByTestId("logged-total")).toHaveText("330 kcal");
  // Editar deshace y vuelve a la revisión con lo interpretado.
  await dialog.getByRole("button", { name: "Editar" }).click();
  await expect(dialog.getByRole("region", { name: "Revisar" }).getByLabel("Cantidad de Lentejas")).toHaveValue("200");
});

test("texto sin alimentos reconocibles avisa y deja el texto", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Registrar comida" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Describí la comida").fill("hola");
  await dialog.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(/No encontré alimentos/);
  await expect(dialog.getByLabel("Describí la comida")).toHaveValue("hola");
});
