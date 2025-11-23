import { useMutation, useQuery } from "convex/react";
import {
	CheckCircle,
	Clock,
	Loader2,
	RotateCw,
	Trash2,
	XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
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
		<div className="space-y-2">
			<h3 className="text-lg font-semibold mb-3">Build Status</h3>
			<div className="space-y-1">
				{builds.map((build) => (
					<div
						key={build._id}
						className="group flex items-center justify-between p-2 rounded-md hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-800"
					>
						<Link
							to={`/builds/${build._id}`}
							className="flex items-center gap-3 flex-1 min-w-0"
						>
							{getStatusIcon(build.status)}
							<span className="font-medium text-sm truncate min-w-[100px]">
								{build.target}
							</span>
							<span className={`text-xs ${getStatusColor(build.status)}`}>
								{build.status}
							</span>
							<span
								className="text-xs text-slate-500 ml-auto mr-4 whitespace-nowrap"
								title={new Date(build.startedAt).toLocaleString()}
							>
								{timeAgo(build.startedAt)}
							</span>
						</Link>

						<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							{build.status === "failure" && (
								<Button
									size="icon"
									variant="ghost"
									className="h-8 w-8 text-slate-400 hover:text-white"
									onClick={(e) => {
										e.preventDefault();
										handleRetry(build._id);
									}}
									title="Retry Build"
								>
									<RotateCw className="w-4 h-4" />
								</Button>
							)}
							<Button
								size="icon"
								variant="ghost"
								className="h-8 w-8 text-slate-400 hover:text-red-400"
								onClick={(e) => {
									e.preventDefault();
									handleDelete(build._id);
								}}
								title="Delete Build"
							>
								<Trash2 className="w-4 h-4" />
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
