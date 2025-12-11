import { VERSIONS } from "@/constants/versions"

interface VersionSelectorProps {
  selectedVersion: string
  onVersionChange: (version: string) => void
}

export function VersionSelector({ selectedVersion, onVersionChange }: VersionSelectorProps) {
  return (
    <div>
      <label htmlFor="build-version" className="block text-sm font-medium mb-2">
        Firmware version
      </label>
      <select
        id="build-version"
        value={selectedVersion}
        onChange={event => onVersionChange(event.target.value)}
        className="w-full h-10 px-3 rounded-md border border-slate-800 bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
      >
        {VERSIONS.map(version => (
          <option key={version} value={version}>
            {version}
          </option>
        ))}
      </select>
    </div>
  )
}
