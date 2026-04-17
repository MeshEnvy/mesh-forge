import type { FeaturedProjectsFile } from "@/src/types/featured"
import rawFeatured from "../../projects.yaml"

const data = rawFeatured as FeaturedProjectsFile

export function getFeaturedProjects(): FeaturedProjectsFile["projects"] {
  return data.projects
}
