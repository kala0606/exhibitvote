import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Session, Idea, IdeaType } from '../types';
import { joinSessionRoom, leaveSessionRoom, getSocket } from '../socket';

type VoteSlot = 'gold' | 'silver' | 'bronze';

const SLOT_CONFIG: Record<VoteSlot, { label: string; points: number; emoji: string; cls: string; desc: string }> = {
  gold:   { label: 'Gold',   points: 3, emoji: '🥇', cls: 'vote-gold',   desc: 'Most feasible + exciting idea' },
  silver: { label: 'Silver', points: 2, emoji: '🥈', cls: 'vote-silver', desc: 'Most conceptually rigorous' },
  bronze: { label: 'Bronze', points: 1, emoji: '🥉', cls: 'vote-bronze', desc: 'Wildcard — most experimental' },
};

const TYPE_LABELS: Record<IdeaType, string> = { solo: 'Solo', duo: 'Duo', group: 'Group' };

export default function StudentVote() {
  const navigate = useNavigate();
  const sessionId = localStorage.getItem('ev_session_id') ?? '';
  const studentName = localStorage.getItem('ev_student_name') ?? '';
  const [session, setSession] = useState<Session | null>(null);
  const [votes, setVotes] = useState<Record<VoteSlot, string | null>>({ gold: null, silver: null, bronze: null });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [voteProgress, setVoteProgress] = useState({ voteCount: 0, studentCount: 0 });
  const [activeSlot, setActiveSlot] = useState<VoteSlot | null>('gold');

  const load = useCallback(async () => {
    if (!sessionId) { navigate('/join'); return; }
    try {
      const s = await api.sessions.get(sessionId);
      setSession(s);
      if (s.state === 'results') { navigate('/results-student'); return; }
      if (s.state !== 'voting') { navigate('/lobby'); return; }
      setVoteProgress({ voteCount: s.voteCount ?? 0, studentCount: s.students?.length ?? 0 });
      // Check if already voted
      const status = await api.votes.status(sessionId);
      if (status.hasVoted) setSubmitted(true);
    } catch { navigate('/join'); }
  }, [sessionId, navigate]);

  useEffect(() => {
    load();
    if (!sessionId) return;
    joinSessionRoom(sessionId);
    const socket = getSocket();
    socket.on('session:state', ({ state }: { state: string }) => {
      if (state === 'results') navigate('/results-student');
    });
    socket.on('session:vote_cast', ({ voteCount, studentCount }: { voteCount: number; studentCount: number }) => {
      setVoteProgress({ voteCount, studentCount });
    });
    return () => {
      leaveSessionRoom(sessionId);
      socket.off('session:state');
      socket.off('session:vote_cast');
    };
  }, [sessionId, load, navigate]);

  const ideas = session?.ideas ?? [];

  // Ideas this student can vote for (not their own)
  const eligible = ideas.filter(idea => {
    const members = [idea.presenter_name, ...idea.member_names];
    return !members.some(m => m.toLowerCase() === studentName.toLowerCase());
  });

  function getAssignedSlot(ideaId: string): VoteSlot | null {
    for (const slot of ['gold', 'silver', 'bronze'] as VoteSlot[]) {
      if (votes[slot] === ideaId) return slot;
    }
    return null;
  }

  function handleSelectIdea(idea: Idea) {
    if (!activeSlot) return;
    const currentSlot = getAssignedSlot(idea.id);

    if (currentSlot === activeSlot) {
      // Deselect
      setVotes(v => ({ ...v, [activeSlot]: null }));
      return;
    }

    // If idea is assigned to a different slot, swap or clear it
    const newVotes = { ...votes };
    if (currentSlot) {
      newVotes[currentSlot] = null;
    }
    // If another idea is already in activeSlot, free it
    newVotes[activeSlot] = idea.id;
    setVotes(newVotes);

    // Auto-advance to next empty slot
    const slots: VoteSlot[] = ['gold', 'silver', 'bronze'];
    const nextEmpty = slots.find(s => s !== activeSlot && newVotes[s] === null);
    setActiveSlot(nextEmpty ?? null);
  }

  async function handleSubmit() {
    if (!votes.gold || !votes.silver || !votes.bronze) return;
    setSubmitting(true);
    setError('');
    try {
      await api.votes.submit(sessionId, votes.gold, votes.silver, votes.bronze);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally { setSubmitting(false); }
  }

  if (!session) return <div className="min-h-screen bg-surface-900 flex items-center justify-center text-gray-400">Loading…</div>;

  const allFilled = votes.gold && votes.silver && votes.bronze;
  const pct = voteProgress.studentCount > 0 ? (voteProgress.voteCount / voteProgress.studentCount) * 100 : 0;

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="text-center max-w-sm animate-fade-in-up">
          <div className="text-7xl mb-5">🗳️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Vote Submitted!</h2>
          <p className="text-gray-400 mb-6">Your votes are locked in. Waiting for everyone else…</p>
          <div className="card">
            <div className="text-2xl font-bold text-white mb-1">
              {voteProgress.voteCount} <span className="text-gray-500 text-base font-normal">/ {voteProgress.studentCount}</span>
            </div>
            <div className="w-full bg-surface-600 rounded-full h-2 my-2">
              <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500">students have voted</p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 bg-brand-500 rounded-full pulse-ring"></span>
            Results will appear automatically
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-900 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur border-b border-surface-700 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-white text-sm">Cast Your Votes</h1>
            <p className="text-xs text-gray-500">{studentName} · {session.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">{voteProgress.voteCount}/{voteProgress.studentCount} voted</div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Vote slot picker */}
        <div>
          <p className="text-sm text-gray-400 mb-3">Select a vote category, then tap an idea below:</p>
          <div className="grid grid-cols-3 gap-2">
            {(['gold', 'silver', 'bronze'] as VoteSlot[]).map(slot => {
              const cfg = SLOT_CONFIG[slot];
              const assignedIdea = votes[slot] ? ideas.find(i => i.id === votes[slot]) : null;
              return (
                <button
                  key={slot}
                  onClick={() => setActiveSlot(slot)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${activeSlot === slot ? `border-current ${slot === 'gold' ? 'border-yellow-400 bg-yellow-500/10' : slot === 'silver' ? 'border-gray-300 bg-gray-500/10' : 'border-amber-700 bg-amber-900/20'}` : 'border-surface-600 bg-surface-800 hover:border-surface-500'}`}
                >
                  <div className="text-2xl mb-1">{cfg.emoji}</div>
                  <div className="text-xs font-semibold text-white">{cfg.label}</div>
                  <div className="text-xs text-gray-500">{cfg.points} pts</div>
                  {assignedIdea ? (
                    <div className="text-xs text-gray-300 mt-1.5 font-medium line-clamp-1">
                      {assignedIdea.title}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-600 mt-1.5 italic">empty</div>
                  )}
                </button>
              );
            })}
          </div>
          {activeSlot && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Now tap an idea to assign your <span className={`font-medium ${activeSlot === 'gold' ? 'text-yellow-400' : activeSlot === 'silver' ? 'text-gray-300' : 'text-amber-600'}`}>{SLOT_CONFIG[activeSlot].emoji} {SLOT_CONFIG[activeSlot].label}</span> vote
              — <span className="italic">{SLOT_CONFIG[activeSlot].desc}</span>
            </p>
          )}
        </div>

        {/* Ideas list */}
        <div>
          <p className="text-sm font-medium text-gray-400 mb-3">
            {eligible.length} eligible ideas
            {eligible.length < ideas.length && (
              <span className="text-gray-600"> (your own idea{ideas.length - eligible.length > 1 ? 's are' : ' is'} excluded)</span>
            )}
          </p>
          <div className="space-y-2">
            {eligible.map(idea => {
              const assigned = getAssignedSlot(idea.id);
              const cfg = assigned ? SLOT_CONFIG[assigned] : null;
              const isActive = activeSlot !== null;
              return (
                <button
                  key={idea.id}
                  onClick={() => handleSelectIdea(idea)}
                  disabled={!isActive}
                  className={`w-full text-left card transition-all ${assigned ? `border-2 ${assigned === 'gold' ? 'border-yellow-400/60' : assigned === 'silver' ? 'border-gray-400/60' : 'border-amber-700/60'}` : isActive ? 'hover:border-brand-500/50 cursor-pointer' : 'opacity-70 cursor-default'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-surface-700 text-lg">
                      {cfg ? cfg.emoji : '💡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-white text-sm">{idea.title}</span>
                        <span className="badge-gray text-xs">{TYPE_LABELS[idea.type]}</span>
                        {assigned && (
                          <span className={`text-xs font-medium ${assigned === 'gold' ? 'text-yellow-400' : assigned === 'silver' ? 'text-gray-300' : 'text-amber-600'}`}>
                            {cfg!.label} ({cfg!.points} pts)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">{idea.description}</p>
                      <p className="text-xs text-gray-600 mt-1">🎤 {idea.presenter_name}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {ideas.length !== eligible.length && (
          <div className="text-xs text-center text-gray-600 bg-surface-800 border border-surface-700 rounded-lg px-4 py-3">
            🚫 You cannot vote for your own idea — fairness rule
          </div>
        )}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface-900/95 backdrop-blur border-t border-surface-700 p-4">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-red-400 text-sm mb-2 text-center">{error}</p>}
          <div className="flex items-center gap-3">
            <div className="flex gap-2 flex-1">
              {(['gold', 'silver', 'bronze'] as VoteSlot[]).map(slot => (
                <div key={slot} className={`flex-1 h-1.5 rounded-full ${votes[slot] ? (slot === 'gold' ? 'bg-yellow-400' : slot === 'silver' ? 'bg-gray-300' : 'bg-amber-700') : 'bg-surface-600'}`} />
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!allFilled || submitting}
              className="btn-primary px-6 py-3"
            >
              {submitting ? 'Submitting…' : allFilled ? 'Submit Votes 🗳️' : `Pick ${3 - [votes.gold, votes.silver, votes.bronze].filter(Boolean).length} more`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
