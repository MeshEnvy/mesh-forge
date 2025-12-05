import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { DiscordButton } from '@/components/DiscordButton'
import { RedditButton } from '@/components/RedditButton'

function QuickBuildIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Quick build"
      {...props}
    >
      <title>Quick build</title>
      <path fill="currentColor" d="M11 15H6l7-14v8h5l-7 14z" />
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-20 px-8">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-[1.1]">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent inline-block pb-2">
              Build firmware right from your bench
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto mb-10">
            Craft custom Meshtastic firmware in the cloud, flash from your
            browser, and share your builds with the community.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <Button
              onClick={() => navigate('/builds/new')}
              size="lg"
              variant="outline"
              className="border-cyan-500/50 text-white hover:bg-slate-900/60"
            >
              <QuickBuildIcon className="mr-2 h-5 w-5" />
              Quick Build
            </Button>
            <DiscordButton
              size="lg"
              variant="default"
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-purple-500/50"
            />
            <RedditButton
              size="lg"
              variant="default"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 shadow-lg shadow-orange-500/50"
            />
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto mb-10">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                Zero Install
              </h3>
              <p className="text-slate-300 text-sm">
                No downloads, no toolchains. Everything runs in your browser.
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                Custom Firmware
              </h3>
              <p className="text-slate-300 text-sm">
                Build bespoke Meshtastic firmware tailored to your exact needs.
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                Community Extensions
              </h3>
              <p className="text-slate-300 text-sm">
                Include community modules and extensions beyond core Meshtastic.
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left md:col-span-2 lg:col-span-1">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                Share & Remix
              </h3>
              <p className="text-slate-300 text-sm">
                Publish your build profiles and let others remix your configs.
              </p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-left md:col-span-2 lg:col-span-2">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">
                Cloud Builds
              </h3>
              <p className="text-slate-300 text-sm">
                Compile in the cloud, flash directly to your device—no local
                setup required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
