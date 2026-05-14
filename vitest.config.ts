import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/chat/validation.ts",
        "src/lib/rag/chunk-text.ts",
        "src/lib/security/rate-limit.ts",
        "src/lib/rag/stub-embedding-function.ts",
        "src/lib/chat/gemini.ts",
      ],
      thresholds: {
        lines: 40,
        statements: 40,
        branches: 35,
        functions: 40,
      },
    },
  },
});
