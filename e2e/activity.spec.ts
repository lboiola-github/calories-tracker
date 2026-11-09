import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.beforeEach(async ({ page }) => login(page));

test("actividad: gimnasio a mano suma al margen del día y se puede quitar", async ({ page }) => {
  const section = page.getByRole("region", { name: "Actividad física" });
  await expect(section.getByText("Sin actividad registrada.")).toBeVisible();
  await section.getByRole("button", { name: "Agregar" }).click();

  const form = page.getByRole("form", { name: "Agregar actividad" });
  // Sin peso registrado, caminar/correr no pueden calcular y lo dicen.
  await expect(form.getByRole("radio", { name: "Caminar" })).toHaveAttribute("aria-checked", "true");
  await expect(form.getByTestId("activity-preview")).toContainText("hace falta un peso");
  await expect(form.getByRole("button", { name: "Guardar actividad" })).toBeDisabled();

  await form.getByRole("radio", { name: "Gimnasio" }).click();
  await form.getByLabel("Calorías quemadas (kcal)").fill("350");
  await form.getByRole("button", { name: "Guardar actividad" }).click();

  await expect(section.getByText("Gimnasio")).toBeVisible();
  await expect(section.getByText("+350")).toBeVisible();
  await expect(page.getByTestId("burned")).toContainText("+350");

  await section.getByRole("button", { name: "Quitar Gimnasio" }).click();
  await expect(section.getByText("Sin actividad registrada.")).toBeVisible();
  await expect(page.getByTestId("burned")).toContainText("0");
});

test("tocar una pestaña la marca al instante", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("link", { name: "Peso" }).click();
  await expect(nav.getByRole("link", { name: "Peso" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Peso" })).toBeVisible();
});
