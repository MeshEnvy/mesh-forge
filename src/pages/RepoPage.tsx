import { ComboboxField } from '../components/ComboboxField'
import EspFlasher from '../components/EspFlasher'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Github, Link2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { homepageHref, homepageLabel } from '../lib/githubHomepage'
import ReactMarkdown from 'react-markdown'
import { Link, useNavigate, useParams } from 'react-router-dom'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { normalizeBuildKey } from '../lib/buildKey'
import { buildFailurePresentation } from '../lib/formatBuildErrorSummary'

const MESH_FORGE_ACTIONS_REPO = 'MeshEnvy/mesh-forge'
const meshForgeWorkflowUrl = `https://github.com/${MESH_FORGE_ACTIONS_REPO}/actions/workflows/custom_build.yml`
import { buildTreeSplatPath, parseTreeSplat } from '../lib/repoTreeUrl'

export default function RepoPage() {
  const navigate = useNavigate()
  const params = useParams<{ owner: string; repo: string; '*': string }>()
  const ownerParam = params.owner ?? ''
  const repoParam = params.repo ?? ''
  const treePath = params['*']
  const owner = useMemo(() => decodeURIComponent(ownerParam), [ownerParam])
  const repo = useMemo(() => decodeURIComponent(repoParam), [repoParam])
  const { branchRef, targetEnv: targetFromUrl } = useMemo(() => parseTreeSplat(treePath), [treePath])
  const hasBranch = Boolean(branchRef)

  const branchData = useQuery(
    api.repoBranches.get,
    owner && repo ? { owner, repo } : 'skip'
  )
  const refreshBranches = useAction(api.repoBranches.refresh)
  const resolveRef = useAction(api.repoScans.resolveRefToSha)
  const fetchReadme = useAction(api.repoBranches.fetchReadme)
  const ensureScan = useMutation(api.repoScans.ensureScan)
  const ensureBuild = useMutation(api.repoBuilds.ensureBuild)
  const retryBuild = useMutation(api.repoBuilds.retryBuild)
  const getSignedUrl = useAction(api.repoBuildDownloads.getSignedDownloadUrl)
  /** Git branch/ref from URL only (null = `--branch--` / short `/owner/repo`). */
  const effectiveRef = branchRef

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
  const resolvedTargetEnv =
    hasBranch && targetFromUrl && envNames.length > 0 && envNames.includes(targetFromUrl)
      ? targetFromUrl
      : ''

  const [branchDraft, setBranchDraft] = useState('')
  useEffect(() => {
    setBranchDraft(branchRef ?? '')
  }, [branchRef])

  const [envDraft, setEnvDraft] = useState('')
  useEffect(() => {
    if (!hasBranch) {
      setEnvDraft('')
      return
    }
    setEnvDraft(targetFromUrl ?? '')
  }, [hasBranch, targetFromUrl])

  useEffect(() => {
    if (!branchRef || !targetFromUrl) return
    if (scan?.scanStatus !== 'complete') return
    if (envNames.length === 0 || !envNames.includes(targetFromUrl)) {
      navigate(`/${ownerParam}/${repoParam}/tree/${buildTreeSplatPath(branchRef, null)}`, { replace: true })
    }
  }, [branchRef, targetFromUrl, envNames, scan?.scanStatus, navigate, ownerParam, repoParam])

  const buildKey =
    resolvedSha && resolvedTargetEnv ? normalizeBuildKey(resolvedSha, resolvedTargetEnv) : null
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
    if (!effectiveRef || !resolvedSha || !resolvedTargetEnv) return
    if (build?.status === 'failed' && build._id) {
      void retryBuild({ buildId: build._id })
        .then(() => toast.message('Re-queued build'))
        .catch(e => toast.error(String(e)))
      return
    }
    void ensureBuild({
      owner,
      repo,
      ref: effectiveRef,
      resolvedSourceSha: resolvedSha,
      targetEnv: resolvedTargetEnv,
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

  if (branchData === undefined) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-400">Loading repository…</div>
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

  const ghRepoRoot = `https://github.com/${owner}/${repo}`
  const ghTree = effectiveRef
    ? `https://github.com/${owner}/${repo}/tree/${effectiveRef.split('/').map(encodeURIComponent).join('/')}`
    : ghRepoRoot

  const branchNames = branchData.row.branches.map(b => b.name)
  let branchOptions =
    branchRef && !branchNames.includes(branchRef) ? [branchRef, ...branchNames] : [...branchNames]
  if (branchOptions.length === 0 && branchRef) branchOptions = [branchRef]

  const ghAboutDescription = branchData.row.description?.trim() ?? ''
  const ghAboutHomepage = branchData.row.homepage?.trim() ?? ''

  const scanReady = Boolean(hasBranch && resolvedSha && scan?.scanStatus === 'complete' && envNames.length > 0)
  const buildInProgress = Boolean(build && (build.status === 'queued' || build.status === 'running'))
  const flashPrimaryDisabled =
    !hasBranch ||
    !resolvedSha ||
    Boolean(refError) ||
    !resolvedTargetEnv ||
    !envNames.includes(resolvedTargetEnv) ||
    !scanReady ||
    buildInProgress

  const flashButtonLabel =
    build?.status === 'failed' ? 'Retry build' : buildInProgress ? 'Building…' : 'Flash'

  const targetPlaceholder = !hasBranch
    ? '--target--'
    : !resolvedSha
      ? '…'
      : scan == null || scan.scanStatus === 'in_progress'
        ? 'Scanning…'
        : scan.scanStatus === 'failed'
          ? 'Scan failed'
          : envNames.length === 0
            ? 'No targets'
            : '--target--'

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 text-slate-200">
      <section className="rounded-2xl border border-slate-700/90 bg-slate-950/90 p-6 md:p-8 shadow-xl shadow-black/30">
        <div
          className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-10 items-start
            [grid-template-areas:'repo-main''repo-aside''repo-readme']
            lg:[grid-template-areas:'repo-main_repo-aside''repo-readme_repo-aside']"
        >
          <div className="min-w-0 space-y-5 [grid-area:repo-main]">
            <div className="flex flex-nowrap items-end gap-2 overflow-x-auto border-b border-slate-800 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ComboboxField
                label="Branch"
                layout="inline"
                id="mesh-forge-branch"
                options={branchOptions}
                value={branchDraft}
                placeholder="--branch--"
                clearSelectionLabel="Clear branch"
                onChange={v => {
                  setBranchDraft(v)
                  if (v === '') {
                    navigate(`/${ownerParam}/${repoParam}`)
                    return
                  }
                  if (branchOptions.includes(v)) {
                    navigate(`/${ownerParam}/${repoParam}/tree/${buildTreeSplatPath(v, null)}`)
                  }
                }}
                disabled={branchOptions.length === 0}
              />
              {hasBranch && scanReady && envNames.length > 0 ? (
                <ComboboxField
                  label="Target"
                  layout="inline"
                  id="mesh-forge-target"
                  options={envNames}
                  value={envDraft}
                  placeholder="--target--"
                  clearSelectionLabel="Clear target"
                  onChange={v => {
                    setEnvDraft(v)
                    if (!branchRef) return
                    if (v === '') {
                      navigate(`/${ownerParam}/${repoParam}/tree/${buildTreeSplatPath(branchRef, null)}`, {
                        replace: true,
                      })
                      return
                    }
                    if (envNames.includes(v)) {
                      navigate(`/${ownerParam}/${repoParam}/tree/${buildTreeSplatPath(branchRef, v)}`)
                    }
                  }}
                  disabled={false}
                />
              ) : (
                <label className="flex min-w-0 max-w-[min(100%,18rem)] flex-1 items-center gap-2 sm:max-w-[20rem]">
                  <span className="w-14 shrink-0 text-xs font-medium text-slate-500 sm:w-16">Target</span>
                  <input
                    type="text"
                    readOnly
                    disabled={!hasBranch}
                    value=""
                    placeholder={targetPlaceholder}
                    className="h-9 min-w-28 flex-1 cursor-not-allowed rounded-md border border-slate-800 bg-slate-900/50 px-2.5 text-sm text-slate-500 placeholder:text-slate-600"
                  />
                </label>
              )}

              <Button
                type="button"
                className="h-9 shrink-0 bg-amber-600 px-4 text-white hover:bg-amber-700"
                disabled={flashPrimaryDisabled}
                onClick={queueFlashArtifacts}
              >
                {flashButtonLabel}
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {branchData?.isStale ? <span>Branch list may be stale.</span> : null}
              {refError ? <span className="text-red-400">{refError}</span> : null}
              {!refError && hasBranch && !resolvedSha ? <span>Resolving branch…</span> : null}
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
                        href={`https://github.com/${MESH_FORGE_ACTIONS_REPO}/actions/runs/${build.githubRunId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View run on GitHub
                      </a>
                    ) : build.status === 'failed' ? (
                      <a
                        className="text-cyan-400 hover:underline text-xs"
                        href={meshForgeWorkflowUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="No run ID — usually the workflow never started (e.g. dispatch rejected). Open the Mesh Forge workflow to fix YAML or inspect recent runs."
                      >
                        Mesh Forge workflow on GitHub
                      </a>
                    ) : null}
                  </div>
                  {build.status === 'failed' && build.errorSummary ? (
                    <div className="space-y-2 text-xs">
                      {(() => {
                        const { headline, body } = buildFailurePresentation(build.errorSummary)
                        return (
                          <>
                            <p className="font-medium text-slate-200">{headline}</p>
                            {body ? <p className="text-slate-400 leading-relaxed">{body}</p> : null}
                            <details className="text-slate-500">
                              <summary className="cursor-pointer select-none hover:text-slate-400">
                                Technical details
                              </summary>
                              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word text-[11px] text-red-300/90">
                                {build.errorSummary.length > 2500
                                  ? `${build.errorSummary.slice(0, 2500)}…`
                                  : build.errorSummary}
                              </pre>
                            </details>
                          </>
                        )
                      })()}
                    </div>
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
          </div>

          <aside className="[grid-area:repo-aside] border-b border-slate-800 pb-8 lg:border-b-0 lg:border-l lg:border-slate-800 lg:pb-0 lg:pl-8 space-y-4">
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
                    title={effectiveRef ? `View ${effectiveRef} on GitHub` : 'View repository on GitHub'}
                  >
                    <Github className="size-4" aria-hidden />
                    <span className="sr-only">
                      {effectiveRef ? `View ${effectiveRef} on GitHub` : 'View repository on GitHub'}
                    </span>
                  </a>
                ) : null}
              </h3>
            </div>
            {ghAboutDescription ? (
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
                  title={effectiveRef ? `View ${effectiveRef} on GitHub` : 'View repository on GitHub'}
                >
                  <Github className="size-4" aria-hidden />
                  <span className="sr-only">
                    {effectiveRef ? `View ${effectiveRef} on GitHub` : 'View repository on GitHub'}
                  </span>
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

          <div className="[grid-area:repo-readme] prose prose-invert prose-sm max-w-none prose-hr:my-6">
            {!effectiveRef ? (
              <p className="text-slate-500 not-prose text-sm">Select a branch to load the README.</p>
            ) : readmeMd === null ? (
              <p className="text-slate-500 not-prose">Loading…</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                {readmeMd || '*No README.*'}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
