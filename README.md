# 🌍 ExhibitVote

> Fair Exhibition Idea Voting System — built for thesis off-sites where students pitch ideas and the group votes on which one to exhibit together.

![ExhibitVote](https://img.shields.io/badge/stack-React%20%2B%20Express%20%2B%20SQLite-22c55e?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

---

## What it does

23 students. 8 ideas. One exhibition slot. ExhibitVote runs the whole process — from pitching to results — fairly.

Each student gets **3 seed votes** (Gold / Silver / Bronze) to distribute across ideas they didn't make. The system applies **group-size weighting** so a solo student isn't outgunned by a team of four, then runs **ranked-choice voting** to find a majority winner.

---

## How a session works

```
Setup → Presenting → Voting → Results
```

| Phase | What happens |
|---|---|
| **Setup** | Admin creates a session, students join via a 6-digit code, ideas are added and drag-reordered |
| **Presenting** | Full-screen presentation mode with a 3-min pitch timer + 2-min Q&A timer per idea. Admin can skip or advance at any time |
| **Voting** | Each student allocates Gold (3 pts), Silver (2 pts), Bronze (1 pt) — can't vote for their own idea |
| **Results** | Weighted scores + ranked-choice rounds revealed with a bar chart and per-round breakdown |

---

## The Voting Mechanics

### Group Size Coefficients
To level the playing field between solo and group projects:

| Project type | Weight multiplier |
|---|---|
| Solo | ×1.0 |
| Duo (2 people) | ×1.2 |
| Group (3–4 people) | ×1.5 |

### Seed Votes
Every student distributes exactly 3 votes:
- 🥇 **Gold (3 pts)** — most feasible + exciting idea
- 🥈 **Silver (2 pts)** — most conceptually rigorous idea
- 🥉 **Bronze (1 pt)** — wildcard / most experimental idea

**Fairness rule:** you cannot vote for any idea you're a member of.

### Ranked Choice
Gold votes serve as 1st-choice preferences:
1. Count weighted 1st-choice votes per idea
2. If any idea has **>50% majority** → winner
3. If not → eliminate the idea with fewest votes, redistribute those voters' Silver votes as new 1st choices
4. Repeat until a majority emerges

**Tie-breaker:** if ideas tie for elimination, the largest group is eliminated first (solo project wins by default — a solo student managing a full thesis exhibition demonstrates higher per-capita complexity).

### Scoring Rubric
Voters are asked to consider three criteria:

| Criteria | Question |
|---|---|
| **Feasibility** | Can this actually be built/installed in the given time and space? |
| **Cohesion** | Does the exhibition tell a singular, powerful story? |
| **Engagement** | How will the audience interact with the "bits and atoms" of the work? |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite via `better-sqlite3` |
| Real-time | Socket.io (live state sync across all devices) |
| Deploy | Fly.io (single Docker image, SQLite on a persistent volume) |

---

## Running locally

**Prerequisites:** Node.js 20+

```bash
# Clone
git clone https://github.com/kala0606/exhibitvote.git
cd exhibitvote

# Install deps
npm run install:all

# Start both servers
./start.sh
```

- Frontend: http://localhost:3000 (student + admin UI)
- Backend API: http://localhost:4001

Or start them separately:
```bash
cd backend && npm run dev   # API on :4001
cd frontend && npm run dev  # UI on :3000, proxies /api → :4001
```

---

## Deploying to Fly.io

```bash
# Install flyctl and log in
brew install flyctl
fly auth login

# Create the app (say YES to copy config, NO to deploy now)
fly launch --name exhibitvote --region sin --no-deploy

# Create persistent volume for SQLite
fly volumes create exhibitvote_data --region sin --size 1

# Deploy
fly deploy
```

Every subsequent deploy:
```bash
fly deploy
```

The Dockerfile builds the React app and compiles the TypeScript backend in a multi-stage build. Express serves the built frontend as static files in production — single process, single port.

---

## Project Structure

```
exhibitvote/
├── backend/
│   └── src/
│       ├── index.ts              # Express server + static file serving
│       ├── db.ts                 # SQLite setup
│       ├── socket.ts             # Socket.io (real-time events)
│       ├── routes/               # sessions, students, ideas, votes, results
│       ├── services/
│       │   └── votingAlgorithm.ts  # Weighted ranked-choice engine
│       └── types.ts
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── AdminDashboard.tsx
│       │   ├── AdminSession.tsx   # Manage ideas, stage control
│       │   ├── AdminPresent.tsx   # Timer + presentation queue
│       │   ├── AdminResults.tsx   # Charts + ranked-choice breakdown
│       │   ├── StudentJoin.tsx
│       │   ├── StudentLobby.tsx   # Live presentation view
│       │   ├── StudentVote.tsx    # Tap-to-assign Gold/Silver/Bronze
│       │   └── StudentResults.tsx
│       ├── api.ts                 # Typed fetch wrapper
│       └── socket.ts              # Socket.io client
├── Dockerfile                     # Multi-stage production build
├── fly.toml                       # Fly.io config + volume mount
└── simulate.mjs                   # Full 23-student test simulation
```

---

## Running the simulation

To test the full voting flow with 8 realistic ideas and 23 students (all with authentic fairness-rule enforcement):

```bash
# Make sure the backend is running first
node simulate.mjs
```

Prints a full vote log, weighted leaderboard, and ranked-choice round-by-round breakdown to the terminal.

---

## Routes

| Path | Who | Description |
|---|---|---|
| `/join` | Students | Enter session code + name |
| `/lobby` | Students | Watch live presentation queue |
| `/vote` | Students | Cast Gold / Silver / Bronze votes |
| `/results-student` | Students | See winner + leaderboard |
| `/admin` | Facilitator | Create and manage sessions |
| `/admin/session/:id` | Facilitator | Add ideas, control stage |
| `/admin/session/:id/present` | Facilitator | Presentation timer + skip |
| `/admin/session/:id/results` | Facilitator | Full results + raw data |

---

## License

MIT
