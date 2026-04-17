import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useId } from "react"

function RedditIcon(props: React.SVGProps<SVGSVGElement> & { maskId: string }) {
  const { maskId, ...rest } = props
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...rest}>
      <mask id={maskId}>
        <g fill="#fff">
          <path
            fillOpacity="0"
            stroke="#fff"
            strokeDasharray="48"
            strokeDashoffset="48"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9.42c4.42 0 8 2.37 8 5.29c0 2.92 -3.58 5.29 -8 5.29c-4.42 0 -8 -2.37 -8 -5.29c0 -2.92 3.58 -5.29 8 -5.29Z"
          >
            <animate fill="freeze" attributeName="fill-opacity" begin="0.6s" dur="0.4s" values="0;1" />
            <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="48;0" />
          </path>
          <circle cx="7.24" cy="11.97" r="2.24" opacity="0">
            <animate fill="freeze" attributeName="cx" begin="1s" dur="0.2s" values="7.24;3.94" />
            <set fill="freeze" attributeName="opacity" begin="1s" to="1" />
          </circle>
          <circle cx="16.76" cy="11.97" r="2.24" opacity="0">
            <animate fill="freeze" attributeName="cx" begin="1s" dur="0.2s" values="16.76;20.06" />
            <set fill="freeze" attributeName="opacity" begin="1s" to="1" />
          </circle>
          <circle cx="18.45" cy="4.23" r="1.61" opacity="0">
            <animate attributeName="cx" begin="2.4s" dur="6s" repeatCount="indefinite" values="18.45;5.75;18.45" />
            <set fill="freeze" attributeName="opacity" begin="2.6s" to="1" />
          </circle>
        </g>
        <path
          fill="none"
          stroke="#fff"
          strokeDasharray="12"
          strokeDashoffset="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth=".8"
          d="M12 8.75L13.18 3.11L18.21 4.18"
        >
          <animate
            attributeName="d"
            begin="2.4s"
            dur="6s"
            repeatCount="indefinite"
            values="M12 8.75L13.18 3.11L18.21 4.18;M12 8.75L12 2L12 4.18;M12 8.75L10.82 3.11L5.79 4.18;M12 8.75L12 2L12 4.18;M12 8.75L13.18 3.11L18.21 4.18"
          />
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="2.4s" dur="0.2s" values="12;0" />
        </path>
        <g fillOpacity="0">
          <circle cx="8.45" cy="13.59" r="1.61">
            <animate fill="freeze" attributeName="fill-opacity" begin="1.2s" dur="0.4s" values="0;1" />
          </circle>
          <circle cx="15.55" cy="13.59" r="1.61">
            <animate fill="freeze" attributeName="fill-opacity" begin="1.6s" dur="0.4s" values="0;1" />
          </circle>
        </g>
        <path
          fill="none"
          stroke="#000"
          strokeDasharray="10"
          strokeDashoffset="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth=".8"
          d="M8.47 17.52c0 0 0.94 1.06 3.53 1.06c2.58 0 3.53 -1.06 3.53 -1.06"
        >
          <animate fill="freeze" attributeName="stroke-dashoffset" begin="2s" dur="0.2s" values="10;0" />
        </path>
      </mask>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

interface RedditButtonProps {
  variant?: "default" | "outline" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  iconOnly?: boolean
}

export function RedditButton({ variant = "outline", size, className, iconOnly }: RedditButtonProps) {
  const maskId = useId().replace(/:/g, "")
  return (
    <a
      href="https://www.reddit.com/r/MeshForge/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={iconOnly ? "r/MeshForge on Reddit" : undefined}
    >
      <Button
        variant={variant}
        size={iconOnly ? "icon" : size}
        className={cn(iconOnly ? "shrink-0" : "flex items-center gap-2", className)}
      >
        <RedditIcon maskId={maskId} className={iconOnly ? "h-[18px] w-[18px]" : "w-4 h-4"} />
        {!iconOnly ? "Reddit" : null}
      </Button>
    </a>
  )
}
