// Servidor mínimo que imita los endpoints de Supabase Auth usados por la app.
// Solo para pruebas e2e: permite probar login, sesión y logout sin un proyecto real.
// Usuario válido: prueba@example.com / contraseña-segura
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "prueba@example.com",
};
const PASSWORD = "contraseña-segura";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token() {
  const now = Math.floor(Date.now() / 1000);
  // HS256 sin kid: supabase-js valida estos tokens llamando a /auth/v1/user.
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: USER.id,
    email: USER.email,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 3600,
  })}.firma-de-prueba`;
}
function session() {
  return {
    access_token: token(),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "refresh-de-prueba",
    user: {
      ...USER,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    },
  };
}
const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

// Alimentos guardados con save_food durante las pruebas (para leerlos de vuelta por id).
const savedFoods = new Map();
const norm = (t) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const activities = [];
const uploads = [];
const CHICKEN = {
  fdcId: 171477,
  dataType: "SR Legacy",
  description:
    "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
  foodNutrients: [
    {
      nutrientId: 1008,
      nutrientNumber: "208",
      nutrientName: "Energy",
      unitName: "KCAL",
      value: 165,
    },
    {
      nutrientId: 1003,
      nutrientNumber: "203",
      nutrientName: "Protein",
      unitName: "G",
      value: 31.02,
    },
    {
      nutrientId: 1004,
      nutrientNumber: "204",
      nutrientName: "Total lipid (fat)",
      unitName: "G",
      value: 3.57,
    },
    {
      nutrientId: 1005,
      nutrientNumber: "205",
      nutrientName: "Carbohydrate, by difference",
      unitName: "G",
      value: 0,
    },
  ],
  foodMeasures: [
    { disseminationText: "1 cup, chopped or diced", gramWeight: 140 },
  ],
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body = "";
  for await (const chunk of req) body += chunk;
  const isJson = (req.headers["content-type"] ?? "").includes("json");
  const json = body && isJson ? JSON.parse(body) : {};

  if (req.method === "POST" && url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    if (
      grant === "password" &&
      json.email === USER.email &&
      json.password === PASSWORD
    )
      return send(res, 200, session());
    if (grant === "refresh_token") return send(res, 200, session());
    return send(res, 400, {
      code: "invalid_credentials",
      error_code: "invalid_credentials",
      msg: "Invalid login credentials",
    });
  }
  if (req.method === "GET" && url.pathname === "/auth/v1/user") {
    const auth = req.headers.authorization ?? "";
    return auth.startsWith("Bearer ")
      ? send(res, 200, { ...USER, aud: "authenticated", role: "authenticated" })
      : send(res, 401, { msg: "unauthorized" });
  }
  if (req.method === "POST" && url.pathname === "/auth/v1/logout") {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "POST" && url.pathname === "/auth/v1/signup") {
    return send(res, 200, {
      ...USER,
      email: json.email,
      id: "22222222-2222-4222-8222-222222222222",
    });
  }
  // Datos: respuesta de "usuario sin datos". La lógica real de la base (RLS, funciones)
  // se prueba con npm run test:db sobre Postgres; acá solo se prueba la interfaz.
  if (url.pathname.startsWith("/rest/v1/")) {
    if (url.pathname === "/rest/v1/rpc/save_food" && !json.p_id) {
      const id = `33333333-3333-4333-8333-${String(savedFoods.size + 1).padStart(12, "0")}`;
      const f = json.p_food;
      savedFoods.set(id, {
        id,
        name: f.name,
        preparation: f.preparation,
        brand: f.brand || null,
        kcal_per_100g: f.kcal_per_100g,
        protein_per_100g: f.protein_per_100g,
        carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g,
        fiber_per_100g: f.fiber_per_100g,
        source_type: f.source_type,
        source_ref: f.source_ref,
        validated: f.validated,
        archived_at: null,
        created_at: new Date().toISOString(),
        food_units: json.p_units.map((u, i) => ({ id: `u${i}`, ...u })),
        food_aliases: [],
      });
      return send(res, 200, id);
    }
    if (url.pathname === "/rest/v1/rpc/search_foods") {
      // Solo alimentos guardados en esta corrida (las demás pruebas parten de un catálogo vacío).
      const q = norm(json.p_query ?? "");
      const hits = [...savedFoods.values()].filter(
        (f) => norm(f.name).includes(q) && q.length >= 3,
      );
      return send(
        res,
        200,
        hits.map((f) => ({ ...f, matched: f.name, score: 0.9 })),
      );
    }
    if (url.pathname === "/rest/v1/rpc/log_meal_items") {
      return send(res, 200, {
        item_ids: json.p_items.map(
          (_, i) =>
            `55555555-5555-4555-8555-${String(i + 1).padStart(12, "0")}`,
        ),
        replayed: false,
      });
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) return send(res, 200, null);
    const ids = /^in\.\((.*)\)$|^eq\.(.*)$/.exec(
      url.searchParams.get("id") ?? "",
    );
    if (url.pathname === "/rest/v1/foods" && req.method === "GET" && ids) {
      const wanted = (ids[1] ?? ids[2])
        .split(",")
        .map((x) => x.replace(/"/g, ""));
      return send(
        res,
        200,
        wanted.map((id) => savedFoods.get(id)).filter(Boolean),
      );
    }
    if (url.pathname === "/rest/v1/activity_entries") {
      if (req.method === "POST") {
        const rows = Array.isArray(json) ? json : [json];
        for (const r of rows) {
          if (activities.some((x) => x.operation_id === r.operation_id)) continue;
          activities.push({
            id: `66666666-6666-4666-8666-${String(activities.length + 1).padStart(12, "0")}`,
            created_at: new Date().toISOString(),
            deleted_at: null,
            ...r,
          });
        }
        return send(res, 201, []);
      }
      if (req.method === "PATCH") {
        const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
        for (const a of activities) if (a.id === id) a.deleted_at = json.deleted_at;
        return send(res, 200, []);
      }
      const day = (url.searchParams.get("entry_date") ?? "").replace(/^eq\./, "");
      return send(
        res,
        200,
        activities.filter((a) => a.entry_date === day && !a.deleted_at),
      );
    }
    if (url.pathname === "/rest/v1/weight_entries" && req.method === "POST") {
      return send(res, 201, {
        id: "44444444-4444-4444-8444-444444444444",
        ...json,
      });
    }
    if (req.method === "GET" || req.method === "HEAD")
      return send(res, 200, []);
    return send(res, 201, []);
  }
  // Storage: subidas de fotos (solo se registra la ruta).
  if (
    url.pathname.startsWith("/storage/v1/object/weight-photos/") &&
    req.method === "POST"
  ) {
    uploads.push(url.pathname.replace("/storage/v1/object/weight-photos/", ""));
    return send(res, 200, { Key: url.pathname });
  }
  // Groq simulado: interpreta solo los mensajes de prueba con lentejas.
  if (url.pathname === "/groq/chat/completions" && req.method === "POST") {
    const text = json.messages?.at(-1)?.content ?? "";
    const items = /lentejas/i.test(text)
      ? [
          {
            fragment: "200 g de lentejas hervidas",
            food: "lentejas",
            quantity: 200,
            unit: "g",
            preparation: "boiled",
          },
        ]
      : [];
    const content = JSON.stringify({
      meal_type: /almor/i.test(text) ? "lunch" : null,
      day: null,
      items,
    });
    return send(res, 200, { choices: [{ message: { content } }] });
  }
  // Whisper simulado: recibe multipart y devuelve un texto fijo.
  if (url.pathname === "/groq/audio/transcriptions" && req.method === "POST") {
    const ok =
      /multipart\/form-data/.test(req.headers["content-type"] ?? "") &&
      /whisper-large-v3-turbo/.test(body ?? "");
    return ok
      ? send(res, 200, { text: "Almorcé 200 g de lentejas hervidas" })
      : send(res, 400, { error: "multipart inválido" });
  }
  if (url.pathname === "/__mock/uploads") return send(res, 200, uploads);
  // Referencias nutricionales simuladas (USDA_BASE_URL y OFF_BASE_URL apuntan acá).
  if (url.pathname === "/usda/foods/search") {
    return send(res, 200, { foods: [CHICKEN] });
  }
  if (url.pathname === "/usda/food/171477") return send(res, 200, CHICKEN);
  if (url.pathname === "/offsearch/search")
    return send(res, 503, { error: "simulado" });
  send(res, 404, {
    msg: `mock: ruta no implementada ${req.method} ${url.pathname}`,
  });
}).listen(PORT, () => console.log(`mock supabase en :${PORT}`));
