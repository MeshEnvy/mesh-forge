import { useMutation } from "convex/react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "../../convex/_generated/api";

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
			config: {
				MESHTASTIC_EXCLUDE_MQTT: false,
				MESHTASTIC_EXCLUDE_AUDIO: false,
			},
		},
	});

	const targets = watch("targets");

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
			await updateProfile({ id: initialData._id, ...data });
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
			<div>
				<label className="block text-sm font-medium mb-2">Profile Name</label>
				<Input
					{...register("name")}
					className="bg-slate-950 border-slate-800"
					placeholder="e.g. Solar Repeater"
				/>
			</div>

			<div>
				<label className="block text-sm font-medium mb-2">Targets</label>
				<div className="flex gap-4 flex-wrap">
					{["tbeam", "rak4631", "heltec_v3", "pico"].map((t) => (
						<div key={t} className="flex items-center space-x-2">
							<Checkbox
								id={t}
								checked={targets?.includes(t)}
								onCheckedChange={() => toggleTarget(t)}
							/>
							<label
								htmlFor={t}
								className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								{t}
							</label>
						</div>
					))}
				</div>
			</div>

			<div>
				<label className="block text-sm font-medium mb-2">
					Configuration Flags
				</label>
				<div className="space-y-2">
					<div className="flex items-center space-x-2">
						<Checkbox
							id="no_mqtt"
							checked={watch("config.MESHTASTIC_EXCLUDE_MQTT")}
							onCheckedChange={(checked) =>
								setValue("config.MESHTASTIC_EXCLUDE_MQTT", checked)
							}
						/>
						<label htmlFor="no_mqtt">Exclude MQTT</label>
					</div>
					<div className="flex items-center space-x-2">
						<Checkbox
							id="no_audio"
							checked={watch("config.MESHTASTIC_EXCLUDE_AUDIO")}
							onCheckedChange={(checked) =>
								setValue("config.MESHTASTIC_EXCLUDE_AUDIO", checked)
							}
						/>
						<label htmlFor="no_audio">Exclude Audio</label>
					</div>
				</div>
			</div>

			<div className="flex gap-2 justify-end">
				<Button type="button" variant="ghost" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit">Save Profile</Button>
			</div>
		</form>
	);
}
