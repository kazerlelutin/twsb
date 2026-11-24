import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  // Version affichée dans l'admin et comparée aux Releases GitHub.
  define: { __TWSB_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  optimizeDeps: {
    include: [
      "source-map-js",
      "error-stack-parser",
      "stackframe",
      "html-to-image",
    ],
  },
  ssr: { external: ["sharp", "nodemailer"] },
  plugins: [
    solidStart({ ssr: false, middleware: "src/middleware.ts" }),
    nitro({
      preset: "bun",
      handlers: [
        "/media/**",
        "/favicon.png",
        "/favicon.ico",
        "/apple-touch-icon.png",
      ].map((route) => ({
        route,
        handler: "./src/server/assets.handler.ts",
      })),
    }),
  ],
});
