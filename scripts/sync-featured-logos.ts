import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse, stringify } from "yaml"
import { parseGithubUrl } from "../src/lib/parseGithubUrl"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const yamlPath = path.join(root, "projects.yaml")

type Row = {
  title: string
  url: string
  logo?: string
  subtitle?: string
  highlighted?: boolean
}

const text = readFileSync(yamlPath, "utf8")
const doc = parse(text) as { projects: Row[] }

if (!doc?.projects || !Array.isArray(doc.projects)) {
  console.error("projects.yaml: expected top-level `projects` array")
  process.exit(1)
}

for (const p of doc.projects) {
  const parsed = parseGithubUrl(p.url)
  if (!parsed) {
    console.error("Invalid url:", p.url)
    process.exit(1)
  }
  const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`)
  if (!res.ok) {
    console.error(`${parsed.owner}/${parsed.repo}:`, res.status, await res.text())
    process.exit(1)
  }
  const json = (await res.json()) as { owner: { avatar_url: string } }
  const base = json.owner.avatar_url
  const sep = base.includes("?") ? "&" : "?"
  p.logo = `${base}${sep}s=128`
}

writeFileSync(yamlPath, stringify(doc, { lineWidth: 120, indent: 2 }) + "\n", "utf8")
console.log("Wrote logos to", yamlPath)
