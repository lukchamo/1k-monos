import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * CSP sin nonce a propósito: un nonce obliga a renderizar cada página en cada petición y tira el ISR.
 * La web no tiene sesiones, cookies ni formularios; todo el contenido de terceros (noticias) se pinta
 * como texto. 'unsafe-inline' cubre los scripts de arranque que Next inyecta en el HTML.
 */
const csp = [
  "default-src 'self'",
  // static.cloudflareinsights.com: analítica de visitas de Cloudflare (sin cookies), que la zona inyecta sola
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  // res.cloudinary.com: vídeos y portadas de la pestaña de tutoriales
  "img-src 'self' data: https://res.cloudinary.com",
  "media-src 'self' https://res.cloudinary.com",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Cache Components ('use cache') todavía no es estable en Workers (opennextjs-cloudflare #1318):
  // la caché de esta web es ISR por tiempo, con caché incremental en R2 y caché regional.
  cacheComponents: false,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // tree-shaking de imports con nombre y CSS crítico en línea
    inlineCss: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // www → dominio principal, para que solo exista una dirección de cada página
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "www.1kmonos.com" }], destination: "https://1kmonos.com/:path*", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// bindings de Cloudflare disponibles en `next dev`
initOpenNextCloudflareForDev();
