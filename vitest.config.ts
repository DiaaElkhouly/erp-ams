import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // .kilo/ holds a full second copy of the app as a git worktree.
    exclude: ["**/node_modules/**", "**/.next/**", "**/.kilo/**", "**/.git/**"],
    clearMocks: true,
  },
});