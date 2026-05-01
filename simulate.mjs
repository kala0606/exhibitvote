// Full simulation: 1 session, 8 ideas, 23 students, all vote, show results
const BASE = 'http://localhost:4001/api';

const ideas = [
  {
    title: 'Breathing City',
    description: "A large-scale air-quality installation that visualises Delhi's pollution data in real time through coloured mist columns. Audience blows into tubes to affect the display.",
    type: 'group',
    presenter_name: 'Aanya Sharma',
    member_names: ['Rohan Mehta', 'Priya Nair', 'Dev Bose'],
  },
  {
    title: 'Root Memory',
    description: 'Archival soil samples from 23 cities embedded in resin blocks, paired with olfactory dispensers. Visitors match smell to city on a tactile map.',
    type: 'solo',
    presenter_name: 'Siddharth Iyer',
    member_names: [],
  },
  {
    title: 'The Monsoon Room',
    description: 'A humid walk-through chamber with real-time rainfall sonification and infrared body tracking that generates personal rain patterns projected on the walls.',
    type: 'duo',
    presenter_name: 'Fatima Zahra',
    member_names: ['Kabir Singh'],
  },
  {
    title: 'Edible Geography',
    description: 'A participatory installation where visitors grow micro-greens in soil kits tied to specific geographic coordinates. Final exhibition harvests them collectively.',
    type: 'group',
    presenter_name: 'Meera Pillai',
    member_names: ['Arjun Rawat', 'Tanvi Joshi'],
  },
  {
    title: 'Signal Decay',
    description: 'Old broadcast frequencies captured and decomposed into visual noise on analogue TV sets. Visitors tune physical dials to reveal buried transmissions.',
    type: 'solo',
    presenter_name: 'Nikhil Verma',
    member_names: [],
  },
  {
    title: 'Tide Table',
    description: 'A kinetic dining table whose surface rises and falls with live tidal data from coastal Indian cities. Objects placed on it shift as tides change.',
    type: 'duo',
    presenter_name: 'Ishaan Chandra',
    member_names: ['Rhea D\'Souza'],
  },
  {
    title: 'Ghosts of the Ghat',
    description: 'Projection-mapped AR on a replica stone ghat staircase. Visitors pour water which triggers layered historical and ecological footage from Varanasi waterways.',
    type: 'group',
    presenter_name: 'Sunita Krishnan',
    member_names: ['Mihir Jain', 'Pooja Tiwari', 'Akash Patel'],
  },
  {
    title: 'Carbon Diary',
    description: "A personal carbon footprint visualiser built into a diary format. Visitors fill out a day's activities and receive a printed receipt showing ecological equivalence.",
    type: 'solo',
    presenter_name: 'Zara Khan',
    member_names: [],
  },
];

// 23 students — all the idea members + extra students
const allStudentNames = [
  // Idea members (presenter + members)
  'Aanya Sharma', 'Rohan Mehta', 'Priya Nair', 'Dev Bose',
  'Siddharth Iyer',
  'Fatima Zahra', 'Kabir Singh',
  'Meera Pillai', 'Arjun Rawat', 'Tanvi Joshi',
  'Nikhil Verma',
  'Ishaan Chandra', "Rhea D'Souza",
  'Sunita Krishnan', 'Mihir Jain', 'Pooja Tiwari', 'Akash Patel',
  'Zara Khan',
  // Extra students with no idea
  'Riya Gupta', 'Omar Sheikh', 'Lakshmi Rao', 'Tariq Ansari', 'Nandini Bhat',
];

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-student-token'] = token;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

function pick(arr, exclude = []) {
  return arr.filter(x => !exclude.includes(x));
}

// Weighted random pick — simulate realistic voting preferences
// ideas ranked by "buzz" so some get more love
const BUZZ = [0.22, 0.08, 0.17, 0.12, 0.07, 0.11, 0.15, 0.08]; // must sum to 1

function weightedSample(candidates, weights, n) {
  const result = [];
  const available = [...candidates];
  const w = [...weights];
  for (let i = 0; i < n && available.length > 0; i++) {
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < w.length - 1; idx++) {
      r -= w[idx];
      if (r <= 0) break;
    }
    result.push(available[idx]);
    available.splice(idx, 1);
    w.splice(idx, 1);
  }
  return result;
}

async function run() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ExhibitVote — Full Simulation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Create session
  const { data: session } = await req('POST', '/sessions', { name: 'EarthAlive Thesis Off-site 2026' });
  console.log(`✅ Session created: "${session.name}" (code: ${session.code})`);

  // 2. Add ideas
  const createdIdeas = [];
  for (const idea of ideas) {
    const { data } = await req('POST', `/sessions/${session.id}/ideas`, idea);
    createdIdeas.push(data);
    console.log(`   💡 Added: "${data.title}" [${data.type}]`);
  }

  // 3. Join 23 students
  console.log(`\n👥 Joining ${allStudentNames.length} students…`);
  const students = [];
  for (const name of allStudentNames) {
    const { data } = await req('POST', '/students/join', { code: session.code, name });
    students.push(data.student);
  }
  console.log(`   ✅ ${students.length} students joined`);

  // 4. Open voting
  await req('PUT', `/sessions/${session.id}/state`, { state: 'voting' });
  console.log('\n🗳️  Voting opened');

  // 5. Build a lookup: student name → idea IDs they belong to (can't vote for those)
  const membershipMap = new Map(); // studentName → [ideaId, ...]
  for (const idea of createdIdeas) {
    const members = [idea.presenter_name, ...idea.member_names];
    for (const m of members) {
      if (!membershipMap.has(m)) membershipMap.set(m, []);
      membershipMap.get(m).push(idea.id);
    }
  }

  // 6. Each student votes
  console.log('\n📊 Students casting votes…\n');
  let voteCount = 0;
  const voteLog = [];

  for (const student of students) {
    const ownIdeas = membershipMap.get(student.name) ?? [];
    const eligible = createdIdeas.filter(i => !ownIdeas.includes(i.id));

    if (eligible.length < 3) {
      console.log(`   ⚠️  ${student.name} — not enough eligible ideas to vote, skipping`);
      continue;
    }

    // Build weights for eligible ideas based on buzz
    const eligibleWeights = eligible.map(idea => {
      const origIdx = createdIdeas.findIndex(i => i.id === idea.id);
      return BUZZ[origIdx] ?? 0.05;
    });

    const [gold, silver, bronze] = weightedSample(eligible, eligibleWeights, 3);

    const { status, data } = await req(
      'POST',
      `/sessions/${session.id}/votes`,
      { gold_idea_id: gold.id, silver_idea_id: silver.id, bronze_idea_id: bronze.id },
      student.token
    );

    if (status === 200) {
      voteCount++;
      voteLog.push({ name: student.name, gold: gold.title, silver: silver.title, bronze: bronze.title });
      process.stdout.write(`   🥇 ${student.name.padEnd(20)} → G: ${gold.title.substring(0,18).padEnd(18)}  S: ${silver.title.substring(0,18).padEnd(18)}  B: ${bronze.title.substring(0,16)}\n`);
    } else {
      console.log(`   ❌ ${student.name} vote failed: ${JSON.stringify(data)}`);
    }
  }

  console.log(`\n✅ ${voteCount} / ${students.length} votes cast`);

  // 7. Close voting & fetch results
  await req('PUT', `/sessions/${session.id}/state`, { state: 'results' });
  console.log('🔒 Voting closed\n');

  const { data: results } = await req('GET', `/sessions/${session.id}/results`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  results.ideas.forEach((idea, i) => {
    const medal = ['🥇','🥈','🥉'][i] ?? `#${i+1}`;
    const bar = '█'.repeat(Math.round(idea.weightedScore / 2));
    console.log(`${medal}  ${idea.title.padEnd(22)} | G:${String(idea.goldVotes).padStart(2)} S:${String(idea.silverVotes).padStart(2)} B:${String(idea.bronzeVotes).padStart(2)} | raw:${String(idea.rawScore).padStart(3)} ×${idea.weightMultiplier} = ${idea.weightedScore.toFixed(1).padStart(5)} pts  ${bar}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (results.winner) {
    console.log(`\n🏆 WINNER: ${results.winner.title}`);
    console.log(`   Presented by: ${results.winner.presenterName}`);
    console.log(`   Weighted score: ${results.winner.weightedScore.toFixed(2)} pts`);
    if (results.tiebreakApplied) console.log('   ⚖️  Tie-breaker was applied (solo priority)');
  }

  console.log(`\n📋 Ranked Choice — ${results.rankedChoiceRounds.length} round(s):`);
  results.rankedChoiceRounds.forEach(r => {
    const counts = Object.entries(r.counts)
      .sort(([,a],[,b]) => b - a)
      .map(([id, c]) => {
        const name = results.ideas.find(i => i.id === id)?.title ?? id;
        return `${name.substring(0,16)}: ${c.toFixed(1)}`;
      }).join('  |  ');
    const note = r.winner
      ? `→ 🏆 Winner: ${results.ideas.find(i => i.id === r.winner)?.title}`
      : `→ ❌ Eliminated: ${results.ideas.find(i => i.id === r.eliminated)?.title}`;
    console.log(`   Round ${r.round}: ${counts}`);
    console.log(`            ${note}`);
  });

  console.log(`\n   Session ID: ${session.id}`);
  console.log(`   View at: http://localhost:3002/admin/session/${session.id}/results\n`);
}

run().catch(console.error);
