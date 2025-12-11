import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface BuildActionsProps {
  selectedTargetLabel: string
  isFlashing: boolean
  isFlashDisabled: boolean
  errorMessage: string | null
  onFlash: () => void
}

export function BuildActions({
  selectedTargetLabel,
  isFlashing,
  isFlashDisabled,
  errorMessage,
  onFlash,
}: BuildActionsProps) {
  return (
    <div className="space-y-2">
      <Button onClick={onFlash} disabled={isFlashDisabled} className="w-full bg-cyan-600 hover:bg-cyan-700">
        {isFlashing ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Queuing build...
          </span>
        ) : (
          `Flash ${selectedTargetLabel || ""}`.trim() || "Flash"
        )}
      </Button>
      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
    </div>
  )
}
