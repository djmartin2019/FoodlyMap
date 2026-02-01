import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "build/**", "node_modules/**", "*.config.js", "*.config.ts"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: true,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      // Disable base JS rules that conflict with TypeScript
      "no-undef": "off",
      "no-unused-vars": "off",
      // Use TypeScript-specific unused vars rule
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      // React JSX runtime (no need to import React)
      "react/react-in-jsx-scope": "off",
      // Import sorting and unused imports (keep as errors)
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": "off", // Disable to avoid duplicates with @typescript-eslint/no-unused-vars
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // TypeScript handles module resolution
      "import/no-unresolved": "off",
      // Disable overly strict React hooks rules (too noisy for legacy code)
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      // Downgrade to warnings for gradual adoption
      "react-hooks/exhaustive-deps": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "react/no-unescaped-entities": "warn",
    },
  }
);
