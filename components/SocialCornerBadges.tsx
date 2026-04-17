import { DiscordButton } from "@/components/DiscordButton"
import { RedditButton } from "@/components/RedditButton"
import { cn } from "@/lib/utils"

export function SocialCornerBadges({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "fixed right-3 top-3 z-50 flex items-center gap-2 sm:right-4 sm:top-4",
        className
      )}
    >
      <DiscordButton
        iconOnly
        variant="ghost"
        className="h-9 w-9 rounded-full border-0 bg-transparent text-slate-500 shadow-none hover:bg-transparent hover:text-slate-200"
      />
      <RedditButton
        iconOnly
        variant="ghost"
        className="h-9 w-9 rounded-full border-0 bg-transparent text-slate-500 shadow-none hover:bg-transparent hover:text-slate-200"
      />
    </div>
  )
}
