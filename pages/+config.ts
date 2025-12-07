import vikeReact from "vike-react/config"
import type { Config } from "vike/types"

// Default config (can be overridden by pages)
// https://vike.dev/config

export default {
  // https://vike.dev/head-tags
  title: "Mesh Forge",
  description:
    "Build custom firmware with third-party plugins: BBS's, custom hardware, games, and more. An open ecosystem growing to hundreds of plugins.",

  extends: [vikeReact],
  prerender: true,
} satisfies Config
