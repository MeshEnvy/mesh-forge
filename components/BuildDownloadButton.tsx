import { SourceAvailable } from "@/components/SourceAvailable"
import { Button } from "@/components/ui/button"
import { useMutation } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"
import { api } from "../convex/_generated/api"
import type { Doc } from "../convex/_generated/dataModel"
import { ArtifactType } from "../convex/builds"

interface BuildDownloadButtonProps {
  build: Doc<"builds">
  type: ArtifactType
  variant?: "default" | "outline"
  className?: string
}

export function BuildDownloadButton({ build, type, variant, className }: BuildDownloadButtonProps) {
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

  const button = (
    <div className="space-y-2">
      <Button onClick={handleDownload} disabled={isLoading} variant={defaultVariant} className={defaultClassName}>
        Download {type === ArtifactType.Firmware ? "firmware" : "source"}
      </Button>
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
