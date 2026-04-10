import { AutocompleteField } from '../components/AutocompleteField'
import EspFlasher from '../components/EspFlasher'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Github, Link2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { homepageHref, homepageLabel } from '../lib/githubHomepage'
import ReactMarkdown from 'react-markdown'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { normalizeBuildKey } from '../lib/buildKey'
import { formatBuildErrorSummary } from '../lib/formatBuildErrorSummary'

export default function RepoPage() {
  const navigate = useNavigate()
  const params = useParams<{ owner: string; repo: string; '*': string }>()
  const ownerParam = params.owner ?? ''
  const repoParam = params.repo ?? ''
  const treePath = params['*']
  const owner = useMemo(() => decodeURIComponent(ownerParam), [ownerParam])
  const repo = useMemo(() => decodeURIComponent(repoParam), [repoParam])
  const onShortUrl = !treePath

  const branchData = useQuery(
    api.repoBranches.get,
    owner && repo ? { owner, repo } : 'skip'
  )
  const refreshBranches = useAction(api.repoBranches.refresh)
  const resolveRef = useAction(api.repoScans.resolveRefToSha)
  const fetchReadme = useAction(api.repoBranches.fetchReadme)
  const ensureScan = useMutation(api.repoScans.ensureScan)
  const ensureBuild = useMutation(api.repoBuilds.ensureBuild)
  const getSignedUrl = useAction(api.repoBuildDownloads.getSignedDownloadUrl)
  const effectiveRef = useMemo(() => {
    if (treePath) {
      return treePath
        .split('/')
        .filter(Boolean)
        .map(p => decodeURIComponent(p))
        .join('/')
    }
    return branchData?.row?.defaultBranch ?? null
  }, [treePath, branchData?.row?.defaultBranch])

  useEffect(() => {
    if (!owner || !repo || branchData === undefined) return
    if (branchData.row !== null && !branchData.isStale) return
    void refreshBranches({ owner, repo }).catch(e => toast.error(String(e)))
  }, [owner, repo, branchData, refreshBranches])

  const [resolvedSha, setResolvedSha] = useState<string | null>(null)
  const [refError, setRefError] = useState<string | null>(null)
  useEffect(() => {
    if (!owner || !repo || !effectiveRef) return
    let cancelled = false
    setResolvedSha(null)
    setRefError(null)
    void resolveRef({ owner, repo, ref: effectiveRef })
      .then(sha => {
        if (!cancelled) setResolvedSha(sha)
      })
      .catch(e => {
        if (!cancelled) setRefError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [owner, repo, effectiveRef, resolveRef])

  useEffect(() => {
    if (!owner || !repo || !effectiveRef || !resolvedSha) return
    void ensureScan({ owner, repo, ref: effectiveRef, resolvedSourceSha: resolvedSha }).catch(e =>
      toast.error(String(e))
    )
  }, [owner, repo, effectiveRef, resolvedSha, ensureScan])

  const scan = useQuery(
    api.repoScans.getByRepoSha,
    resolvedSha ? { owner, repo, resolvedSourceSha: resolvedSha } : 'skip'
  )

  const [readmeMd, setReadmeMd] = useState<string | null>(null)
  useEffect(() => {
    if (!effectiveRef) return
    let cancelled = false
    setReadmeMd(null)
    void fetchReadme({ owner, repo, ref: effectiveRef })
      .then(r => {
        if (!cancelled) setReadmeMd(r.markdown)
      })
      .catch(() => {
        if (!cancelled) setReadmeMd('*(README could not be loaded.)*')
      })
    return () => {
      cancelled = true
    }
  }, [owner, repo, effectiveRef, fetchReadme])

  const envNames = scan?.scanStatus === 'complete' ? scan.envNames ?? [] : []
  const [selectedEnv, setSelectedEnv] = useState<string>('')
  useEffect(() => {
    if (!envNames.length) return
    if (!selectedEnv || !envNames.includes(selectedEnv)) {
      setSelectedEnv(envNames[0])
    }
  }, [envNames, selectedEnv])

  const [branchDraft, setBranchDraft] = useState('')
  useEffect(() => {
    if (!effectiveRef) return
    setBranchDraft(effectiveRef)
  }, [effectiveRef])

  const [envDraft, setEnvDraft] = useState('')
  useEffect(() => {
    if (selectedEnv) setEnvDraft(selectedEnv)
  }, [selectedEnv])

  const buildKey =
    resolvedSha && selectedEnv ? normalizeBuildKey(resolvedSha, selectedEnv) : null
  const build = useQuery(api.repoBuilds.getByBuildKey, buildKey ? { buildKey } : 'skip')

  const [flashUrl, setFlashUrl] = useState<string | null>(null)
  const [flashPrep, setFlashPrep] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    if (!build?._id || build.status !== 'succeeded') {
      setFlashUrl(null)
      setFlashPrep('idle')
      return
    }
    let cancelled = false
    setFlashPrep('loading')
    setFlashUrl(null)
    void getSignedUrl({ buildId: build._id })
      .then(url => {
        if (cancelled) return
        setFlashUrl(url)
        setFlashPrep('ready')
      })
      .catch(e => {
        if (cancelled) return
        toast.error(String(e))
        setFlashPrep('error')
      })
    return () => {
      cancelled = true
    }
  }, [build?._id, build?.status, getSignedUrl])

  const queueFlashArtifacts = () => {
    if (!effectiveRef || !resolvedSha || !selectedEnv) return
    void ensureBuild({
      owner,
      repo,
      ref: effectiveRef,
      resolvedSourceSha: resolvedSha,
      targetEnv: selectedEnv,
    }).catch(e => toast.error(String(e)))
  }

  const download = async () => {
    if (!build?._id) return
    try {
      const url = await getSignedUrl({ buildId: build._id })
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (onShortUrl) {
    if (branchData === undefined) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center text-slate-400">
          Resolving default branch…
        </div>
      )
    }
    if (!branchData.row) {
      return (
        <div className="max-w-xl mx-auto px-6 py-16 text-slate-300">
          <p className="mb-4">Could not load branch list. The repository may be private or missing.</p>
          <Button asChild variant="outline">
            <Link to="/">Home</Link>
          </Button>
        </div>
      )
    }
    const enc = branchData.row.defaultBranch.split('/').map(encodeURIComponent).join('/')
    return <Navigate to={`/${ownerParam}/${repoParam}/tree/${enc}`} replace />
  }

  if (!effectiveRef) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-400">Loading…</div>
    )
  }

  const ghTree = `https://github.com/${owner}/${repo}/tree/${effectiveRef.split('/').map(encodeURIComponent).join('/')}`

  const branchNames = branchData?.row?.branches.map(b => b.name) ?? []
  let branchOptions =
    effectiveRef && !branchNames.includes(effectiveRef)
      ? [effectiveRef, ...branchNames]
      : [...branchNames]
  if (branchOptions.length === 0 && effectiveRef) branchOptions = [effectiveRef]

  const ghAboutDescription = branchData?.row?.description?.trim() ?? ''
  const ghAboutHomepage = branchData?.row?.homepage?.trim() ?? ''

  const scanReady = Boolean(resolvedSha && scan?.scanStatus === 'complete' && envNames.length > 0)
  const flashPrimaryDisabled =
    !resolvedSha ||
    Boolean(refError) ||
    !selectedEnv ||
    !envNames.includes(selectedEnv) ||
    !scanReady

  const ghRepoRoot = `https://github.com/${owner}/${repo}`

  const targetPlaceholder = !resolvedSha
    ? '…'
    : scan == null || scan.scanStatus === 'in_progress'
      ? 'Scanning…'
      : scan.scanStatus === 'failed'
        ? 'Scan failed'
        : envNames.length === 0
          ? 'No targets'
          : 'Pick env…'

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 text-slate-200">
      <section className="rounded-2xl border border-slate-700/90 bg-slate-950/90 p-6 md:p-8 shadow-xl shadow-black/30">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-10 items-start">
          <div className="min-w-0 space-y-5 order-2 lg:order-1">
            <div className="flex flex-nowrap items-end gap-2 overflow-x-auto border-b border-slate-800 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <AutocompleteField
                label="Branch"
                layout="inline"
                id="mesh-forge-branch"
                options={branchOptions}
                value={branchDraft}
                onChange={v => {
                  setBranchDraft(v)
                  if (branchOptions.includes(v)) {
                    const enc = v.split('/').map(encodeURIComponent).join('/')
                    navigate(`/${ownerParam}/${repoParam}/tree/${enc}`)
                  }
                }}
                onBlur={() => {
                  if (!branchOptions.includes(branchDraft)) setBranchDraft(effectiveRef)
                }}
                disabled={branchOptions.length === 0}
              />
              {scanReady && envNames.length > 0 ? (
                <AutocompleteField
                  label="Target"
                  layout="inline"
                  id="mesh-forge-target"
                  options={envNames}
                  value={envDraft}
                  onChange={v => {
                    setEnvDraft(v)
                    if (envNames.includes(v)) setSelectedEnv(v)
                  }}
                  onBlur={() => {
                    if (!envNames.includes(envDraft)) setEnvDraft(selectedEnv)
                  }}
                  disabled={false}
                />
              ) : (
                <label className="flex min-w-0 max-w-[min(100%,18rem)] flex-1 items-center gap-2 sm:max-w-[20rem]">
                  <span className="w-14 shrink-0 text-xs font-medium text-slate-500 sm:w-16">Target</span>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value=""
                    placeholder={targetPlaceholder}
                    className="h-9 min-w-[7rem] flex-1 cursor-not-allowed rounded-md border border-slate-800 bg-slate-900/50 px-2.5 text-sm text-slate-500 placeholder:text-slate-600"
                  />
                </label>
              )}

              <Button
                type="button"
                className="h-9 shrink-0 bg-amber-600 px-4 text-white hover:bg-amber-700"
                disabled={flashPrimaryDisabled}
                onClick={queueFlashArtifacts}
              >
                Flash
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {branchData?.isStale ? <span>Branch list may be stale.</span> : null}
              {refError ? <span className="text-red-400">{refError}</span> : null}
              {!refError && !resolvedSha ? <span>Resolving branch…</span> : null}
              {resolvedSha && (scan == null || scan.scanStatus === 'in_progress') ? (
                <span>Scanning PlatformIO…</span>
              ) : null}
              {resolvedSha && scan?.scanStatus === 'failed' ? (
                <span className="text-red-300">Scan failed: {scan.scanError ?? 'unknown'}</span>
              ) : null}
            </div>

            <div className="max-w-2xl space-y-4">
              {build ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-slate-500">CI</span>
                    <span className="text-white font-medium">{build.status}</span>
                    {build.githubRunId ? (
                      <a
                        className="text-cyan-400 hover:underline text-xs"
                        href={`https://github.com/MeshEnvy/mesh-forge/actions/runs/${build.githubRunId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Workflow run
                      </a>
                    ) : null}
                  </div>
                  {build.status === 'failed' && build.errorSummary ? (
                    <p className="text-red-300 text-xs whitespace-pre-wrap">{formatBuildErrorSummary(build.errorSummary)}</p>
                  ) : null}
                  {build.status === 'succeeded' ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => void download()}>
                      Download bundle
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {flashPrep === 'loading' ? <p className="text-sm text-slate-400">Preparing USB flasher…</p> : null}
              {flashPrep === 'error' ? (
                <p className="text-sm text-amber-200/90">
                  Could not load a signed URL for flashing. Use <strong>Download bundle</strong> if you need the file.
                </p>
              ) : null}
              {flashUrl ? (
                <EspFlasher
                  bundleUrl={flashUrl}
                  condensed
                  flashButtonLabel="USB flash"
                  flashBusyLabel="Writing…"
                  flashButtonSize="lg"
                  className="border-amber-900/50 bg-amber-950/25"
                />
              ) : null}
            </div>

            <div className="mt-8 prose prose-invert prose-sm max-w-none prose-hr:my-6">
              {readmeMd === null ? (
                <p className="text-slate-500 not-prose">Loading…</p>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                  {readmeMd || '*No README.*'}
                </ReactMarkdown>
              )}
            </div>
          </div>

          <aside className="order-1 border-b border-slate-800 pb-8 lg:order-2 lg:border-b-0 lg:border-l lg:border-slate-800 lg:pb-0 lg:pl-8 space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">About</h2>
            <div>
              <p className="text-xs text-slate-500 mb-1">{owner}</p>
              <h3 className="flex flex-wrap items-center gap-1.5 text-xl font-bold text-white leading-tight">
                <a className="hover:text-cyan-400" href={ghRepoRoot} target="_blank" rel="noreferrer">
                  {repo}
                </a>
                {!ghAboutHomepage ? (
                  <a
                    className="inline-flex rounded p-0.5 text-slate-500 hover:text-white"
                    href={ghTree}
                    target="_blank"
                    rel="noreferrer"
                    title={`View ${effectiveRef} on GitHub`}
                  >
                    <Github className="size-4" aria-hidden />
                    <span className="sr-only">View {effectiveRef} on GitHub</span>
                  </a>
                ) : null}
              </h3>
            </div>
            {branchData === undefined ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : ghAboutDescription ? (
              <p className="text-sm text-slate-200 leading-relaxed">{ghAboutDescription}</p>
            ) : null}
            {ghAboutHomepage ? (
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <a
                  className="inline-flex items-center gap-1.5 text-cyan-400 hover:underline"
                  href={homepageHref(ghAboutHomepage)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Link2 className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                  {homepageLabel(ghAboutHomepage)}
                </a>
                <a
                  className="inline-flex rounded p-0.5 text-slate-500 hover:text-white"
                  href={ghTree}
                  target="_blank"
                  rel="noreferrer"
                  title={`View ${effectiveRef} on GitHub`}
                >
                  <Github className="size-4" aria-hidden />
                  <span className="sr-only">View {effectiveRef} on GitHub</span>
                </a>
              </div>
            ) : null}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                title="Refresh branches from GitHub"
                onClick={() => void refreshBranches({ owner, repo }).catch(e => toast.error(String(e)))}
              >
                <RefreshCw className="size-3.5" />
                Refresh branches
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
