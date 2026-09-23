import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // no-explicit-any has ~130 pre-existing violations, mostly in supabase/functions/
      // (Deno edge functions handling untyped webhook/worker JSON payloads). Downgraded
      // to warn so CI catches new violations without blocking on existing ones, matching
      // the same call already made in the dualpay repo's eslint.config.js.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
