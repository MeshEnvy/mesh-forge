# Changelog

All notable changes to Mesh Forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Minor

- Added vendors.json mapping vendors to models and platformio targets
- Refactored targets.ts to use vendors.json and architecture-hierarchy.json instead of hardware-list.json
- Updated architecture-hierarchy.json generation to use actual PlatformIO environment names (removed normalization)
- Removed normalization from lib/utils.ts since all inputs now use standardized PlatformIO names
- Refactored build routes from dynamic parameterized routes to query string parameters for Vike SSG compatibility

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

[Unreleased]: https://github.com/MeshEnvy/mesh-forge/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/MeshEnvy/mesh-forge/releases/tag/v0.3.0
[0.2.0]: https://github.com/MeshEnvy/mesh-forge/releases/tag/v0.2.0
[0.1.0]: https://github.com/MeshEnvy/mesh-forge/releases/tag/v0.1.0
