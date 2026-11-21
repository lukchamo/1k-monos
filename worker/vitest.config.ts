import { defineConfig } from "vitest/config";

// Los tests del motor corren en Node: el motor es TypeScript puro, sin APIs de Workers.
// Para probar el Worker y el Durable Object completos, añadir @cloudflare/vitest-pool-workers.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 120_000,
  },
});
