import hardwareList from "../../vendor/web-flasher/public/data/hardware-list.json";

export interface TargetMetadata {
	name: string;
	category: string;
	architecture?: string;
}

export const TARGETS: Record<string, TargetMetadata> = {};

// Sort by display name
const sortedHardware = [...hardwareList].sort((a, b) => 
	(a.displayName || "").localeCompare(b.displayName || "")
);

sortedHardware.forEach((hw) => {
	if (hw.platformioTarget) {
		TARGETS[hw.platformioTarget] = {
			name: hw.displayName || hw.platformioTarget,
			category: hw.tags?.[0] || "Other",
			architecture: hw.architecture,
		};
	}
});
