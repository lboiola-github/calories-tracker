import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const MOCK_PORT = 54321;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-AR",
    timezoneId: "America/Argentina/Cordoba",
  },
  projects: [
    // Emulación de iPhone sobre Chromium (WebKit no está instalado en el entorno de pruebas).
    // La validación final de iOS se hace en un iPhone real.
    { name: "iphone", use: { ...devices["iPhone 15"], browserName: "chromium", defaultBrowserType: "chromium" } },
  ],
  webServer: [
    {
      command: "node e2e/mock-supabase.mjs",
      port: MOCK_PORT,
      env: { MOCK_SUPABASE_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_prueba",
        USDA_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/usda`,
        OFF_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/off`,
        GROQ_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/groq`,
        GROQ_API_KEY: "clave-de-prueba",
      },
    },
  ],
});
