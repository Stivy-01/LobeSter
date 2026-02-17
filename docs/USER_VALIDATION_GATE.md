# Gate A: CLI User Validation

Run this gate before investing in advanced UI/graph work.

## Participants

- 3 real target users (not project contributors)

## Script

1. `lobe init`
2. Install a skill (local path or GitHub public repo)
3. Create engram via API/UI
4. `lobe set --engram <engram>`
5. Confirm generated config path output

## Success Threshold

- At least 2/3 users complete in under 15 minutes with no developer intervention.

## Failure Rule

- If threshold fails, pause roadmap and fix top 3 blockers first.




