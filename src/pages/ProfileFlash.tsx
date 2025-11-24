import { useParams } from 'react-router-dom'

export default function ProfileFlash() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Flash Firmware</h1>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <p className="text-slate-400">Flash functionality coming soon...</p>
          <p className="text-slate-500 text-sm mt-2">Profile ID: {id}</p>
        </div>
      </div>
    </div>
  )
}
