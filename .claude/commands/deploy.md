---
description: Verify and ship GymLog to GitHub Pages
---

Deploy GymLog. Deployment is push-to-deploy via GitHub Actions
(`.github/workflows/deploy.yml`), so "deploy" = make sure `main` is green and
push.

Steps:
1. Run the quality gate: `npm run typecheck && npm test && npm run build`.
   If anything fails, stop and report — do not push.
2. Show me `git status` and the diff summary of what will ship.
3. Only after I confirm, commit with a clear message and `git push` to `main`.
4. Report the live URL (https://krmaeots.github.io/Gymlog/) and remind me the
   Action takes ~1–2 min. Offer to watch it with `gh run watch`.

Never force-push. Never push without showing me the diff first.
