# Testing firmware builds with GitHub Actions

Mesh Forge compiles firmware on **GitHub Actions** (PlatformIO), not inside Convex. Convex **dispatches** a workflow and receives **status callbacks** over HTTP.

Workflow files live in this repo under [`.github/workflows/`](../.github/workflows/):

| Convex `CONVEX_ENV` | Workflow file             | Typical use   |
| ------------------- | ------------------------- | ------------- |
| `dev`               | `custom_build_test.yml`   | Local / dev   |
| anything else       | `custom_build.yml`        | Production    |

Both workflows are **`workflow_dispatch` only** (no automatic runs on push).

---

## 1. Convex environment variables

Set these in the Convex dashboard for the deployment you are testing. **Names only** — never commit values.

See [`.cursor/rules/convex-env.mdc`](../.cursor/rules/convex-env.mdc) for the full list used on your deployment.

**Critical for this flow:**

| Variable               | Role                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| `GITHUB_TOKEN`         | Dispatches workflows on `MeshEnvy/mesh-forge` via GitHub REST API    |
| `CONVEX_SITE_URL`      | Passed to Actions as `convex_url` for `/ingest-repo-build` callbacks |
| `CONVEX_BUILD_TOKEN`   | Must match the GitHub Actions secret of the same name (Bearer auth)  |
| `CONVEX_ENV`           | Set to `dev` to use `custom_build_test.yml`                          |

If the dashboard has `SITE_URL` but not `CONVEX_SITE_URL`, set **`CONVEX_SITE_URL`** to your Convex **site** URL (the one that serves HTTP actions such as `/ingest-repo-build`). Auth (`auth.config.ts`) also uses `CONVEX_SITE_URL` for the JWT domain.

---

## 2. GitHub repository secrets

In **GitHub → `MeshEnvy/mesh-forge` → Settings → Secrets and variables → Actions**, the workflow needs:

| Secret                   | Role                                      |
| ------------------------ | ----------------------------------------- |
| `CONVEX_BUILD_TOKEN`     | Same string as Convex `CONVEX_BUILD_TOKEN` |
| `CLOUDFLARE_ACCOUNT_ID`  | Wrangler R2 upload                        |
| `CLOUDFLARE_API_TOKEN`   | Wrangler R2 upload                        |
| `R2_BUCKET_NAME`         | Object key prefix / bucket for artifacts  |

The workflow installs PlatformIO, builds, tars `.pio/build/<target_env>`, then runs `bunx wrangler r2 object put ...`.

---

## 3. GitHub token permissions

The Convex `GITHUB_TOKEN` must be allowed to **trigger workflow dispatches** on `MeshEnvy/mesh-forge` (fine-grained PAT or classic PAT with appropriate `actions` scope). If dispatch fails, Convex may record a failure on the build row; check Convex function logs for HTTP `403` / `404` from `api.github.com`.

---

## 4. End-to-end test (recommended)

1. Deploy or run **`bunx convex dev`** with the env vars above set for that deployment.
2. Run the frontend (**`bun run dev`**) pointed at the same Convex deployment.
3. Open a repo page, pick a **branch** and **PlatformIO target**, and start a build (the app calls `ensureBuild`, which schedules `dispatchRepoBuild`).
4. In GitHub: **Actions** → workflow **“Repo PlatformIO Build”** → confirm a new run appears (`custom_build.yml` or `custom_build_test.yml` depending on `CONVEX_ENV`).
5. When the job finishes:
   - **Success:** Convex build status should become **succeeded**, with `githubRunId` and R2 key; the UI can offer download / flash.
   - **Failure:** Convex should get **failed** with an error summary from the workflow.

**View run:** the repo page links to `https://github.com/MeshEnvy/mesh-forge/actions/runs/<id>` when `githubRunId` is set.

---

## 5. Manual `workflow_dispatch` (optional)

You can run the workflow from **Actions → Repo PlatformIO Build → Run workflow** and fill inputs by hand. For callbacks to update the **correct** Convex document, **`repo_build_id`** must be a real `repoBuilds` document id from that Convex deployment (copy from dashboard or from a build started in the UI).

You must still pass **`convex_url`** matching the deployment that owns that build id, and **`CONVEX_BUILD_TOKEN`** in GitHub must match that deployment.

---

## 6. Troubleshooting

| Symptom                                         | Likely cause                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| No workflow run after starting a build          | Missing/invalid `GITHUB_TOKEN`, wrong repo, or API error (check Convex logs) |
| Workflow runs but UI stays queued / running     | Wrong `convex_url`, or ingest `401` (token mismatch), or network block      |
| Ingest returns 401                              | `CONVEX_BUILD_TOKEN` differs between Convex and GitHub Actions               |
| Build fails at R2 upload                        | Missing or wrong Cloudflare / R2 secrets                                     |
| Wrong workflow file in dev                      | `CONVEX_ENV` not set to `dev` when you expect `custom_build_test.yml`        |
| Source download fails                           | Private repo without token in workflow (current workflow uses public zip URL) |

---

## 7. Changing the workflow

After editing `custom_build_test.yml` (or `custom_build.yml`), merge to the branch GitHub uses for `ref` in the dispatch payload. Today Convex sends **`ref: "main"`** in the API body, so the workflow definition that runs is **`main`** on `MeshEnvy/mesh-forge`, not necessarily the branch you are building for the firmware repo.
