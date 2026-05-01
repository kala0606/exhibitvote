export type SessionState = 'setup' | 'presenting' | 'voting' | 'results';
export type IdeaType = 'solo' | 'duo' | 'group';

export interface Session {
  id: string;
  name: string;
  code: string;
  state: SessionState;
  current_idea_index: number;
  created_at: number;
  ideas?: Idea[];
  students?: StudentPublic[];
  voteCount?: number;
}

export interface StudentPublic {
  id: string;
  name: string;
  session_id: string;
  created_at: number;
}

export interface Student extends StudentPublic {
  token: string;
}

export interface Idea {
  id: string;
  session_id: string;
  title: string;
  description: string;
  type: IdeaType;
  member_names: string[];
  presenter_name: string;
  order_index: number;
  created_at: number;
}

export interface Vote {
  id: string;
  session_id: string;
  voter_id: string;
  gold_idea_id: string;
  silver_idea_id: string;
  bronze_idea_id: string;
  created_at: number;
}

export interface IdeaResult {
  id: string;
  title: string;
  type: IdeaType;
  memberCount: number;
  presenterName: string;
  goldVotes: number;
  silverVotes: number;
  bronzeVotes: number;
  rawScore: number;
  weightMultiplier: number;
  weightedScore: number;
  firstChoiceWeightedVotes: number;
}

export interface RankedChoiceRound {
  round: number;
  counts: Record<string, number>;
  eliminated: string | null;
  winner: string | null;
}

export interface ResultsSummary {
  ideas: IdeaResult[];
  rankedChoiceRounds: RankedChoiceRound[];
  winner: IdeaResult | null;
  totalVoters: number;
  tiebreakApplied: boolean;
}
