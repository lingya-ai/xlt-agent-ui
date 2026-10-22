import tseslint from "typescript-eslint";
export default tseslint.config(
  {ignores:["**/node_modules/**","**/.next/**","**/dist/**","**/.cache/**","scripts/bootstrap-source.py","scripts/capture-contracts.py","scripts/extract-messages.cjs"]},
  ...tseslint.configs.recommended,
  {rules:{"@typescript-eslint/no-unused-vars":["error",{argsIgnorePattern:"^_",varsIgnorePattern:"^_",caughtErrorsIgnorePattern:"^_"}]}},
  {files:["**/*.cjs"],rules:{"@typescript-eslint/no-require-imports":"off"}},
);
