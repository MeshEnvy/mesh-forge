import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
	const { signIn } = useAuthActions();

	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
			<h1 className="text-5xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
				Firmware Configurator
			</h1>
			<p className="text-xl text-slate-400 mb-12 max-w-md text-center">
				Manage your Meshtastic fleet. Create custom profiles, build firmware in
				the cloud, and flash directly from your browser.
			</p>
			<Button
				onClick={() => signIn("google")}
				className="bg-white text-slate-900 hover:bg-slate-200 text-lg px-8 py-6"
			>
				Sign in with Google
			</Button>
		</div>
	);
}
