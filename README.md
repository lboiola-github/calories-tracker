# Calorías

Aplicación web progresiva (PWA) personal para registrar comidas en lenguaje natural, calcular calorías y macronutrientes, y seguir la evolución del peso. Pensada para usarse desde un iPhone, instalada en la pantalla de inicio.

El plan técnico completo y las etapas están en el documento del proyecto. Este README se completa etapa por etapa.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Vercel (plan Hobby)
- Supabase (Postgres, Auth, Storage), plan gratuito
- Groq (GPT-OSS 20B) solo para interpretar texto — desde la etapa 6

## Configurar Supabase (una sola vez)

1. Crear un proyecto gratuito en [supabase.com](https://supabase.com) (región São Paulo). No hace falta tarjeta.
2. **Variables en Vercel** (Settings → Environment Variables, para Production y Preview) y en `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API → Project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Project Settings → API Keys → publishable key.
   - `USDA_API_KEY` (opcional, solo servidor): clave gratuita de [FoodData Central](https://fdc.nal.usda.gov/api-key-signup).
     Sin ella se usa `DEMO_KEY`, que se agota rápido.
3. **Migraciones automáticas**: en GitHub → Settings → Secrets and variables → Actions, crear
   `SUPABASE_ACCESS_TOKEN` ([crear token](https://supabase.com/dashboard/account/tokens)),
   `SUPABASE_DB_PASSWORD` (la contraseña de la base) y `SUPABASE_PROJECT_ID` (el subdominio de la Project URL).
   Cada merge a `main` que toque `supabase/migrations` las aplica con el workflow *Migraciones de Supabase*.
   También se puede correr a mano desde la pestaña Actions.
   Alternativa manual: pegar cada archivo de `supabase/migrations/` en orden en el SQL Editor.
4. **Auth** → URL Configuration: poner la URL de producción de Vercel como *Site URL*.
5. Crear tu cuenta desde la app. Si nadie más la va a usar, desactivar después
   Auth → Sign In / Providers → *Allow new users to sign up*.

El login es con email y contraseña (no con enlace mágico): en iOS, un enlace del email abre Safari y no la app instalada, así que la sesión no llegaría a la PWA. La contraseña se puede guardar en el llavero de iCloud.

## Desarrollo local

Requisitos: Node.js 20.9 o superior y npm.

```bash
npm install
npm run dev        # http://localhost:3000
```

Para probar en el iPhone dentro de la misma red Wi-Fi: `npm run dev -- -H 0.0.0.0` y abrir `http://<ip-de-tu-computadora>:3000` en Safari. La instalación como app requiere HTTPS, así que conviene probarla sobre el despliegue de Vercel.

## Verificaciones

```bash
npm run lint
npm run build
npm test           # pruebas unitarias (cálculos)
npm run test:db    # migraciones + RLS sobre un Postgres local descartable
npm run test:e2e   # Playwright, emulando un iPhone 15 (con un Supabase Auth simulado)
```

`test:db` necesita Postgres instalado (`initdb` y `pg_ctl` en el PATH, por ejemplo `brew install postgresql@17`) o una base vacía en `TEST_DATABASE_URL`. Las mismas pruebas corren en GitHub Actions en cada PR.

Los íconos se regeneran con `node scripts/generate-icons.mjs`.

## Despliegue en Vercel

1. En [vercel.com/new](https://vercel.com/new) importar el repositorio `calories-tracker` (plan Hobby, sin tarjeta).
2. Framework: Next.js (se detecta solo). No hace falta configurar nada más en esta etapa.
3. Cada push a `main` despliega producción; cada PR genera una URL de vista previa.

## Instalar en el iPhone

1. Abrir la URL de Vercel en **Safari**.
2. Compartir → **Agregar a inicio**.
3. Abrir la app desde el ícono: se ve sin barra del navegador.

## Estructura

```
src/app/            rutas (Inicio, Historial, Peso, Alimentos, Configuración) y manifest
src/components/     componentes de interfaz reutilizables
src/lib/            utilidades sin interfaz
src/lib/supabase/   clientes de Supabase (servidor y proxy de sesión)
src/proxy.ts        refresco de sesión y redirección a /login
supabase/migrations esquema, restricciones y políticas RLS
supabase/tests      pruebas SQL (aislamiento entre usuarios)
e2e/                pruebas de extremo a extremo (Playwright)
scripts/            herramientas de desarrollo
```

## Referencias nutricionales

En el formulario de alimento, "Buscar valores en USDA u Open Food Facts" consulta ambas fuentes desde el servidor
(por nombre, código de barras o `fdc 171477`). Nada se guarda sin que revises y toques Guardar.
USDA solo está en inglés: la app traduce las palabras comunes (pollo → chicken) y muestra qué buscó.
Energía: se usa la publicada en kcal; si solo hay kJ se convierte (÷ 4,184); nunca se calcula desde los macros.
Los datos de Open Food Facts quedan sin validar (son colaborativos). Atribución: USDA FoodData Central (dominio
público) y Open Food Facts (ODbL).
Los parsers se probaron con respuestas de ejemplo escritas según la documentación de cada API, no con respuestas reales.
