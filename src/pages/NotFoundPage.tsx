import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

export default function NotFoundPage() {
  return (
    <div className="px-6 py-16 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8">That URL does not match anything in MeshForge.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="default">
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  )
}
