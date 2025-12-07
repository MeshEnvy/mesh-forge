export type Plugin = {
  name: string
  description: string
  repo: string
  homepage: string
  imageUrl: string
  version: string
  author: string
  featured: boolean
  dependencies: Record<string, string>
  includes?: string[]
}

export type PluginDisplay = Plugin & {
  downloads?: number
  stars?: number
}
