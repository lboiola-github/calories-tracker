// Servidor mínimo que imita los endpoints de Supabase Auth usados por la app.
// Solo para pruebas e2e: permite probar login, sesión y logout sin un proyecto real.
// Usuario válido: prueba@example.com / contraseña-segura
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "prueba@example.com" };
const PASSWORD = "contraseña-segura";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token() {
  const now = Math.floor(Date.now() / 1000);
  // HS256 sin kid: supabase-js valida estos tokens llamando a /auth/v1/user.
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: USER.id, email: USER.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600,
  })}.firma-de-prueba`;
}
function session() {
  return {
    access_token: token(), token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "refresh-de-prueba",
    user: { ...USER, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}
const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = "";
  for await (const chunk of req) body += chunk;
  const json = body ? JSON.parse(body) : {};

  if (req.method === "POST" && url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password" && json.email === USER.email && json.password === PASSWORD) return send(res, 200, session());
    if (grant === "refresh_token") return send(res, 200, session());
    return send(res, 400, { code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" });
  }
  if (req.method === "GET" && url.pathname === "/auth/v1/user") {
    const auth = req.headers.authorization ?? "";
    return auth.startsWith("Bearer ") ? send(res, 200, { ...USER, aud: "authenticated", role: "authenticated" })
      : send(res, 401, { msg: "unauthorized" });
  }
  if (req.method === "POST" && url.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
  if (req.method === "POST" && url.pathname === "/auth/v1/signup") {
    return send(res, 200, { ...USER, email: json.email, id: "22222222-2222-4222-8222-222222222222" });
  }
  // Datos: respuesta de "usuario sin datos". La lógica real de la base (RLS, funciones)
  // se prueba con npm run test:db sobre Postgres; acá solo se prueba la interfaz.
  if (url.pathname.startsWith("/rest/v1/")) {
    if (url.pathname.startsWith("/rest/v1/rpc/")) return send(res, 200, null);
    if (req.method === "GET" || req.method === "HEAD") return send(res, 200, []);
    return send(res, 201, []);
  }
  // Referencias nutricionales simuladas (USDA_BASE_URL y OFF_BASE_URL apuntan acá).
  if (url.pathname === "/usda/foods/search") {
    return send(res, 200, { foods: [{
      fdcId: 171477, dataType: "SR Legacy", description: "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
      foodNutrients: [
        { nutrientId: 1008, nutrientNumber: "208", nutrientName: "Energy", unitName: "KCAL", value: 165 },
        { nutrientId: 1003, nutrientNumber: "203", nutrientName: "Protein", unitName: "G", value: 31.02 },
        { nutrientId: 1004, nutrientNumber: "204", nutrientName: "Total lipid (fat)", unitName: "G", value: 3.57 },
        { nutrientId: 1005, nutrientNumber: "205", nutrientName: "Carbohydrate, by difference", unitName: "G", value: 0 },
      ],
      foodMeasures: [{ disseminationText: "1 cup, chopped or diced", gramWeight: 140 }],
    }] });
  }
  if (url.pathname === "/off/cgi/search.pl") return send(res, 503, { error: "simulado" });
  send(res, 404, { msg: `mock: ruta no implementada ${req.method} ${url.pathname}` });
}).listen(PORT, () => console.log(`mock supabase en :${PORT}`));
