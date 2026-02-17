# Gate A Tester Onboarding

Goal: install one skill, create one engram, set it, verify generated config.

Target time: **15 minutes max**.  
If stuck for more than 3 minutes on any step, stop and report.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Terminal (bash/zsh or PowerShell)

From repo root:

```bash
pnpm install
pnpm build
```

## Step 1: Initialize LobeSter (1 minute)

Create a minimal OpenClaw base config if you do not already have one.

### bash/zsh

```bash
mkdir -p ~/.openclaw
echo '{"skills":{"entries":{}}}' > ~/.openclaw/openclaw.json
```

### PowerShell

```powershell
New-Item -ItemType Directory -Force "$HOME\.openclaw" | Out-Null
'{"skills":{"entries":{}}}' | Set-Content "$HOME\.openclaw\openclaw.json" -Encoding Ascii
```

Initialize and start connector:

```bash
pnpm lobe -- init
pnpm lobe -- start
```

Leave this terminal running. Open a second terminal for the next steps.

## Step 2: Create a sample skill folder (2 minutes)

### bash/zsh

```bash
SKILL_DIR="$(mktemp -d)/lobester-sample-skill"
mkdir -p "$SKILL_DIR"
cat > "$SKILL_DIR/lobester.json" << 'EOF'
{
  "name": "Sample Skill",
  "openclawKey": "sample_skill",
  "version": "0.1.0"
}
EOF
echo "$SKILL_DIR"
```

### PowerShell

```powershell
$SKILL_DIR = "$env:TEMP\lobester-sample-skill"
New-Item -ItemType Directory -Force $SKILL_DIR | Out-Null
@'
{
  "name": "Sample Skill",
  "openclawKey": "sample_skill",
  "version": "0.1.0"
}
'@ | Set-Content "$SKILL_DIR\lobester.json" -Encoding Ascii
Write-Host $SKILL_DIR
```

Keep the printed folder path.

## Step 3: Choose one test path

Pick one path only.

## Path A: CLI flow

Install the skill:

```bash
pnpm lobe -- skill install --source local --ref "<YOUR_SKILL_DIR>"
```

Copy the printed skill `id`.

Create engram:

```bash
pnpm lobe -- create engram --name gate-a --skills "<SKILL_ID>"
```

Set engram:

```bash
pnpm lobe -- set --engram gate-a
```

## Path B: UI flow

1. Open `http://localhost:3210`.
2. In `Skills`, install from local path using your sample skill folder.
3. Copy the installed skill ID shown in list.
4. In `Engrams`, create engram `gate-a` and paste the skill ID.
5. In `Set`, select `gate-a` and click `Set engram`.

## Step 4: Verify generated config (2 minutes)

Expected file:

- `~/.lobester/openclaw/openclaw.generated.json`

### bash/zsh

```bash
test -f ~/.lobester/openclaw/openclaw.generated.json && echo OK
grep -n "sample_skill" ~/.lobester/openclaw/openclaw.generated.json
```

### PowerShell

```powershell
Test-Path "$HOME\.lobester\openclaw\openclaw.generated.json"
Select-String -Path "$HOME\.lobester\openclaw\openclaw.generated.json" -Pattern "sample_skill"
```

Success means:

- Generated config file exists.
- `sample_skill` is present in generated config.
- No blocking error during set.

## Step 5: Report back (2 minutes)

Copy/paste and fill:

```text
Path used: CLI / UI
OS: macOS / Linux / Windows / WSL
Total time: ___ minutes
Did set succeed: yes / no
First moment of confusion: ___________
```

## Timing Notes

- Scripted benchmark is not used for Gate A scoring.
- Gate A uses human completion time and confusion points only.


