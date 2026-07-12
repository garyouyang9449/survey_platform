import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    // Load .env / .env.local into process.env so DB-backed tests can connect.
    env: loadEnv(mode, process.cwd(), ""),
    // DB-backed integration tests share one Postgres; run files serially so
    // their table cleanups don't race across parallel workers.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
}));
