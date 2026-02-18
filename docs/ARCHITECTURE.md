# LobeSter Architecture

## Overview

LobeSter uses a split architecture:

- **Hosted web app (Cloud)** = account, billing, marketplace later,
  sharing, device list
- **Local agent (Connector)** = filesystem access, installs skills,
  writes OpenClaw config, starts local UI

The cloud is the control plane; the local agent does the privileged
work. This is the same pattern used by many dev tools.

## Components

### A) Hosted Next.js app (Cloud) â€” `apps/cloud`

**Responsibilities:**

- Auth (Supabase)
- Billing (Polar)
- Preset sync + sharing (optional v1)
- License enforcement (preset count limit)
- "Devices" list (shows connectors that checked in)

**Tech:**

- Next.js (App Router)
- Postgres via Supabase
- Polar webhooks â†’ update `subscription_status`

### B) Local Connector â€” `apps/connector`

**Responsibilities:**

- Manage curated skills folder (`~/.lobester/skills`)
- Download/install/update skills
- Read base OpenClaw config
  (`~/.openclaw/openclaw.json` or `OPENCLAW_CONFIG_PATH`)
- Generate:
  - `~/.lobester/openclaw/overlay.json`
  - `~/.lobester/openclaw/openclaw.generated.json`
- Provide local API for the UI
- Serve the local UI at `http://localhost:3210`

**Tech:**

- Node.js CLI (`lobe`) with Fastify
- Stores local state in JSON/SQLite
- Authenticates to cloud via device token

**Adapter Boundary (v1):**

- Connector now resolves a loadout adapter through
  `services/adapters/registry.ts`
- Current shipped adapter: `openclaw`
- Core orchestration (`ApplyService`) is adapter-agnostic
- Future ecosystems can be added by implementing the adapter
  interface in `services/adapters/types.ts` and registering it

### C) Local UI â€” `apps/ui`

- Next.js compiled to **static export**
- Served by the connector
- Calls connector's local API at `/api/*`
- No Next.js server required locally

## Security

The hosted app never touches the user filesystem. All privileged
operations happen through the local connector.

## UX Modes

### Mode 1: Hosted UI + Local API

User opens hosted dashboard, it connects to `localhost` connector.

- Pros: one UI, easy updates, SaaS feel
- Cons: browser needs CORS permission, localhost connectivity quirks

### Mode 2: Local UI served by connector (chosen for v1)

Connector hosts the UI locally.

- Pros: no cross-origin/localhost issues, works offline
- Cons: you maintain local build distribution

**v1 decision: Mode 2 (local static export served by connector)**

## Repo Structure

- `apps/cloud` â€” Next.js hosted (billing, auth, license API)
- `apps/connector` â€” Node CLI + local API + static file server
- `apps/ui` â€” Next.js static export (local dashboard)
- `packages/shared` â€” shared types, utils, merge engine types

## User Flow (v1)

1. Install: `npm i -g @lobester/connector`
2. Run: `lobe start`
3. Open browser: `http://localhost:3210`
4. Manage skills/presets, generate config, copy wrapper snippet




