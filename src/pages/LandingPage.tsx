import { useQuery } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'

export default function LandingPage() {
  const navigate = useNavigate()
  const profiles = useQuery(api.profiles.listPublic)

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center py-20 px-8">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-[1.1]">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent inline-block pb-2">
              Manage your Meshtastic fleet
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto">
            Create custom profiles, build firmware in the cloud, and flash
            directly from your browser.
          </p>
        </div>

        <main className="px-8 pb-8">
          {profiles === undefined ? (
            <div className="text-center text-slate-400 py-12">
              Loading profiles...
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No public profiles available yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profiles.map((profile) => (
                <button
                  key={profile._id}
                  type="button"
                  onClick={() => navigate(`/profiles/${profile._id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/profiles/${profile._id}`)
                    }
                  }}
                  className="border border-slate-800 rounded-lg p-6 bg-slate-900/50 hover:bg-slate-900 cursor-pointer transition-colors text-left"
                >
                  <h3 className="text-xl font-semibold mb-2">{profile.name}</h3>
                  <p className="text-slate-400 text-sm">
                    Version:{' '}
                    <span className="text-slate-200">{profile.version}</span>
                  </p>
                  <p className="text-slate-300 text-sm mt-3 leading-relaxed">
                    {profile.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
