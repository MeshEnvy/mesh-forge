import react from "@vitejs/plugin-react"
import path from "node:path"
import { defineConfig } from "vite"

/** Tailwind runs via PostCSS (`postcss.config.mjs`), not `@tailwindcss/vite` — the Vite plugin was stalling builds (no stdout) on large workspaces. */
export default defineConfig({
  plugins: [react()],
  logLevel: "info",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  publicDir: "public",
})
