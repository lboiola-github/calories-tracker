# Calorías

Aplicación web progresiva (PWA) personal para registrar comidas en lenguaje natural, calcular calorías y macronutrientes, y seguir la evolución del peso. Pensada para usarse desde un iPhone, instalada en la pantalla de inicio.

El plan técnico completo y las etapas están en el documento del proyecto. Este README se completa etapa por etapa.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Vercel (plan Hobby)
- Supabase (Postgres, Auth, Storage), plan gratuito — desde la etapa 1
- Groq (GPT-OSS 20B) solo para interpretar texto — desde la etapa 6

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
npm run test:e2e   # Playwright, emulando un iPhone 15
```

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
e2e/                pruebas de extremo a extremo (Playwright)
scripts/            herramientas de desarrollo
```
