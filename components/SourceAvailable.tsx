interface SourceAvailableProps {
  sourcePath: string | undefined
  children: React.ReactNode
}

/**
 * Component that only renders children when sourcePath is available.
 * Uses the sourcePath field from the build instead of polling.
 */
export function SourceAvailable({ sourcePath, children }: SourceAvailableProps) {
  if (!sourcePath) {
    return null
  }

  return <>{children}</>
}
