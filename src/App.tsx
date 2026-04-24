import Footer from "@/components/Footer"
import Navbar from "@/components/Navbar"
import { SocialCornerBadges } from "@/components/SocialCornerBadges"
import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import AdminPage from "./pages/AdminPage"
import HomePage from "./pages/HomePage"
import LegalLicensePage from "./pages/LegalLicensePage"
import LegalPrivacyPage from "./pages/LegalPrivacyPage"
import LegalTermsPage from "./pages/LegalTermsPage"
import NotFoundPage from "./pages/NotFoundPage"
import RepoPage from "./pages/RepoPage"
import MapPage from "./pages/MapPage"

function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  const hideNav = loc.pathname === "/"
  return (
    <div className="min-h-screen flex flex-col">
      <SocialCornerBadges />
      {!hideNav && <Navbar />}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs/*" element={<Navigate to="/" replace />} />
        <Route path="/flasher" element={<Navigate to="/" replace />} />
        <Route path="/flasher/*" element={<Navigate to="/" replace />} />
        <Route path="/privacy" element={<LegalPrivacyPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/terms" element={<LegalTermsPage />} />
        <Route path="/license" element={<LegalLicensePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/:owner/:repo/tree/*" element={<RepoPage />} />
        <Route path="/:owner/:repo" element={<RepoPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}
