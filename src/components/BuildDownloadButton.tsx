import { useMutation } from 'convex/react'
import { pick } from 'convex-helpers'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '../../convex/_generated/api'
import { type BuildFields, buildFields } from '../../convex/schema'

interface BuildDownloadButtonProps {
  build: BuildFields
  type: 'firmware' | 'source'
  variant?: 'default' | 'outline'
  className?: string
}

export function BuildDownloadButton({
  build,
  type,
  variant,
  className,
}: BuildDownloadButtonProps) {
  const generateDownloadUrl = useMutation(
    api.builds.generateAnonymousDownloadUrl
  )
  const generateSourceDownloadUrl = useMutation(
    api.builds.generateAnonymousSourceDownloadUrl
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default styling based on type
  const defaultVariant =
    variant ?? (type === 'firmware' ? 'default' : 'outline')
  const defaultClassName =
    className ??
    (type === 'firmware'
      ? 'bg-cyan-600 hover:bg-cyan-700'
      : 'bg-slate-700 hover:bg-slate-600')

  const handleDownload = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const url =
        type === 'firmware'
          ? await generateDownloadUrl({
              build: pick(
                build,
                Object.keys(buildFields) as (keyof BuildFields)[]
              ),
              slug: 'download',
            })
          : await generateSourceDownloadUrl({
              build: pick(
                build,
                Object.keys(buildFields) as (keyof BuildFields)[]
              ),
              slug: 'download',
            })
      window.location.href = url
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const errorMsg =
        type === 'firmware'
          ? 'Failed to generate download link.'
          : 'Failed to generate source download link.'
      setError(errorMsg)
      toast.error(errorMsg, {
        description: message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (type === 'firmware' && !build.artifactPath) return null
  if (type === 'source' && !build.sourceUrl && !build.buildHash) return null

  return (
    <div className="space-y-2">
      <Button
        onClick={handleDownload}
        disabled={isLoading}
        variant={defaultVariant}
        className={defaultClassName}
      >
        Download {type === 'firmware' ? 'firmware' : 'source'}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
