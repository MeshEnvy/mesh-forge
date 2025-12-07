import "./Layout.css";
import "./tailwind.css";
import logoUrl from "../assets/logo.png";
import { Link } from "../components/Link";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import Navbar from "@/components/Navbar";
import { usePageContext } from "vike-react/usePageContext";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function ConditionalNavbar() {
  const pageContext = usePageContext();
  if (pageContext.urlPathname === "/") {
    return null;
  }
  return <Navbar />;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <ConditionalNavbar />
      {children}
    </ConvexAuthProvider>
  );
}
