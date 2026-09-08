import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  { ignores: [".next/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...tseslint.configs.recommended,
  nextPlugin.flatConfig.coreWebVitals,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
