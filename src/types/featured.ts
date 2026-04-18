export type FeaturedProject = {
  title: string
  subtitle?: string
  url: string
  new?: boolean
  logo: string
}

export type FeaturedProjectsFile = {
  projects: FeaturedProject[]
}
