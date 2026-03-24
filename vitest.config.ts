import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
    environment: "node",
    exclude: [...configDefaults.exclude, "e2e/**"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
