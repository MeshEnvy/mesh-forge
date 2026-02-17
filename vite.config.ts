import mdx from "@mdx-js/rollup"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import remarkGfm from "remark-gfm"
import vike from "vike/plugin"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    vike(),
    mdx({
      remarkPlugins: [remarkGfm],
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
