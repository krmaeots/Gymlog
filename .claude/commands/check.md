---
description: Run the full local quality gate (typecheck + tests + lint + build)
---

Run the project's quality gate and report results concisely. Stop at the first
failing step, show the relevant error output, and propose a fix.

1. `npm run typecheck`
2. `npm test`
3. `npm run lint`
4. `npm run build`

If all pass, confirm the app is ready to commit/deploy. Do not commit or push
unless I explicitly ask.
