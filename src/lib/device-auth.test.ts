import { afterEach, describe, expect, it, vi } from "vitest";
import { openCredentials, sealCredentials } from "./device-auth";

afterEach(() => vi.unstubAllEnvs());

describe("credenciales del dispositivo", () => {
  it("cifra y descifra con la clave del servidor", async () => {
    vi.stubEnv("DEVICE_SECRET", "clave-1");
    const sealed = await sealCredentials({ email: "a@b.com", password: "secreta123" });
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain("secreta123");
    expect(await openCredentials(sealed!)).toEqual({ email: "a@b.com", password: "secreta123" });
  });
  it("con otra clave, o alterada, no sirve", async () => {
    vi.stubEnv("DEVICE_SECRET", "clave-1");
    const sealed = (await sealCredentials({ email: "a@b.com", password: "secreta123" }))!;
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(await openCredentials(tampered)).toBeNull();
    vi.stubEnv("DEVICE_SECRET", "clave-2");
    expect(await openCredentials(sealed)).toBeNull();
    expect(await openCredentials(undefined)).toBeNull();
    expect(await openCredentials("basura")).toBeNull();
  });
  it("sin clave en el servidor no guarda nada", async () => {
    vi.stubEnv("DEVICE_SECRET", "");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(await sealCredentials({ email: "a@b.com", password: "x" })).toBeNull();
  });
});
