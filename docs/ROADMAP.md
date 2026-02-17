# LobeSter Roadmap

## Milestone 1 â€” Money-path MVP (no cloud needed)

### Local connector

- `lobe init`
- `lobe doctor` (checks paths)
- `lobe set --engram <engramref>` generates config

### Local dashboard

- Skills page (list/install)
- Engrams page (create/edit)
- Set page (shows generated config path + wrapper snippets)

## Milestone 2 â€” SaaS layer

### Hosted Next.js app

- Login (Supabase auth)
- Billing (Polar)
- Device pairing

### Connector additions

- `lobe login` opens browser, user pairs device, gets token
- Connector enforces free vs pro locally (based on token/subscription)

## Build Order

1. **Local product first** (no cloud):
   - Skills folder manager
   - Engrams
   - Generated config
   - Graph board
2. **Add cloud**:
   - Hosted Next.js site
   - Token creation
   - Token validation endpoint
3. **Pro gates**:
   - Engram limit in connector + UI

## CLI Commands (v1)

- `lobe start` â€” starts local server + UI at
  `http://localhost:3210`
- Local UI token entry â€” stores license token locally
- `lobe doctor` â€” prints detected paths
- `lobe set --engram <engramNameOrId>` â€” generates overlay + config

## Dev Workflow

### Dev (two terminals)

```bash
# Terminal 1: UI dev server
pnpm --filter @lobester/ui dev

# Terminal 2: Connector dev server
pnpm --filter @lobester/connector dev
```

### Production-ish build

```bash
pnpm -r build
pnpm lobe -- start
```




