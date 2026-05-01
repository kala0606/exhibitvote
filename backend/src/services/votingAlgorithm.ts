import { Idea, Vote, IdeaResult, RankedChoiceRound, ResultsSummary, IdeaType } from '../types';

function getWeight(memberCount: number): number {
  if (memberCount <= 1) return 1.0;
  if (memberCount === 2) return 1.2;
  return 1.5;
}

function getMemberCount(type: IdeaType, memberNames: string[]): number {
  return memberNames.length || (type === 'solo' ? 1 : type === 'duo' ? 2 : 3);
}

export function calculateResults(ideas: Idea[], votes: Vote[]): ResultsSummary {
  if (ideas.length === 0 || votes.length === 0) {
    return {
      ideas: [],
      rankedChoiceRounds: [],
      winner: null,
      totalVoters: votes.length,
      tiebreakApplied: false,
    };
  }

  const ideaMap = new Map(ideas.map(i => [i.id, i]));

  // Build per-idea tallies
  const tallies = new Map<string, { gold: number; silver: number; bronze: number }>();
  ideas.forEach(i => tallies.set(i.id, { gold: 0, silver: 0, bronze: 0 }));

  for (const vote of votes) {
    const g = tallies.get(vote.gold_idea_id);
    const s = tallies.get(vote.silver_idea_id);
    const b = tallies.get(vote.bronze_idea_id);
    if (g) g.gold++;
    if (s) s.silver++;
    if (b) b.bronze++;
  }

  // Build idea results with weighted scoring
  const ideaResults: IdeaResult[] = ideas.map(idea => {
    const t = tallies.get(idea.id) ?? { gold: 0, silver: 0, bronze: 0 };
    const memberCount = getMemberCount(idea.type, idea.member_names);
    const weight = getWeight(memberCount);
    const rawScore = t.gold * 3 + t.silver * 2 + t.bronze * 1;
    const weightedScore = rawScore * weight;
    return {
      id: idea.id,
      title: idea.title,
      type: idea.type,
      memberCount,
      presenterName: idea.presenter_name,
      goldVotes: t.gold,
      silverVotes: t.silver,
      bronzeVotes: t.bronze,
      rawScore,
      weightMultiplier: weight,
      weightedScore,
      firstChoiceWeightedVotes: t.gold * weight,
    };
  });

  ideaResults.sort((a, b) => b.weightedScore - a.weightedScore);

  // Ranked choice using gold=1st, silver=2nd, bronze=3rd preferences
  // Each vote carries weight from the voter's idea's perspective — but voters
  // themselves are unweighted; weight is on the *receiving* idea.
  const rounds: RankedChoiceRound[] = [];
  let activeIds = new Set(ideas.map(i => i.id));
  let currentVotes = votes.map(v => ({
    preferences: [v.gold_idea_id, v.silver_idea_id, v.bronze_idea_id].filter(
      id => id && ideaMap.has(id)
    ),
  }));

  const totalWeightedVotes = () => {
    let total = 0;
    for (const id of activeIds) {
      const idea = ideaMap.get(id)!;
      const memberCount = getMemberCount(idea.type, idea.member_names);
      const weight = getWeight(memberCount);
      const goldCount = currentVotes.filter(v => v.preferences[0] === id).length;
      total += goldCount * weight;
    }
    return total;
  };

  let winner: string | null = null;
  let tiebreakApplied = false;
  const MAX_ROUNDS = 20;

  for (let round = 1; round <= MAX_ROUNDS && activeIds.size > 1; round++) {
    // Count first-choice weighted votes per active idea
    const roundCounts: Record<string, number> = {};
    activeIds.forEach(id => (roundCounts[id] = 0));

    for (const vote of currentVotes) {
      const topChoice = vote.preferences.find(id => activeIds.has(id));
      if (!topChoice) continue;
      const idea = ideaMap.get(topChoice)!;
      const memberCount = getMemberCount(idea.type, idea.member_names);
      const weight = getWeight(memberCount);
      roundCounts[topChoice] = (roundCounts[topChoice] ?? 0) + weight;
    }

    const total = Object.values(roundCounts).reduce((a, b) => a + b, 0);
    const majority = total / 2;

    // Check for majority winner
    let roundWinner: string | null = null;
    for (const [id, count] of Object.entries(roundCounts)) {
      if (count > majority) {
        roundWinner = id;
        break;
      }
    }

    if (roundWinner) {
      rounds.push({ round, counts: roundCounts, eliminated: null, winner: roundWinner });
      winner = roundWinner;
      break;
    }

    // Find minimum to eliminate
    const minCount = Math.min(...Object.values(roundCounts));
    const tied = Object.entries(roundCounts)
      .filter(([, c]) => c === minCount)
      .map(([id]) => id);

    // Tie-breaker: solo wins (keep solo ideas; eliminate group first)
    let toEliminate: string;
    if (tied.length === 1) {
      toEliminate = tied[0];
    } else {
      // Among tied: prefer to keep solos, eliminate largest group
      const sorted = tied.sort((a, b) => {
        const ma = getMemberCount(ideaMap.get(a)!.type, ideaMap.get(a)!.member_names);
        const mb = getMemberCount(ideaMap.get(b)!.type, ideaMap.get(b)!.member_names);
        return mb - ma; // eliminate largest group first
      });
      toEliminate = sorted[0];
      if (tied.length > 1) tiebreakApplied = true;
    }

    rounds.push({ round, counts: roundCounts, eliminated: toEliminate, winner: null });
    activeIds.delete(toEliminate);

    // If only one left, it's the winner
    if (activeIds.size === 1) {
      winner = [...activeIds][0];
      rounds[rounds.length - 1].winner = winner;
      break;
    }
  }

  // If somehow no winner from ranked choice, fall back to highest weighted score
  if (!winner && ideaResults.length > 0) {
    winner = ideaResults[0].id;
  }

  const winnerResult = ideaResults.find(r => r.id === winner) ?? null;

  return {
    ideas: ideaResults,
    rankedChoiceRounds: rounds,
    winner: winnerResult,
    totalVoters: votes.length,
    tiebreakApplied,
  };
}
