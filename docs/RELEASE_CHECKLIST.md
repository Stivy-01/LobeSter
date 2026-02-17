# Release Checklist

## Build

1. Install dependencies: `pnpm install`
2. Build in ordered pipeline: `pnpm build`
3. Confirm generated UI exists at `apps/ui/out/index.html`
4. Confirm connector artifact exists at `apps/connector/dist/cli.js`

## Local Runtime

1. Initialize state: `pnpm lobe -- init`
2. Run diagnostics: `pnpm lobe -- doctor`
3. Start local server: `pnpm lobe -- start`
4. Open `http://localhost:3210` and verify dashboard loads

## Core Money Path

1. Install at least one skill (local or public GitHub)
2. Create one engram
3. Set engram from CLI and from UI
4. Verify generated files:
   - `~/.lobester/openclaw/overlay.json`
   - `~/.lobester/openclaw/openclaw.generated.json`

## Cloud Placeholder Path

1. Start cloud app and login
2. Create local token from cloud page
3. Set token in local UI (if validating paid plan gates)
4. Verify license status endpoint reflects expected limits

## Cross-Platform Matrix

1. Windows smoke run
2. macOS smoke run
3. Linux smoke run




