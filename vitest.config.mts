import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal vitest setup for the pure/engine/data-layer unit tests.
 * Component tests (`.test.tsx`) would need `environment: "jsdom"` plus
 * `@testing-library/react` — add an environment override when that lands.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
