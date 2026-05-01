import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { ResultsSummary } from '../types';
import { joinSessionRoom, leaveSessionRoom, getSocket } from '../socket';

export default function StudentResults() {
  const navigate = useNavigate();
  const sessionId = localStorage.getItem('ev_session_id') ?? '';
  const [results, setResults] = useState<ResultsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionName, setSessionName] = useState('');

  const load = useCallback(async () => {
    if (!sessionId) { navigate('/join'); return; }
    try {
      const [s, r] = await Promise.all([
        api.sessions.get(sessionId),
        api.results.get(sessionId),
      ]);
      setSessionName(s.name);
      setResults(r);
    } finally { setLoading(false); }
  }, [sessionId, navigate]);

  useEffect(() => {
    load();
    if (!sessionId) return;
    joinSessionRoom(sessionId);
    const socket = getSocket();
    socket.on('session:state', load);
    return () => { leaveSessionRoom(sessionId); socket.off('session:state', load); };
  }, [sessionId, load]);

  if (loading) return <div className="min-h-screen bg-surface-900 flex items-center justify-center text-gray-400">Loading results…</div>;
  if (!results) return null;

  const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

  return (
    <div className="min-h-screen bg-surface-900 pb-10">
      {/* Hero */}
      <div className="bg-gradient-to-b from-brand-900/40 to-surface-900 px-4 pt-10 pb-8 text-center">
        <div className="text-5xl mb-3">🏆</div>
        <h1 className="text-2xl font-bold text-white mb-1">Results Are In!</h1>
        <p className="text-gray-400 text-sm">{sessionName}</p>
        <p className="text-gray-500 text-xs mt-1">{results.totalVoters} students voted</p>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-6 -mt-2">
        {/* Winner */}
        {results.winner && (
          <div className="card border-brand-500/50 bg-gradient-to-br from-brand-900/30 to-surface-800 animate-fade-in-up">
            <div className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-2">🏆 Winner</div>
            <h2 className="text-2xl font-bold text-white mb-1">{results.winner.title}</h2>
            <p className="text-gray-400 text-sm mb-3">Presented by {results.winner.presenterName}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-surface-700 px-2.5 py-1 rounded-full text-brand-300">
                Score: {results.winner.weightedScore.toFixed(1)}
              </span>
              <span className="bg-surface-700 px-2.5 py-1 rounded-full text-yellow-400">
                🥇 {results.winner.goldVotes} gold votes
              </span>
              {results.tiebreakApplied && (
                <span className="bg-yellow-900/30 border border-yellow-800/30 px-2.5 py-1 rounded-full text-yellow-500">
                  ⚖️ Tie-breaker applied
                </span>
              )}
            </div>
          </div>
        )}

        {/* All results */}
        <div>
          <h3 className="font-semibold text-gray-400 text-sm mb-3">All Ideas — Final Rankings</h3>
          <div className="space-y-2">
            {results.ideas.map((idea, idx) => (
              <div key={idea.id} className={`card flex items-center gap-4 ${idx === 0 ? 'border-brand-500/30' : ''}`}>
                <div className="text-xl w-7 text-center shrink-0">{MEDAL[idx] ?? `#${idx + 1}`}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{idea.title}</div>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                    <span className="text-yellow-400">🥇{idea.goldVotes}</span>
                    <span>🥈{idea.silverVotes}</span>
                    <span className="text-amber-600">🥉{idea.bronzeVotes}</span>
                    <span className="text-brand-400 font-medium">{idea.weightedScore.toFixed(1)} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring note */}
        <div className="card text-xs text-gray-500 space-y-1">
          <div className="font-medium text-gray-400 mb-2">How scores work</div>
          <div>🥇 Gold = 3 pts · 🥈 Silver = 2 pts · 🥉 Bronze = 1 pt</div>
          <div>Solo ideas ×1.0 · Duo ×1.2 · Group (3–4) ×1.5</div>
          <div>Winner chosen by ranked-choice voting using gold votes as 1st preference.</div>
        </div>

        <div className="text-center">
          <button onClick={() => { localStorage.clear(); navigate('/join'); }} className="btn-ghost text-xs text-gray-500">
            Leave Session
          </button>
        </div>
      </div>
    </div>
  );
}
