import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Micrófono simulado de Chromium: concede el permiso y genera un tono continuo.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test.beforeEach(async ({ page }) => login(page));

test("tocar + empieza a grabar; al terminar transcribe, interpreta y sigue sin pasos extra", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Registrar comida" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Te escucho. Contá qué comiste."),
  ).toBeVisible();
  const done = dialog.getByRole("button", {
    name: "Listo, terminar de grabar",
  });
  await expect(done).toBeEnabled();
  await page.waitForTimeout(700);
  await done.click();
  // Lo transcripto queda como texto y se interpreta solo: revisión o registro directo.
  await expect(
    dialog.getByRole("region", { name: /^(Revisar|Registrado)$/ }),
  ).toBeVisible();
  await expect(dialog.getByText(/Lentejas/i).first()).toBeVisible();
});

test("Prefiero escribir corta la grabación y deja el campo de texto", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Registrar comida" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Prefiero escribir" }).click();
  await expect(dialog.getByLabel("Describí la comida")).toBeFocused();
  await expect(dialog.getByText("Te escucho. Contá qué comiste.")).toHaveCount(
    0,
  );
});

test("estado público de la IA: sin sesión, sin secretos, con prueba real de transcripción", async ({
  request,
}) => {
  const res = await request.get("/api/ia/estado");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.configured).toBe(true);
  expect(body.transcribe.ok).toBe(true);
  expect(JSON.stringify(body)).not.toContain("clave-de-prueba");
});

test("la evaluación en producción exige token", async ({ request }) => {
  expect((await request.get("/api/ia/eval")).status()).toBe(404);
  expect((await request.get("/api/ia/eval?t=otro")).status()).toBe(404);
});
