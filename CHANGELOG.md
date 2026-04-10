# Changelog

All notable changes to Mesh Forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Patch

- **Build:** Tailwind uses **`source(none)`** plus explicit **`@source`** globs for **`src/`**, **`components/`**, and **`index.html`** only so **`vendor/`** (~100k+ vendored files) is never scanned (previously made `vite build` look hung).
- **Repo URLs:** optional **`/tree/<branch>/target/<env>`** path (branch segments may contain `/`); **`/owner/repo`** with no branch shows **`--branch--`** / **`--target--`** placeholders until chosen. Target picker stays disabled until a branch is selected; URL updates with branch and target.
- **Repo page:** single-column layout shows **branch / target / Flash** above **About**; branch and target use a **Radix Popover combobox** (filter field + full list) instead of `<datalist>` so arrow keys work after a selection.
- **Repo About sidebar:** uses GitHub REST **`description`** and **`homepage`** (cached with branch list refresh), not a README-derived blurb—matches GitHub’s About section (text + link icon). Removed unused **`readmePlainSummary`** helper.
- **Repo page layout:** GitHub-style **About** sidebar (**Refresh branches** under blurb; **GitHub** icon opens the ref tree next to homepage or repo title); main column **toolbar** (branch, target, **Flash** only), CI/USB, then **README** body (no separate “README” heading; spacing only above README so a leading `---` is not doubled with a border). Removed **device compatibility** voting (works / does not work) from the repo page.
- **Repo README:** render inline HTML via `rehype-raw` + `rehype-sanitize` (badges, images) in the main column.
- **Repo builds:** friendlier **CI failed** copy (headline + body + **Technical details** `<details>`); primary button **Retry build** re-queues via **`retryBuild`**; **Flash** disabled while **queued/running**; GitHub **dispatch** retries **4×** with backoff on **5xx/429** and common network errors. Links: **View run** when `githubRunId` set, else **Mesh Forge workflow** when failed with no run. Shorter **422 / unexpected inputs** maintainer copy in `formatBuildErrorSummary`.
- **RepoPage:** treat missing scan row (`null`) like loading so the UI does not crash before `ensureScan` creates the document.
- Removed in-app **documentation** routes (`/docs`, ESP/nRF markdown pages). **`/docs/*`** and legacy **`/flasher`** URLs redirect to **home**. ESP **Web Serial** flashing only on **`/:owner/:repo` / tree** pages: when a build **succeeds**, the signed bundle is fetched automatically and **`EspFlasher`** appears (no separate upload page). Flasher options: baud, full erase, **no auto-reset**, **1200 baud** bootloader pulse. Unknown paths show **not found** instead of a blank screen.
- Fixed **RepoPage** Rules of Hooks violation (blank page after default-branch redirect) by running all hooks before any `Navigate` return.
- Standardized on **Bun** for installs and scripts; use **`bunx convex`** / **`bunx wrangler`** instead of npm/npx; removed `package-lock.json` in favor of `bun.lock`; Repo PlatformIO workflows upload R2 via `bunx wrangler`.
- Home page: **Try a demo** shortcuts for `meshtastic/firmware` and `meshcore-dev/MeshCore` with GitHub links.
- `bun run smoke` runs `bun run build` and `bunx convex codegen` for a quick CLI smoke without the browser.

### Major

- Replaced the Vike app with Vite, React, and React Router (GitHub-style `/:owner/:repo` and `/:owner/:repo/tree/*` routes, branch switcher, GitHub URL paste on the home page).
- Replaced the Meshtastic-centric Convex model with `repoBranchList`, `repoRefScan`, `repoBuilds`, and `deviceReports`; removed legacy `builds` / `profiles` / `plugins` tables and related UI.
- Target discovery runs in Convex via GitHub archive zip + INI scan (not per-branch GitHub Actions); CI builds remain GitHub Actions + PlatformIO + R2 with ingest callbacks.
- Added an in-browser ESP flasher using esptool-js and Web Serial, consuming the same `.tar.gz` bundle as downloads.
- Removed the plugin marketplace surface and froze `public/registry.json` to an empty object for this pivot.

## [0.4.0] - 2025-12-10

### Minor

- Added vendors.json mapping vendors to models and platformio targets
- Refactored targets.ts to use vendors.json and architecture-hierarchy.json instead of hardware-list.json
- Updated architecture-hierarchy.json generation to use actual PlatformIO environment names (removed normalization)
- Removed normalization from lib/utils.ts since all inputs now use standardized PlatformIO names
- Refactored build routes from dynamic parameterized routes to query string parameters for Vike SSG compatibility
- Refactored Builder component into smaller reusable components (BuilderHeader, TargetSelector, VersionSelector, ModuleConfig, PluginConfig, BuildActions)
- Extracted target selection and plugin compatibility logic into reusable hooks (useTargetSelection, usePluginCompatibility)

### Patch

- Fix Convex server functions being imported in browser by moving ArtifactType enum to client-safe location
- Fix nested anchor tag hydration error in PluginCard component by converting nested links to buttons when parent is a link

## [0.3.0] - 2025-12-10

### Minor

- Added footer with links to legal pages (License, Privacy Policy, Terms of Service)
- Added licensing notice page explaining GPLv3 licensing for generated projects
- Added privacy policy page detailing data collection and usage
- Added terms of service page with usage terms and disclaimers

### Patch

- Fix prerendering on dynamic routes

## [0.2.0] - 2025-12-10

### Minor

- Switched OAuth authentication provider from Google to GitHub
- Integrated Giscus comments into build pages for discussion threads per build configuration

### Patch

- Made build hash label clickable in BuildProgress component to navigate to build detail page

## [0.1.0] - 2025-12-10

Initial release

[Unreleased]: https://github.com/MeshEnvy/mesh-forge/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/MeshEnvy/mesh-forge/releases/tag/v0.4.0
[0.3.0]: https://github.com/MeshEnvy/mesh-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/MeshEnvy/mesh-forge/releases/tag/v0.2.0
[0.1.0]: https://github.com/MeshEnvy/mesh-forge/releases/tag/v0.1.0
