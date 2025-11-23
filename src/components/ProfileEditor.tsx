import { useMutation } from "convex/react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "../../convex/_generated/api";
import modulesData from "../../convex/modules.json";
import { TARGETS } from "../constants/targets";
import { VERSIONS } from "../constants/versions";
import { ModuleCard } from "./ModuleCard";

interface ProfileEditorProps {
	initialData?: any;
	onSave: () => void;
	onCancel: () => void;
}

export default function ProfileEditor({
	initialData,
	onSave,
	onCancel,
}: ProfileEditorProps) {
	const createProfile = useMutation(api.profiles.create);
	const updateProfile = useMutation(api.profiles.update);

	const { register, handleSubmit, setValue, watch } = useForm({
		defaultValues: initialData || {
			name: "",
			targets: [],
			config: {},
			version: VERSIONS[0],
		},
	});

	const targets = watch("targets");

	// Group targets by category
	const groupedTargets = React.useMemo(() => {
		return Object.entries(TARGETS).reduce(
			(acc, [id, meta]) => {
				const category = meta.category || "Other";
				if (!acc[category]) acc[category] = [];
				acc[category].push({ id, ...meta });
				return acc;
			},
			{} as Record<string, ((typeof TARGETS)[string] & { id: string })[]>,
		);
	}, []);

	const categories = React.useMemo(
		() => Object.keys(groupedTargets).sort(),
		[groupedTargets],
	);

	const [activeCategory, setActiveCategory] = React.useState<string>(
		categories[0] || "Heltec",
	);

	// Update active category when categories load if not set
	React.useEffect(() => {
		if (!activeCategory && categories.length > 0) {
			setActiveCategory(categories[0]);
		}
	}, [categories, activeCategory]);

	const toggleTarget = (target: string) => {
		const current = targets || [];
		if (current.includes(target)) {
			setValue(
				"targets",
				current.filter((t: string) => t !== target),
			);
		} else {
			setValue("targets", [...current, target]);
		}
	};

	const onSubmit = async (data: any) => {
		if (initialData?._id) {
			await updateProfile({
				id: initialData._id,
				name: data.name,
				targets: data.targets,
				config: data.config,
				version: data.version,
			});
		} else {
			await createProfile(data);
		}
		onSave();
	};

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="space-y-6 bg-slate-900 p-6 rounded-lg border border-slate-800"
		>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div>
					<label htmlFor="name" className="block text-sm font-medium mb-2">
						Profile Name
					</label>
					<Input
						id="name"
						{...register("name")}
						className="bg-slate-950 border-slate-800"
						placeholder="e.g. Solar Repeater"
					/>
				</div>
				<div>
					<label htmlFor="version" className="block text-sm font-medium mb-2">
						Firmware Version
					</label>
					<select
						id="version"
						{...register("version")}
						className="w-full h-10 px-3 rounded-md border border-slate-800 bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
					>
						{VERSIONS.map((v) => (
							<option key={v} value={v}>
								{v}
							</option>
						))}
					</select>
				</div>
			</div>

			<div>
				<label className="block text-sm font-medium mb-2">Targets</label>
				<div className="space-y-4">
					{/* Category Pills */}
					<div className="flex flex-wrap gap-2">
						{categories.map((category) => {
							const count = groupedTargets[category].filter((t) =>
								targets?.includes(t.id),
							).length;
							const isActive = activeCategory === category;

							return (
								<button
									key={category}
									type="button"
									onClick={() => setActiveCategory(category)}
									className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
										isActive
											? "bg-blue-600 text-white"
											: "bg-slate-800 text-slate-300 hover:bg-slate-700"
									}`}
								>
									{category}
									{count > 0 && (
										<span className="ml-2 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
											{count}
										</span>
									)}
								</button>
							);
						})}
					</div>

					{/* Active Category Targets */}
					<div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
						<div className="flex gap-4 flex-wrap">
							{groupedTargets[activeCategory]?.map((item) => (
								<div key={item.id} className="flex items-center space-x-2">
									<Checkbox
										id={item.id}
										checked={targets?.includes(item.id)}
										onCheckedChange={() => toggleTarget(item.id)}
									/>
									<label
										htmlFor={item.id}
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
									>
										{item.name}
										{item.architecture && (
											<span className="ml-2 text-xs text-slate-500">
												({item.architecture})
											</span>
										)}
									</label>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="space-y-6">
				<div>
					<div className="mb-4">
						<h3 className="text-lg font-medium">Modules</h3>
						<p className="text-sm text-slate-400">
							Select the modules to include in your build.
						</p>
					</div>
					<div className="flex flex-col gap-2">
						{modulesData.modules.map((module) => {
							// Inverted logic:
							// config[id] === false -> Explicitly Included
							// config[id] === true or undefined -> Excluded
							const configValue = watch(`config.${module.id}`);
							const isIncluded = configValue === false;

							return (
								<ModuleCard
									key={module.id}
									name={module.name}
									description={module.description}
									selected={isIncluded}
									onClick={() => {
										// Toggle:
										// If currently included (true), we want to exclude (set config to true)
										// If currently excluded (false), we want to include (set config to false)
										setValue(`config.${module.id}`, !!isIncluded);
									}}
								/>
							);
						})}
					</div>
				</div>
			</div>

			<div className="flex justify-end gap-4 pt-4">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit">Save Profile</Button>
			</div>
		</form>
	);
}
