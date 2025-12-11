import { Switch } from "@/components/ui/switch"
import { Download, Star, Zap } from "lucide-react"
import { navigate } from "vike/client/router"

function getGitHubStarsBadgeUrl(repoUrl?: string): string | null {
  if (!repoUrl) return null
  try {
    const url = new URL(repoUrl)
    if (url.hostname === "github.com" || url.hostname === "www.github.com") {
      const pathParts = url.pathname.split("/").filter(Boolean)
      if (pathParts.length >= 2) {
        const owner = pathParts[0]
        const repo = pathParts[1]
        return `https://img.shields.io/github/stars/${owner}/${repo}?style=flat&logo=github&logoColor=white&labelColor=rgb(0,0,0,0)&color=rgb(30,30,30)&label=★`
      }
    }
  } catch {
    // Invalid URL, return null
  }
  return null
}

interface PluginCardBaseProps {
  id: string
  name: string
  description: string
  imageUrl?: string
  featured?: boolean
  repo?: string
  homepage?: string
  version?: string
  downloads?: number
  stars?: number
  flashCount?: number
  incompatibleReason?: string
  prominent?: boolean
}

interface PluginCardToggleProps extends PluginCardBaseProps {
  variant: "toggle"
  isEnabled: boolean
  onToggle: (enabled: boolean) => void
  disabled?: boolean
  enabledLabel?: string
}

interface PluginCardLinkProps extends PluginCardBaseProps {
  variant: "link"
  href?: string
}

interface PluginCardLinkToggleProps extends PluginCardBaseProps {
  variant: "link-toggle"
  isEnabled: boolean
  onToggle: (enabled: boolean) => void
  disabled?: boolean
  enabledLabel?: string
}

type PluginCardProps = PluginCardToggleProps | PluginCardLinkProps | PluginCardLinkToggleProps

export function PluginCard(props: PluginCardProps) {
  const {
    id,
    name,
    description,
    imageUrl,
    featured = false,
    repo,
    homepage,
    version,
    downloads,
    stars,
    flashCount,
    incompatibleReason,
    prominent = false,
  } = props

  const starsBadgeUrl = getGitHubStarsBadgeUrl(repo)
  const isIncompatible = !!incompatibleReason
  const isToggle = props.variant === "toggle"
  const isLink = props.variant === "link"
  const isLinkToggle = props.variant === "link-toggle"

  const cardContent = (
    <>
      {isToggle ? (
        <>
          {/* Toggle layout: horizontal with switch on right */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <h4 className={`font-semibold text-sm ${isIncompatible ? "text-slate-500" : ""}`}>{name}</h4>
                {featured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />}
              </div>
              <p
                className={`text-xs leading-relaxed text-left ${isIncompatible ? "text-slate-500" : "text-slate-400"}`}
              >
                {description}
              </p>
              {isIncompatible && incompatibleReason && (
                <p className="text-xs text-red-400 mt-1 font-medium">{incompatibleReason}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Switch
                checked={props.isEnabled}
                onCheckedChange={props.onToggle}
                disabled={props.disabled}
                labelLeft="Skip"
                labelRight={props.enabledLabel || "Add"}
                className={props.isEnabled ? "bg-green-600" : "bg-slate-600"}
              />
            </div>
          </div>
          {/* Metadata in bottom right for toggle */}
          <div className="absolute bottom-2 right-2 flex items-center gap-3 text-xs text-slate-400 z-10">
            {version && <span className="text-slate-500">v{version}</span>}
            {flashCount !== undefined && (
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  className="text-slate-400"
                  fill="currentColor"
                  role="img"
                  aria-label="Download"
                >
                  <path d="m14 2l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 18V9h-5V4H6v16zm-6-1l-4-4h2.5v-3h3v3H16z" />
                </svg>
                <span>{flashCount}</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Link/link-toggle layout: vertical with image */}
          <div className="flex items-start gap-3">
            {imageUrl && (
              <img src={imageUrl} alt={`${name} logo`} className="w-12 h-12 rounded-lg object-contain shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <h4
                  className={`font-semibold text-sm ${
                    isIncompatible
                      ? "text-slate-500"
                      : prominent
                        ? "text-cyan-100 group-hover:text-white transition-colors"
                        : isLinkToggle
                          ? ""
                          : "text-white group-hover:text-cyan-400 transition-colors"
                  }`}
                >
                  {name}
                </h4>
                {featured &&
                  (isLinkToggle ? (
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
                  ) : (
                    <span className="px-1.5 py-0.5 text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 rounded">
                      Featured
                    </span>
                  ))}
              </div>
              <p
                className={`text-xs leading-relaxed text-left ${
                  isIncompatible ? "text-slate-500" : prominent ? "text-cyan-200/90" : "text-slate-400"
                }`}
              >
                {description}
              </p>
              {isIncompatible && incompatibleReason && (
                <p className="text-xs text-red-400 mt-1 font-medium">{incompatibleReason}</p>
              )}
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400">
            {version && <span className="text-slate-500">v{version}</span>}
            {isLinkToggle && flashCount !== undefined && (
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  className="text-slate-400"
                  fill="currentColor"
                  role="img"
                  aria-label="Download"
                >
                  <path d="m14 2l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 18V9h-5V4H6v16zm-6-1l-4-4h2.5v-3h3v3H16z" />
                </svg>
                <span>{flashCount}</span>
              </div>
            )}
            {isLink && downloads !== undefined && (
              <div className="flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                <span>{downloads.toLocaleString()}</span>
              </div>
            )}
            {homepage &&
              homepage !== repo &&
              (isLink || isLinkToggle) &&
              (isLink ? (
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    window.open(homepage, "_blank", "noopener,noreferrer")
                  }}
                  className="hover:opacity-80 transition-opacity"
                  aria-label="Homepage"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="text-slate-400"
                    fill="currentColor"
                    role="img"
                    aria-label="Homepage"
                  >
                    <path
                      fill="currentColor"
                      d="m12 3l11 8.25l-1.2 1.6L20 11.5V21H4v-9.5l-1.8 1.35l-1.2-1.6zm-4.65 9.05q0 1.325 1.425 2.825T12 18q1.8-1.625 3.225-3.125t1.425-2.825q0-1.1-.75-1.825T14.1 9.5q-.65 0-1.188.263T12 10.45q-.375-.425-.937-.687T9.9 9.5q-1.05 0-1.8.725t-.75 1.825"
                    />
                  </svg>
                </button>
              ) : (
                <a
                  href={homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="hover:opacity-80 transition-opacity"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="text-slate-400"
                    fill="currentColor"
                    role="img"
                    aria-label="Homepage"
                  >
                    <path
                      fill="currentColor"
                      d="m12 3l11 8.25l-1.2 1.6L20 11.5V21H4v-9.5l-1.8 1.35l-1.2-1.6zm-4.65 9.05q0 1.325 1.425 2.825T12 18q1.8-1.625 3.225-3.125t1.425-2.825q0-1.1-.75-1.825T14.1 9.5q-.65 0-1.188.263T12 10.45q-.375-.425-.937-.687T9.9 9.5q-1.05 0-1.8.725t-.75 1.825"
                    />
                  </svg>
                </a>
              ))}
            {starsBadgeUrl &&
              repo &&
              (isLink ? (
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    window.open(repo, "_blank", "noopener,noreferrer")
                  }}
                  className="hover:opacity-80 transition-opacity"
                  aria-label="GitHub repository"
                >
                  <img src={starsBadgeUrl} alt="GitHub stars" className="h-4" />
                </button>
              ) : (
                <a
                  href={repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="hover:opacity-80 transition-opacity"
                >
                  <img src={starsBadgeUrl} alt="GitHub stars" className="h-4" />
                </a>
              ))}
          </div>
          {/* Build Now button - absolutely positioned in lower right */}
          {isLink && (
            <div className="absolute bottom-4 right-4 z-10">
              <button
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  navigate(`/builds?plugin=${id}`)
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded hover:bg-cyan-400/20 transition-colors cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                Build Now
              </button>
            </div>
          )}
          {/* Toggle switch - absolutely positioned in lower right */}
          {isLinkToggle && (
            <div className="absolute bottom-4 right-4 z-10">
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Switch
                  checked={props.isEnabled}
                  onCheckedChange={props.onToggle}
                  disabled={props.disabled}
                  labelLeft="Skip"
                  labelRight={props.enabledLabel || "Add"}
                  className={props.isEnabled ? "bg-green-600" : "bg-slate-600"}
                />
              </div>
            </div>
          )}
        </>
      )}
    </>
  )

  const baseClassName = `relative flex ${isToggle ? "items-start gap-4" : "flex-col gap-3"} p-4 rounded-lg border-2 transition-colors h-full ${
    isIncompatible
      ? "border-slate-800 bg-slate-900/30 opacity-60 cursor-not-allowed"
      : prominent
        ? "border-cyan-400 bg-gradient-to-br from-cyan-500/30 via-cyan-600/20 to-blue-600/30 hover:from-cyan-500/40 hover:via-cyan-600/30 hover:to-blue-600/40 hover:border-cyan-300 shadow-xl shadow-cyan-500/30"
        : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
  } ${isLink ? "group" : ""}`

  if (isLink) {
    const href = props.href || `/builds?plugin=${id}`
    return (
      <a href={href} className={baseClassName}>
        {cardContent}
      </a>
    )
  }

  return <div className={baseClassName}>{cardContent}</div>
}

// Export convenience wrappers for backward compatibility
export function PluginToggle(props: Omit<PluginCardToggleProps, "variant">) {
  return <PluginCard {...props} variant="toggle" />
}
