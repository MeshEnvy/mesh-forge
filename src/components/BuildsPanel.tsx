import { useMutation, useQuery } from "convex/react";
import {
	Clock,
	CheckCircle,
	XCircle,
	Loader2,
	Trash2,
	RotateCw,
	ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface BuildsPanelProps {
	profileId: Id<"profiles">;
}

export default function BuildsPanel({ profileId }: BuildsPanelProps) {
	const builds = useQuery(api.builds.listByProfile, { profileId });
	const deleteBuild = useMutation(api.builds.deleteBuild);
	const retryBuild = useMutation(api.builds.retryBuild);

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "success":
				return <CheckCircle className="w-4 h-4 text-green-500" />;
			case "failure":
				return <XCircle className="w-4 h-4 text-red-500" />;
			case "in_progress":
				return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
			default:
				return <Clock className="w-4 h-4 text-yellow-500" />;
		}
	};

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

	const handleDelete = async (buildId: Id<"builds">) => {
		try {
			await deleteBuild({ buildId });
			toast.success("Build deleted", {
				description: "Build record has been removed.",
			});
		} catch (error) {
			toast.error("Delete failed", {
				description: String(error),
			});
		}
	};

	const handleRetry = async (buildId: Id<"builds">) => {
		try {
			await retryBuild({ buildId });
			toast.success("Build retrying", {
				description: "Build has been queued again.",
			});
		} catch (error) {
			toast.error("Retry failed", {
				description: String(error),
			});
		}
	};

	if (!builds || builds.length === 0) {
		return (
			<div className="text-slate-500 text-sm py-4">
				No builds yet. Click "Build" to start.
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<h3 className="text-lg font-semibold">Build History</h3>
			{builds.map((build) => (
				<div
					key={build._id}
					className="border border-slate-800 rounded-lg p-4 bg-slate-900/30"
				>
					<div className="flex items-start justify-between mb-2">
						<Link
							to={`/builds/${build._id}`}
							className="flex items-center gap-2 hover:opacity-80"
						>
							{getStatusIcon(build.status)}
							<span className="font-medium hover:underline">
								{build.target}
							</span>
							<span className={`text-sm ${getStatusColor(build.status)}`}>
								{build.status}
							</span>
						</Link>
						<div className="flex gap-2">
							{build.status === "failure" && (
								<Button
									size="sm"
									variant="ghost"
									onClick={() => handleRetry(build._id)}
								>
									<RotateCw className="w-4 h-4" />
								</Button>
							)}
							<Button
								size="sm"
								variant="ghost"
								onClick={() => handleDelete(build._id)}
							>
								<Trash2 className="w-4 h-4" />
							</Button>
						</div>
					</div>

					{build.logs && (
						<pre className="text-xs bg-slate-950 p-2 rounded mt-2 overflow-x-auto text-slate-400 max-h-32 overflow-y-auto">
							{build.logs.split("\n").slice(-5).join("\n")}
						</pre>
					)}

					<div className="flex items-center justify-between mt-3">
						<Link
							to={`/builds/${build._id}`}
							className="text-sm text-cyan-400 hover:underline flex items-center gap-1"
						>
							View Details <ExternalLink className="w-3 h-3" />
						</Link>

						{build.artifactUrl && (
							<a
								href={build.artifactUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-cyan-400 hover:underline"
							>
								Download Artifact →
							</a>
						)}
					</div>

					<div className="text-xs text-slate-500 mt-2">
						Started: {new Date(build.startedAt).toLocaleString()}
					</div>
				</div>
			))}
		</div>
	);
}
