# Monitor Control

Electron desktop app for Linux that controls external monitor settings through `ddcutil`, with staged edits, JSON profiles, import/export, and a gray-and-violet interface tuned for quick display management.

## Features

- detect external displays exposed through `ddcutil`
- inspect supported VCP controls per monitor
- include white level control when exposed by the monitor
- stage multiple adjustments before applying them
- save profile snapshots as readable JSON files
- import and export profiles for sharing
- surface diagnostics when `ddcutil` or `i2c` permissions are missing

## Stack

- Electron
- React
- TypeScript
- Vite
- Zod
- Zustand

## Requirements

- Linux
- Node.js 20+
- `ddcutil`
- access to `/dev/i2c-*`

Fedora example:

```bash
sudo dnf install ddcutil i2c-tools
sudo groupadd -f i2c
sudo usermod -aG i2c $USER
sudo tee /etc/udev/rules.d/45-ddcutil-i2c.rules >/dev/null <<'EOF'
KERNEL=="i2c-[0-9]*", GROUP="i2c", MODE="0660"
EOF
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Log out and back in after updating the group membership.

## Development

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Type-check:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

## Project Structure

```text
monitor-control/
  docs/
    plan.md
    spec.md
  electron/
    preload.cjs
  src/
    main/
    renderer/
    shared/
```

## How It Works

1. The Electron main process talks to `ddcutil`.
2. The preload script exposes a safe IPC API to the renderer.
3. The React UI shows only supported controls for the selected monitor.
4. Slider edits update a local draft.
5. `Apply staged changes` writes the batch to the selected monitor.
6. `Save profile snapshot` stores the current monitor state as JSON.

## Profile Format

Profiles are versioned JSON files with:

- monitor matching metadata
- current VCP settings
- app version and notes

The schemas live in [src/shared/profile-schema.ts](./src/shared/profile-schema.ts).

## Current Limitations

- depends on real DDC/CI support from the monitor
- not every monitor exposes sharpness, hue, saturation, or gain controls
- the app currently focuses on Linux and external displays
- discovery and permissions depend on the local distro setup

## Validation

Current local checks:

- `npm run typecheck`
- `npm run build`

## Publishing

This project can be published to GitHub after:

1. initializing a git repository
2. committing the current files
3. creating or connecting a remote
4. pushing the branch

If you want, this can be automated once the target repository name and visibility are confirmed.
