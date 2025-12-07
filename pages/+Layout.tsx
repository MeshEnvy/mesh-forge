import Navbar from "@/components/Navbar"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexReactClient } from "convex/react"
import { usePageContext } from "vike-react/usePageContext"
import "./Layout.css"
import "./tailwind.css"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

function ConditionalNavbar() {
  const pageContext = usePageContext()
  if (pageContext.urlPathname === "/") {
    return null
  }
  return <Navbar />
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ConditionalNavbar />
      {children}
    </ConvexAuthProvider>
  )
}
