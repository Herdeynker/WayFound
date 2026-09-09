import path from "node:path";
import { defineConfig } from "vitest/config";

const sourceDirectory = path.resolve(process.cwd(), "src").replaceAll("\\", "/");
const serverOnlyShim = path.resolve(process.cwd(), "tests/server-only-shim.ts").replaceAll("\\", "/");

export default defineConfig({
  resolve: {
    alias: {
      "@": sourceDirectory,
      "server-only": serverOnlyShim,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Hosted Supabase suites create and remove temporary users and issue short-lived
    // credentials. Serial files avoid an intermittent upstream JWT clock race while
    // preserving every assertion and test case.
    fileParallelism: false,
    coverage: { reporter: ["text", "html"], include: ["src/**/*.ts", "src/**/*.tsx"] },
  },
});
