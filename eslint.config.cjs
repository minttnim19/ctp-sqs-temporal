const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const importPlugin = require("eslint-plugin-import");
const prettier = require("eslint-config-prettier");

module.exports = [
  { ignores: ["dist/**", "node_modules/**", "eslint.config.cjs"] },
  // Base JS recommended
  js.configs.recommended,
  // TypeScript recommended (non type-aware)
  ...tseslint.configs.recommended,
  // Node/CommonJS config files (.cjs)
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts"],
    settings: {
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
    },
    plugins: { import: importPlugin },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
        },
      ],
    },
  },
  // Relax certain rules for test files
  {
    files: ["**/*.spec.ts", "**/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Disable rules that conflict with Prettier
  prettier,
];
