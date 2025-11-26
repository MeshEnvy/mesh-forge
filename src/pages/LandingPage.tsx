import { useAuthActions } from '@convex-dev/auth/react'
import { Authenticated, Unauthenticated } from 'convex/react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

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

function BrowseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Browse"
      {...props}
    >
      <title>Browse</title>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16.33 3.75H6.67c-.535 0-.98 0-1.345.03c-1.411.115-2.432 1.164-2.545 2.545c-.03.365-.03.812-.03 1.345v8.66c0 .535 0 .98.03 1.345c.03.38.098.736.27 1.073a2.75 2.75 0 0 0 1.202 1.202c.337.172.693.24 1.073.27c.365.03.81.03 1.344.03h9.662c.534 0 .98 0 1.344-.03c.38-.03.736-.098 1.073-.27a.75.75 0 0 0-.68-1.336c-.091.046-.228.088-.516.111c-.295.024-.68.025-1.252.025H6.7c-.572 0-.957 0-1.253-.025c-.287-.023-.424-.065-.514-.111a1.25 1.25 0 0 1-.547-.547c-.046-.09-.088-.227-.111-.515c-.024-.295-.025-.68-.025-1.252V8.25h14.486q.012.625.014 1.25a.75.75 0 1 0 1.5 0q0-.28-.003-.558c-.007-.67-.027-1.807-.091-2.618c-.113-1.424-1.072-2.43-2.481-2.544c-.365-.03-.81-.03-1.345-.03m2.352 3c-.048-.797-.278-1.406-1.13-1.475c-.295-.024-.68-.025-1.252-.025H6.7c-.572 0-.957 0-1.253.025c-.818.067-1.163.68-1.189 1.475z"
        clipRule="evenodd"
      />
      <path
        fill="currentColor"
        d="M6.5 9.25a.75.75 0 0 0 0 1.5h6a.75.75 0 0 0 0-1.5z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M17 10.25a3.25 3.25 0 1 0 1.706 6.017l1.264 1.263a.75.75 0 1 0 1.06-1.06l-1.263-1.264A3.25 3.25 0 0 0 17 10.25m-1.75 3.25a1.75 1.75 0 1 1 3.5 0a1.75 1.75 0 0 1-3.5 0"
        clipRule="evenodd"
      />
      <path
        fill="currentColor"
        d="M6.5 11.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5zm0 3a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5zm0 2a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5z"
      />
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { signIn } = useAuthActions()

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
            <Button
              onClick={() => navigate('/browse')}
              size="lg"
              variant="outline"
              className="border-cyan-500/50 text-white hover:bg-slate-900/60"
            >
              <BrowseIcon className="mr-2 h-5 w-5" />
              Browse Builds
            </Button>
            <Authenticated>
              <Button
                onClick={() => navigate('/dashboard')}
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-8 h-8"
                  aria-label="Dashboard icon"
                >
                  <title>Dashboard icon</title>
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M14.748 0a1.75 1.75 0 0 0-1.75 1.75v4.5c0 .966.784 1.75 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75v-4.5A1.75 1.75 0 0 0 22.248 0zm0 10a1.75 1.75 0 0 0-1.75 1.75v10.5c0 .967.784 1.75 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75v-10.5a1.75 1.75 0 0 0-1.75-1.75zM.002 1.75C.002.784.785 0 1.752 0h7.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 9.252 14h-7.5a1.75 1.75 0 0 1-1.75-1.75zM1.752 16a1.75 1.75 0 0 0-1.75 1.75v4.5c0 .966.783 1.75 1.75 1.75h7.5a1.75 1.75 0 0 0 1.75-1.75v-4.5A1.75 1.75 0 0 0 9.252 16z"
                    clipRule="evenodd"
                  />
                </svg>
                Go to Dashboard
              </Button>
            </Authenticated>
            <Unauthenticated>
              <Button
                onClick={() =>
                  signIn('google', { redirectTo: window.location.href })
                }
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-200"
              >
                Sign in
              </Button>
            </Unauthenticated>
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
