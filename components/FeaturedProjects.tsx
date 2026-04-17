import { getFeaturedProjects } from "@/src/lib/featuredProjects"
import type { FeaturedProject } from "@/src/types/featured"
import { Check, Github } from "lucide-react"
import { useState } from "react"

function FeaturedAvatar({ src, title }: { src: string; title: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-800 ring-1 ring-white/10">
        <Github className="h-8 w-8 text-slate-400" aria-hidden />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
      onError={() => setOk(false)}
      title={title}
    />
  )
}

function FeaturedTile({ project, onOpenRepoUrl }: { project: FeaturedProject; onOpenRepoUrl: (url: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpenRepoUrl(project.url)}
      aria-label={`Open ${project.title} in Mesh Forge`}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900/60 p-3 text-left ring-1 ring-white/5 transition hover:border-cyan-700/60 hover:bg-slate-800/80 hover:ring-cyan-500/20"
    >
      <FeaturedAvatar src={project.logo} title={project.title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-white group-hover:text-cyan-100">{project.title}</span>
          {project.highlighted ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-500/30">
              <Check className="h-3 w-3" aria-hidden />
              pick
            </span>
          ) : null}
        </div>
        {project.subtitle ? (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-400">{project.subtitle}</p>
        ) : null}
      </div>
    </button>
  )
}

export function FeaturedProjects({ onOpenRepoUrl }: { onOpenRepoUrl: (url: string) => void }) {
  const projects = getFeaturedProjects()
  if (!projects.length) return null

  return (
    <div className="w-full space-y-3 text-left">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-slate-400">Featured projects</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map(p => (
          <FeaturedTile key={p.url} project={p} onOpenRepoUrl={onOpenRepoUrl} />
        ))}
      </div>
    </div>
  )
}
