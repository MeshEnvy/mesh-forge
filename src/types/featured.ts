export type FeaturedProject = {
  title: string
  subtitle?: string
  url: string
  highlighted?: boolean
  logo: string
}

export type FeaturedProjectsFile = {
  projects: FeaturedProject[]
}
