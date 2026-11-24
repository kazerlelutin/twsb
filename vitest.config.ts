import path from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: { __TWSB_VERSION__: JSON.stringify(pkg.version) },
  plugins: [solid()],
  resolve: {
    alias: { "~": path.resolve(import.meta.dirname, "src") },
    conditions: ["development", "browser"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
    pool: "forks",
  },
});
