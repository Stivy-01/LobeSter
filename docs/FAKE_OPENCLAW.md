# Fake OpenClaw

`apps/fake-openclaw` is a lightweight local shim to validate the OpenClaw integration contract without real OpenClaw infrastructure.

## What it checks

- `OPENCLAW_CONFIG_PATH` (or `--config`) is readable JSON
- `skills.entries` is present and valid
- each skill entry has a directory path that exists
- each skill directory has at least one manifest marker:
  - `SKILL.md`
  - `lobester.json`
- optional required env vars declared under `env:` in `SKILL.md` frontmatter

## Commands

From repo root:

```powershell
pnpm fake-openclaw:validate -- --config "C:\Users\andre\.lobester\openclaw\openclaw.generated.json"
```

Strict env mode:

```powershell
pnpm fake-openclaw:validate -- --config "C:\Users\andre\.lobester\openclaw\openclaw.generated.json" --strict-env
```

Run as a local service:

```powershell
pnpm fake-openclaw:start -- --port 8787 --config "C:\Users\andre\.lobester\openclaw\openclaw.generated.json"
```

Endpoints:

- `GET /health`
- `GET /validate?config=<path>&strictEnv=1`
- `POST /validate` body:

```json
{
  "configPath": "C:\\Users\\andre\\.lobester\\openclaw\\openclaw.generated.json",
  "strictEnv": false
}
```

## End-to-end smoke

Runs connector apply flow in a temp folder, then validates output with FakeOpenClaw:

```powershell
pnpm smoke:fake-openclaw
```
