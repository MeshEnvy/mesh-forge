# Mesh Forge

Build custom Meshtastic firmware right from your browser. No downloads, no toolchains—everything runs in the cloud.

## Features

- **Zero Install** - Everything runs in your browser
- **Custom Firmware** - Build bespoke Meshtastic firmware tailored to your exact needs
- **Community Extensions** - Include community modules and extensions beyond core Meshtastic
- **Share & Remix** - Publish your build profiles and let others remix your configs
- **Cloud Builds** - Compile in the cloud, flash directly to your device

## Community

Join our Discord community: [https://discord.gg/8KgJpvjfaJ](https://discord.gg/8KgJpvjfaJ)

## Contributing to Mesh Forge

```bash
# Install dependencies
git submodule update --init --recursive
bun install

# Run development server
npx convex dev # Note: you will need to initialize or select a Convex project
bun run dev

# Build for production
bun run build

# Lint code
bun run lint
```

## License

MIT License - see [LICENSE](LICENSE) file for details.
