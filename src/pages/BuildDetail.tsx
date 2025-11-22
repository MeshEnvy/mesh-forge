import { useQuery } from "convex/react";
import {
	ArrowLeft,
	CheckCircle,
	Clock,
	Download,
	Loader2,
	Terminal,
	XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function BuildDetail() {
	const { buildId } = useParams<{ buildId: string }>();
	const build = useQuery(api.builds.get, {
		buildId: buildId as Id<"builds">,
	});

	if (build === undefined) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
				<Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
			</div>
		);
	}

	if (build === null) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-4">
				<h1 className="text-2xl font-bold">Build Not Found</h1>
				<Link to="/">
					<Button variant="outline">Return to Dashboard</Button>
				</Link>
			</div>
		);
	}

	const getStatusColor = (status: string) => {
		switch (status) {
			case "success":
				return "text-green-400";
			case "failure":
				return "text-red-400";
			case "in_progress":
				return "text-blue-400";
			default:
				return "text-yellow-400";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "success":
				return <CheckCircle className="w-6 h-6 text-green-500" />;
			case "failure":
				return <XCircle className="w-6 h-6 text-red-500" />;
			case "in_progress":
				return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
			default:
				return <Clock className="w-6 h-6 text-yellow-500" />;
		}
	};

	return (
		<div className="min-h-screen bg-slate-950 text-white p-8">
			<div className="max-w-4xl mx-auto">
				<header className="mb-8">
					<Link
						to="/"
						className="inline-flex items-center text-slate-400 hover:text-white mb-4"
					>
						<ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
					</Link>

					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							{getStatusIcon(build.status)}
							<div>
								<h1 className="text-3xl font-bold">{build.target}</h1>
								<div className="flex items-center gap-2 text-slate-400 mt-1">
									<span>Build ID: {build._id}</span>
									<span>•</span>
									<span className={getStatusColor(build.status)}>
										{build.status.toUpperCase()}
									</span>
									<span>•</span>
									<span>{new Date(build.startedAt).toLocaleString()}</span>
								</div>
							</div>
						</div>

						{build.artifactUrl && (
							<a
								href={build.artifactUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								<Button className="bg-cyan-600 hover:bg-cyan-700">
									<Download className="w-4 h-4 mr-2" /> Download Firmware
								</Button>
							</a>
						)}
					</div>
				</header>

				<main className="space-y-6">
					<div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
						<div className="flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-slate-800">
							<Terminal className="w-4 h-4 text-slate-400" />
							<span className="font-mono text-sm text-slate-300">
								Build Logs
							</span>
						</div>
						<div className="p-4 overflow-x-auto">
							<pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap">
								{build.logs || "No logs available..."}
							</pre>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
