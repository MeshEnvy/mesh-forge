import logo from "@/assets/logo.png"
import { FeaturedProjects } from "@/components/FeaturedProjects"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { parseGithubUrl } from "../lib/parseGithubUrl"

const MESH_FORGE_README_URL = "https://github.com/MeshEnvy/mesh-forge#readme"

function encodeTreePath(ref: string) {
  return ref.split("/").map(encodeURIComponent).join("/")
}

export default function HomePage() {
  const navigate = useNavigate()
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const openRepoUrl = (raw: string) => {
    const trimmed = raw.trim()
    setInput(trimmed)
    const parsed = parseGithubUrl(trimmed)
    if (!parsed) {
      setError("Paste a GitHub URL like https://github.com/owner/repo or owner/repo")
      return
    }
    setError(null)
    const o = encodeURIComponent(parsed.owner)
    const r = encodeURIComponent(parsed.repo)
    if (parsed.treePath) {
      const path = encodeTreePath(parsed.treePath)
      navigate(`/${o}/${r}/tree/${path}`)
    } else {
      navigate(`/${o}/${r}`)
    }
  }

  const go = () => openRepoUrl(input)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-start px-6 py-12 md:py-16">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="space-y-5">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-slate-100 p-4 md:p-5 shadow-lg shadow-black/25 ring-1 ring-white/10">
              <img src={logo} alt="MeshForge" className="h-20 w-auto md:h-24" width={120} height={120} />
            </div>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
              MeshForge
            </h1>
            <p className="mt-3 text-slate-200 text-lg md:text-xl font-medium leading-snug">
              An open ecosystem and web flasher for mesh plugins, extensions, and firmware.
            </p>
          </div>
        </div>

        <FeaturedProjects onOpenRepoUrl={openRepoUrl} />

        <div className="space-y-3 text-left">
          <input
            id="gh-url"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-600"
            placeholder="https://github.com/owner/repo/tree/v1.0.0"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && go()}
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex flex-col gap-2">
            <Button className="w-full bg-cyan-600 hover:bg-cyan-700" type="button" onClick={go}>
              Open a firmware repo
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full border-slate-600 text-slate-200 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
            >
              <a href={MESH_FORGE_README_URL} target="_blank" rel="noreferrer">
                Read the docs
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
