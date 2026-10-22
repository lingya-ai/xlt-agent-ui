import { defineConfig } from "vitest/config";
export default defineConfig({ test: {
  environment: "jsdom", globals: false, restoreMocks: true, maxWorkers: 3,
  include: ["packages/registry/src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  setupFiles: ["./tests/setup.ts"], testTimeout: 15_000,
} });
