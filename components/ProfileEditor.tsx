import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useMutation } from "convex/react"
import { useForm } from "react-hook-form"
import { VERSIONS } from "../constants/versions"
import { api } from "../convex/_generated/api"
import type { Doc } from "../convex/_generated/dataModel"
import modulesData from "../convex/modules.json"
import { ModuleToggle } from "./ModuleToggle"

// Form values use flattened config for UI, but will be transformed to nested on submit
type ProfileFormValues = Omit<Doc<"profiles">, "_id" | "_creationTime" | "userId" | "flashCount" | "updatedAt">

interface ProfileEditorProps {
  initialData?: Doc<"profiles">
  onSave: () => void
  onCancel: () => void
}

export default function ProfileEditor({ initialData, onSave, onCancel }: ProfileEditorProps) {
  const upsertProfile = useMutation(api.profiles.upsert)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      config: {
        version: VERSIONS[0],
        modulesExcluded: {},
        target: "",
        ...initialData?.config,
      },
      isPublic: initialData?.isPublic ?? true,
    },
  })

  const onSubmit = async (data: ProfileFormValues) => {
    await upsertProfile({
      id: initialData?._id,
      name: data.name,
      description: data.description,
      config: data.config,
      isPublic: data.isPublic,
    })
    onSave()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-slate-900 p-6 rounded-lg border border-slate-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Profile Name
          </label>
          <Input
            id="name"
            {...register("name", { required: "Profile name is required" })}
            className="bg-slate-950 border-slate-800"
            placeholder="e.g. Solar Repeater"
          />
          {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="version" className="block text-sm font-medium mb-2">
            Firmware Version
          </label>
          <select
            id="version"
            {...register("config.version")}
            className="w-full h-10 px-3 rounded-md border border-slate-800 bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {VERSIONS.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Description
        </label>
        <textarea
          id="description"
          {...register("description", {
            required: "Profile description is required",
          })}
          className="w-full min-h-[120px] rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          placeholder="Describe what this profile is best suited for"
        />
        {errors.description && <p className="mt-1 text-sm text-red-400">{errors.description.message}</p>}
      </div>

      <div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isPublic"
            checked={watch("isPublic")}
            onCheckedChange={checked => setValue("isPublic", !!checked)}
            disabled
          />
          <label
            htmlFor="isPublic"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Make profile public
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-1 ml-6">Public profiles are visible to everyone on the home page</p>
      </div>

      <div className="space-y-6">
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-medium">Modules</h3>
            <p className="text-sm text-slate-400">
              Modules are included by default if supported by your target. Toggle to exclude modules you don't need.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {modulesData.modules.map(module => {
              // Flattened config: config[id] === true -> Explicitly Excluded
              // config[id] === undefined/false -> Default (included if target supports)
              const currentConfig = watch("config") as Doc<"builds">["config"]
              const configValue = currentConfig.modulesExcluded[module.id]
              const isExcluded = configValue === true

              return (
                <ModuleToggle
                  key={module.id}
                  id={module.id}
                  name={module.name}
                  description={module.description}
                  isExcluded={isExcluded}
                  onToggle={excluded => {
                    const newConfig = { ...currentConfig }
                    if (excluded) {
                      newConfig.modulesExcluded[module.id] = true
                    } else {
                      delete newConfig.modulesExcluded[module.id]
                    }
                    setValue("config", newConfig)
                  }}
                />
              )
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
  )
}
