// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.local/**",
      "**/.agents/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/build/**",
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
      "scripts/src/generated/**",
      "attached_assets/**",
    ],
  },
  {
    files: [
      "artifacts/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx}",
    ],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["artifacts/api-server/**/*.ts"],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["artifacts/hrp-mobile/**/*.{ts,tsx,js}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
