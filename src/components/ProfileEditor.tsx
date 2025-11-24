import { useMutation } from 'convex/react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import modulesData from '../../convex/modules.json'
import { VERSIONS } from '../constants/versions'
import { ModuleCard } from './ModuleCard'

interface ProfileFormValues {
  name: string
  config: Record<string, boolean>
  version: string
  isPublic: boolean
}

interface ProfileEditorProps {
  initialData?: Doc<'profiles'>
  onSave: () => void
  onCancel: () => void
}

export default function ProfileEditor({
  initialData,
  onSave,
  onCancel,
}: ProfileEditorProps) {
  const createProfile = useMutation(api.profiles.create)
  const updateProfile = useMutation(api.profiles.update)

  const { register, handleSubmit, setValue, watch } =
    useForm<ProfileFormValues>({
      defaultValues: {
        name: initialData?.name || '',
        config: initialData?.config || {},
        version: initialData?.version || VERSIONS[0],
        isPublic: initialData?.isPublic ?? true,
      },
    })

  const onSubmit = async (data: ProfileFormValues) => {
    if (initialData?._id) {
      await updateProfile({
        id: initialData._id,
        name: data.name,
        config: data.config,
        version: data.version,
        isPublic: data.isPublic,
      })
    } else {
      await createProfile({
        name: data.name,
        config: data.config,
        version: data.version,
        isPublic: data.isPublic,
      })
    }
    onSave()
  }

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
            {...register('name')}
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
            {...register('version')}
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
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isPublic"
            checked={watch('isPublic')}
            onCheckedChange={(checked) => setValue('isPublic', !!checked)}
            disabled
          />
          <label
            htmlFor="isPublic"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Make profile public
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-1 ml-6">
          Public profiles are visible to everyone on the home page
        </p>
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
              const configValue = watch(`config.${module.id}`)
              const isIncluded = configValue === false

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
                    setValue(`config.${module.id}`, !!isIncluded)
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
