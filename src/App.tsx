import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import BuildDetail from "./pages/BuildDetail";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";

function App() {
	return (
		<BrowserRouter>
			<AuthLoading>
				<div className="flex items-center justify-center min-h-screen bg-slate-950">
					<Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
				</div>
			</AuthLoading>

			<Unauthenticated>
				<Routes>
					<Route path="/" element={<LandingPage />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</Unauthenticated>

			<Authenticated>
				<Routes>
					<Route path="/" element={<Dashboard />} />
					<Route path="/builds/:buildId" element={<BuildDetail />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</Authenticated>
			<Toaster />
		</BrowserRouter>
	);
}

export default App;
