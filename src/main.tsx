import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { ConvexReactClient } from "convex/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { Toaster } from "sonner"
import App from "./App"
import { bootstrapAppHead } from "./bootstrapAppHead"
import "./index.css"

bootstrapAppHead()

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <App />
        <Toaster richColors theme="dark" />
      </BrowserRouter>
    </ConvexAuthProvider>
  </StrictMode>
)
