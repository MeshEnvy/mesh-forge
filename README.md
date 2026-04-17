# MeshForge

Build custom Meshtastic firmware right from your browser. No downloads, no toolchains—everything runs in
the cloud.

MeshForge **cloud-compiles** and **web-flashes** custom firmware for LoRa mesh devices. It understands **PlatformIO** projects the same way your local build does. If PlatformIO can build it, MeshForge can run that build in the cloud and flash the artifacts in the browser.

## Features

- **Zero install** — Everything runs in your browser
- **Custom firmware** — Build bespoke firmware tailored to your exact needs
- **Community extensions** — Include community modules and extensions beyond core projects
- **Share and remix** — Publish your build profiles and let others remix your configs
- **Cloud builds** — Compile in the cloud, flash directly to your device

## MeshForge understands any GitHub URL

MeshForge understands any GitHub project URL. Swap `github.com` for `meshforge.org` and you can build and flash from the cloud.

```
https://github.com/Reticulum-Community/microReticulum
```

becomes

```
https://meshforge.org/Reticulum-Community/microReticulum
```

Keep the same `owner/repo` path (and optional `/tree/…` ref). You land in MeshForge, where you choose **tags** (or refs) and **build targets** (PlatformIO environments).

When someone has already built your exact tag and target, MeshForge can reuse that build and you skip the wait. If you are the first for that combination, wait for the build to finish, then flash—you have saved the next person time.

## For project developers

If you have a custom build of Meshtastic, MeshCore, or any other PlatformIO project, head over to **[DEVELOPER.md](DEVELOPER.md)** to find out how to make sure your project works well on MeshForge.

## Community

Join our Discord community: [https://discord.gg/8KgJpvjfaJ](https://discord.gg/8KgJpvjfaJ)

## Contributing to MeshForge

```bash
# Install dependencies
git submodule update --init --recursive
bun install

# Run development server (UI talks to `VITE_CONVEX_URL` in `.env.local`)
bun run dev

# When you change Convex code and want instant dev push (optional second terminal)
bunx convex dev

# One-command compile smoke (no browser): production build + Convex `tsc`
bun run smoke

# Build for production
bun run build

# Lint code
bun run lint
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
