import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseGithubUrl } from '../lib/parseGithubUrl'

function encodeBranchPath(ref: string) {
  return ref.split('/').map(encodeURIComponent).join('/')
}

const DEMO_REPOS: { label: string; owner: string; repo: string; githubUrl: string }[] = [
  {
    label: 'meshtastic/firmware',
    owner: 'meshtastic',
    repo: 'firmware',
    githubUrl: 'https://github.com/meshtastic/firmware',
  },
  {
    label: 'meshcore-dev/MeshCore',
    owner: 'meshcore-dev',
    repo: 'MeshCore',
    githubUrl: 'https://github.com/meshcore-dev/MeshCore',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const go = () => {
    const parsed = parseGithubUrl(input)
    if (!parsed) {
      setError('Paste a GitHub URL like https://github.com/owner/repo or owner/repo')
      return
    }
    setError(null)
    const o = encodeURIComponent(parsed.owner)
    const r = encodeURIComponent(parsed.repo)
    if (parsed.treePath) {
      const path = encodeBranchPath(parsed.treePath)
      navigate(`/${o}/${r}/tree/${path}`)
    } else {
      navigate(`/${o}/${r}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
            Mesh Forge
          </h1>
          <p className="mt-4 text-slate-400 text-lg">
            Browse a GitHub PlatformIO repo, scan environments, trigger a CI build — then flash the bundle over USB
            from the same page with Web Serial (Chromium).
          </p>
        </div>

        <div className="space-y-3 text-left">
          <label htmlFor="gh-url" className="block text-sm text-slate-400">
            GitHub repository URL
          </label>
          <input
            id="gh-url"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-600"
            placeholder="https://github.com/owner/repo/tree/main"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && go()}
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700" type="button" onClick={go}>
            Open repository
          </Button>
          <div className="pt-2 space-y-2">
            <p className="text-xs text-slate-500 text-center">Try a demo</p>
            <ul className="space-y-2">
              {DEMO_REPOS.map(d => (
                <li
                  key={d.githubUrl}
                  className="flex flex-col sm:flex-row gap-1 sm:gap-3 sm:items-center sm:justify-between rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-300 hover:text-cyan-400 text-sm justify-start h-auto py-1 px-0 font-normal"
                    onClick={() =>
                      navigate(`/${encodeURIComponent(d.owner)}/${encodeURIComponent(d.repo)}`)
                    }
                  >
                    Open {d.label}
                  </Button>
                  <a
                    className="text-xs text-slate-600 hover:text-slate-400 sm:text-right shrink-0"
                    href={d.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {d.githubUrl.replace(/^https:\/\//, '')}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          URLs mirror GitHub: <code className="text-slate-400">/owner/repo/tree/ref</code>. Short form{' '}
          <code className="text-slate-400">owner/repo</code> uses the default branch.
        </p>
      </div>
    </div>
  )
}
