import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Session, Idea, IdeaType } from '../types';
import { joinSessionRoom, leaveSessionRoom, getSocket } from '../socket';

const TYPE_LABELS: Record<IdeaType, string> = { solo: 'Solo', duo: 'Duo', group: 'Group (3–4)' };

export default function StudentLobby() {
  const navigate = useNavigate();
  const sessionId = localStorage.getItem('ev_session_id') ?? '';
  const studentName = localStorage.getItem('ev_student_name') ?? '';
  const [session, setSession] = useState<Session | null>(null);
  const [currentIdea, setCurrentIdea] = useState<Idea | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) { navigate('/join'); return; }
    try {
      const s = await api.sessions.get(sessionId);
      setSession(s);
      if (s.state === 'voting') { navigate('/vote'); return; }
      if (s.state === 'results') { navigate('/results-student'); return; }
      const ideas = s.ideas ?? [];
      setCurrentIdea(ideas[s.current_idea_index ?? 0] ?? null);
    } catch { navigate('/join'); }
  }, [sessionId, navigate]);

  useEffect(() => {
    load();
    if (!sessionId) return;
    joinSessionRoom(sessionId);
    const socket = getSocket();
    socket.on('session:state', ({ state }: { state: string }) => {
      if (state === 'voting') navigate('/vote');
      if (state === 'results') navigate('/results-student');
    });
    socket.on('session:advance', load);
    socket.on('session:student_joined', load);
    return () => {
      leaveSessionRoom(sessionId);
      socket.off('session:state');
      socket.off('session:advance', load);
      socket.off('session:student_joined', load);
    };
  }, [sessionId, load, navigate]);

  function handleLeave() {
    localStorage.clear();
    navigate('/join');
  }

  if (!session) return <div className="min-h-screen bg-surface-900 flex items-center justify-center text-gray-400">Connecting…</div>;

  const ideas = session.ideas ?? [];

  return (
    <div className="min-h-screen bg-surface-900 p-4 max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between py-4 mb-6">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Joined as</p>
          <p className="font-semibold text-white">{studentName}</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-white">{session.name}</div>
          <div className="text-xs text-gray-500">{session.students?.length ?? 0} students</div>
        </div>
        <button onClick={handleLeave} className="btn-ghost text-xs text-gray-500">Leave</button>
      </header>

      {/* State indicator */}
      {session.state === 'setup' && (
        <div className="card mb-6 text-center py-8">
          <div className="text-4xl mb-3">⏳</div>
          <h2 className="font-semibold text-gray-200 mb-1">Waiting for the session to start</h2>
          <p className="text-gray-500 text-sm">Your facilitator will begin the presentations soon.</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 bg-brand-500 rounded-full pulse-ring"></span>
            Live — you'll be notified automatically
          </div>
        </div>
      )}

      {session.state === 'presenting' && currentIdea && (
        <div className="card mb-6 border-brand-500/40 bg-gradient-to-br from-brand-900/20 to-surface-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-brand-500 rounded-full pulse-ring"></span>
            <span className="text-xs font-medium text-brand-400 uppercase tracking-widest">Now Presenting</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{currentIdea.title}</h2>
          <p className="text-gray-400 mb-4">{currentIdea.description}</p>
          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            <span>🎤 {currentIdea.presenter_name}</span>
            {currentIdea.member_names.length > 0 && (
              <span>· Members: {currentIdea.member_names.join(', ')}</span>
            )}
            <span className="badge bg-surface-700 text-gray-400">{TYPE_LABELS[currentIdea.type]}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-surface-600 text-xs text-gray-500">
            Idea {(session.current_idea_index ?? 0) + 1} of {ideas.length}
          </div>
        </div>
      )}

      {/* All ideas */}
      <div>
        <h3 className="font-semibold text-gray-400 text-sm mb-3">All Exhibition Ideas ({ideas.length})</h3>
        <div className="space-y-2">
          {ideas.map((idea, idx) => {
            const isCurrent = session.state === 'presenting' && idx === (session.current_idea_index ?? 0);
            const isDone = session.state === 'presenting' && idx < (session.current_idea_index ?? 0);
            return (
              <div key={idea.id} className={`card transition-all ${isCurrent ? 'border-brand-500/40' : isDone ? 'opacity-40' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="text-gray-600 font-mono text-sm w-5 shrink-0 pt-0.5">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${isCurrent ? 'text-brand-300' : 'text-white'}`}>{idea.title}</span>
                      {isCurrent && <span className="text-xs text-brand-400">● Live</span>}
                      {isDone && <span className="text-xs text-gray-600">✓</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{idea.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-gray-600">
        Voting will open automatically when the presenter is ready.
      </div>
    </div>
  );
}
