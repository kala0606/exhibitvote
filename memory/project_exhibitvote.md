---
name: ExhibitVote project context
description: Full-stack voting app built for EarthAlive thesis off-site — session management, presentation timer, weighted ranked-choice voting
type: project
---

Full-stack ExhibitVote app lives at EXHIBITVOTE/ (relative to working directory).

**Stack:** React + Vite + TypeScript + Tailwind (frontend, port 3000) · Express + TypeScript + better-sqlite3 + Socket.io (backend, port 3001)

**Start:** `npm run dev` inside both `backend/` and `frontend/` — or use the start.sh script at root.

**Key mechanics implemented:**
- Group size weight coefficients: Solo ×1.0, Duo ×1.2, Group(3–4) ×1.5
- 3 seed votes per student: Gold (3 pts, 1st choice), Silver (2 pts, 2nd), Bronze (1 pt, 3rd)
- Fairness rule: students cannot vote for their own idea
- Ranked choice algorithm using Gold=1st preference, redistributes on elimination
- Tie-breaker: solo project wins over group when tied

**Why:** Built for 23 Srishti thesis students to fairly select one exhibition idea for a shared off-site event.

**How to apply:** When modifying voting logic, keep the weighting and ranked-choice algorithm in `backend/src/services/votingAlgorithm.ts`. Frontend pages are in `frontend/src/pages/`.
