# LobeSter Engineering Notes

This document is engineering-facing. Product positioning lives in `README.md`.

## Current Checkpoint (February 17, 2026)

Stage: **Gate A local validation-ready**.

Completed core path:

- skill install -> engram create -> set -> generated OpenClaw config
- local UI + local API + CLI all wired to same state
- plan-limit enforcement in connector APIs (engrams/runs)

Pending before production hardening:

- real Gate B revenue validation with live purchase lifecycle
- full billing UX polish in cloud UI

## Implemented Components

- `apps/connector`: CLI + Fastify API + static UI host
- `apps/ui`: local dashboard (Next.js static export)
- `apps/cloud`: auth/token/webhook service
- `packages/shared`: shared type contracts
- `supabase/migrations`: subscriptions, license_tokens, webhook_events

## Runtime Output and State

LobeSter home (default):

- `~/.lobester`

Key files:

- `~/.lobester/state/skills.json`
- `~/.lobester/state/presets.json`
- `~/.lobester/state/runs.json`
- `~/.lobester/state/license.json`
- `~/.lobester/openclaw/overlay.json`
- `~/.lobester/openclaw/openclaw.generated.json`

Default base config source:

- `~/.openclaw/openclaw.json`
- override with `OPENCLAW_CONFIG_PATH`

## Terminology and Naming

Canonical naming in user-facing surfaces:

- Product: `LobeSter`
- Loadout noun: `Engram`
- CLI: `lobe`

Internal API/storage still uses `preset` in several contracts for compatibility.

## Adapter Architecture

- Core apply orchestration lives in `ApplyService`
- Ecosystem-specific behavior is behind `LoadoutAdapter`
- Current adapter: `OpenClawAdapter`
- Adapter registry: `apps/connector/src/services/adapters/registry.ts`

Selection is controlled by:

- `LOBESTER_ADAPTER` (defaults to `openclaw`)

Legacy naming removed from code paths:

- `SKILLUI_HOME` fallback removed (use `LOBESTER_HOME`)
- `SKILLUI_CLOUD_URL` fallback removed (use `LOBESTER_CLOUD_URL`)
- `skillui.json` manifest fallback removed (use `lobester.json` or `SKILL.md`)

## High-Signal Commands

```bash
pnpm quickstart
pnpm quickstart:cold
pnpm quickstart:fast
pnpm build
pnpm test
pnpm smoke:apply
pnpm smoke:fake-openclaw
```

Connector quick smoke:

```bash
pnpm lobe -- init
pnpm lobe -- doctor
pnpm lobe -- start
```

## Cloud Gate Notes

- License creation: `POST /api/license/create`
- License validation: `POST /api/license/validate`
- Polar webhook: `POST /api/polar/webhook`

Webhook contract and strict/placeholder modes:

- `docs/WEBHOOK_EVENT_CONTRACT.md`

## Release and Validation Docs

- `docs/GATE_A_ONBOARDING.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/REVENUE_VALIDATION_GATE.md`
- `docs/ROADMAP.md`
