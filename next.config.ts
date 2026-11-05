import type { NextConfig } from "next";

// Cache Components queda desactivado: casi todas las pantallas dependen de la sesión
// del usuario, y el modelo dinámico clásico es más simple de razonar con Supabase.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Fotos de peso: se comprimen en el teléfono (≈300 KB c/u) y entran bajo el límite de Vercel (4,5 MB).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
