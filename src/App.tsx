import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
} from "convex/react";
import { Loader2 } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";

function App() {
	return (
		<>
			<AuthLoading>
				<div className="flex items-center justify-center min-h-screen bg-slate-950">
					<Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
				</div>
			</AuthLoading>
			<Unauthenticated>
				<LandingPage />
			</Unauthenticated>
			<Authenticated>
				<Dashboard />
			</Authenticated>
		</>
	);
}

export default App;
