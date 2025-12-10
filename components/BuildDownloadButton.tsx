import { SourceAvailable } from "@/components/SourceAvailable"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { ArtifactType } from "@/convex/lib/filename"
import { useMutation } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"

interface BuildDownloadButtonProps {
  build: Doc<"builds">
  type: ArtifactType
  variant?: "default" | "outline"
  className?: string
  compact?: boolean
}

export function BuildDownloadButton({ build, type, variant, className, compact = false }: BuildDownloadButtonProps) {
  const generateDownloadUrl = useMutation(api.builds.generateDownloadUrl)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default styling based on type
  const defaultVariant = variant ?? (type === ArtifactType.Firmware ? "default" : "outline")
  const defaultClassName =
    className ?? (type === ArtifactType.Firmware ? "bg-cyan-600 hover:bg-cyan-700" : "bg-slate-700 hover:bg-slate-600")

  const handleDownload = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const url = await generateDownloadUrl({
        buildId: build._id,
        artifactType: type,
      })
      window.location.href = url
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const errorMsg =
        type === ArtifactType.Firmware
          ? "Failed to generate download link."
          : "Failed to generate source download link."
      setError(errorMsg)
      toast.error(errorMsg, {
        description: message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (type === ArtifactType.Firmware && !build.buildHash) return null

  const buttonElement = (
    <Button onClick={handleDownload} disabled={isLoading} variant={defaultVariant} className={defaultClassName}>
      {type === ArtifactType.Firmware && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        >
          <rect width="3" height="4.5" x="3.25" y="1.75" />
          <path d="m9.75 6.25h3m-3-4.5h1.5v4" />
          <rect width="3" height="4.5" x="9.75" y="9.75" />
          <path d="m3.25 14.25h3m-3-4.5h1.5v4" />
        </svg>
      )}
      {type === ArtifactType.Source && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M9.5 5H9a2 2 0 0 0-2 2v2c0 1-.6 3-3 3c1 0 3 .6 3 3v2a2 2 0 0 0 2 2h.5m5-14h.5a2 2 0 0 1 2 2v2c0 1 .6 3 3 3c-1 0-3 .6-3 3v2a2 2 0 0 1-2 2h-.5" />
        </svg>
      )}
      Download {type === ArtifactType.Firmware ? "firmware" : "source"}
    </Button>
  )

  if (compact) {
    return buttonElement
  }

  const button = (
    <div className="space-y-2">
      {buttonElement}
      {type === ArtifactType.Firmware && (
        <p className="text-xs text-slate-400 text-center">
          Need help flashing?{" "}
          <a href="/docs/esp32" className="text-cyan-400 hover:text-cyan-300 underline">
            ESP32
          </a>{" "}
          and{" "}
          <a href="/docs/nRF52" className="text-cyan-400 hover:text-cyan-300 underline">
            nRF52
          </a>
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )

  // For source downloads, only show when sourcePath is available
  if (type === ArtifactType.Source) {
    return <SourceAvailable sourcePath={build.sourcePath}>{button}</SourceAvailable>
  }

  return button
}
