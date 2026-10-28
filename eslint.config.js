import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default ts.config(
  {
    ignores: [
      "dist/**",
      "platforms/webos-poc/dist/**",
      "node_modules/**",
      "src-tauri/target/**",
      "src-tauri/tests/fixtures/**", // .ts aqui é MPEG-TS binário, não TypeScript.
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": hooks },
    rules: hooks.configs.recommended.rules,
  },
  { files: ["*.js"], languageOptions: { globals: globals.node } },
  {
    files: ["platforms/webos-poc/app/*.js"],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",
      globals: { ...globals.browser, module: "readonly" },
    },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }],
      "@typescript-eslint/no-unused-vars": ["error", { caughtErrors: "none" }],
    },
  },
  {
    files: ["platforms/webos-poc/**/*.cjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
