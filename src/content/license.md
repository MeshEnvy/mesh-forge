# MeshForge Licensing Notice

## 1. Build artifacts you download

MeshForge compiles **your** public GitHub repository with PlatformIO and serves the resulting binaries (for example a `.tar.gz` bundle). Those artifacts are derived from **your upstream project** and its dependencies. **You** are responsible for complying with the licenses that apply to that repository (GPLv3, MIT, Apache-2.0, etc.).

MeshForge does not grant you any license to upstream code beyond what you already have from the repository and its license terms.

## 2. Third-party code in community firmware repositories

MeshForge builds **your** GitHub-hosted PlatformIO project as-is. Licensing, compliance, and redistribution of that upstream project are solely between you and the upstream authors. MeshForge does not add a separate “registry” layer of plugins to those builds.

## 3. MeshForge website and orchestration

The MeshForge website, Convex backend, and CI integration that fetch archives and run builds are separate from your firmware sources. They are provided under the MIT License unless otherwise noted for a specific file.

MeshForge.org is owned and operated by MeshEnvy NCC, a Nevada 501(c)(3) Nonprofit Corporation.

Copyright © 2025 MeshForge.org  
Licensed under the MIT License ([full text](https://opensource.org/licenses/MIT))

## Summary

- Artifacts produced from GPLv3 (or other) upstream repos → follow that upstream license
- MeshForge tool and website → MIT License

Questions or concerns? → [legal@meshforge.org](mailto:legal@meshforge.org)
