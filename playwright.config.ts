import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

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
    // Emulación de iPhone sobre Chromium (WebKit no está instalado en CI/sandbox).
    // La validación final de iOS se hace en un iPhone real.
    { name: "iphone", use: { ...devices["iPhone 15"], browserName: "chromium", defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
