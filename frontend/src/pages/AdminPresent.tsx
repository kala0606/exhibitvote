import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Session, Idea, IdeaType } from '../types';
import { joinSessionRoom, leaveSessionRoom, getSocket } from '../socket';

const TYPE_LABELS: Record<IdeaType, string> = { solo: 'Solo', duo: 'Duo', group: 'Group' };

const PITCH_DURATION = 3 * 60;  // 3 minutes
const QA_DURATION = 2 * 60;     // 2 minutes

type TimerPhase = 'pitch' | 'qa' | 'done';

export default function AdminPresent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [seconds, setSeconds] = useState(PITCH_DURATION);
  const [phase, setPhase] = useState<TimerPhase>('pitch');
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const s = await api.sessions.get(id);
      setSession(s);
    } catch { navigate('/admin'); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => {
    load();
    if (!id) return;
    joinSessionRoom(id);
    const socket = getSocket();
    socket.on('session:advance', load);
    socket.on('session:state', load);
    return () => {
      leaveSessionRoom(id!);
      socket.off('session:advance', load);
      socket.off('session:state', load);
    };
  }, [id, load]);

  // Timer
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            if (phase === 'pitch') {
              setPhase('qa');
              return QA_DURATION;
            } else {
              setRunning(false);
              setPhase('done');
              clearInterval(intervalRef.current!);
              return 0;
            }
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase]);

  function resetTimer() {
    setRunning(false);
    setPhase('pitch');
    setSeconds(PITCH_DURATION);
  }

  async function handleAdvance() {
    if (!id || !session) return;
    const ideas = session.ideas ?? [];
    if ((session.current_idea_index ?? 0) >= ideas.length - 1) return;
    await api.sessions.advance(id);
    resetTimer();
    load();
  }

  async function handleOpenVoting() {
    if (!id) return;
    await api.sessions.setState(id, 'voting');
    navigate(`/admin/session/${id}`);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  if (loading) return <div className="min-h-screen bg-surface-900 flex items-center justify-center text-gray-400">Loading…</div>;
  if (!session) return null;

  const ideas: Idea[] = session.ideas ?? [];
  const currentIdx = session.current_idea_index ?? 0;
  const currentIdea: Idea | undefined = ideas[currentIdx];
  const isLast = currentIdx >= ideas.length - 1;

  const phaseColor = phase === 'pitch' ? 'text-brand-400' : phase === 'qa' ? 'text-yellow-400' : 'text-gray-500';
  const progressPct = phase === 'pitch' ? (seconds / PITCH_DURATION) * 100 : phase === 'qa' ? (seconds / QA_DURATION) * 100 : 0;
  const timerDanger = seconds <= 30 && phase !== 'done';

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col">
      {/* Top bar */}
      <div className="bg-surface-800 border-b border-surface-600 px-6 py-3 flex items-center justify-between">
        <Link to={`/admin/session/${id}`} className="text-xs text-gray-500 hover:text-gray-300">← Back to Session</Link>
        <div className="text-sm font-medium text-gray-300">{session.name}</div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{currentIdx + 1} / {ideas.length} ideas</span>
          {!isLast && (
            <button onClick={() => { handleAdvance(); }} className="btn-secondary text-xs">
              Skip ⏭
            </button>
          )}
          <button onClick={handleOpenVoting} className="btn-primary text-xs">
            Open Voting →
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main stage */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
          {currentIdea ? (
            <>
              {/* Current idea */}
              <div className="text-center max-w-2xl animate-fade-in-up">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className={`badge ${currentIdea.type === 'solo' ? 'badge-blue' : currentIdea.type === 'duo' ? 'badge-purple' : 'badge-yellow'} text-sm px-3 py-1`}>
                    {TYPE_LABELS[currentIdea.type]}
                  </span>
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">{currentIdea.title}</h2>
                <p className="text-gray-400 text-lg mb-6">{currentIdea.description}</p>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                  <span>🎤 Presenter: <span className="text-white">{currentIdea.presenter_name}</span></span>
                  {currentIdea.member_names.length > 0 && (
                    <span>· Members: <span className="text-gray-300">{currentIdea.member_names.join(', ')}</span></span>
                  )}
                </div>
              </div>

              {/* Timer */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-48 h-48">
                  <svg className="w-48 h-48 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="#1e2e20" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="54" fill="none"
                      stroke={timerDanger ? '#ef4444' : phase === 'qa' ? '#eab308' : '#22c55e'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 54}`}
                      strokeDashoffset={`${2 * Math.PI * 54 * (1 - progressPct / 100)}`}
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className={`text-4xl font-mono font-bold ${timerDanger ? 'text-red-400' : phaseColor}`}>
                      {fmt(seconds)}
                    </div>
                    <div className={`text-xs font-medium mt-1 ${phaseColor}`}>
                      {phase === 'pitch' ? 'PITCH' : phase === 'qa' ? 'Q&A' : 'DONE'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap justify-center">
                  {!running && phase !== 'done' && (
                    <button onClick={() => setRunning(true)} className="btn-primary px-6">
                      {seconds < (phase === 'pitch' ? PITCH_DURATION : QA_DURATION) ? '▶ Resume' : '▶ Start'}
                    </button>
                  )}
                  {running && (
                    <button onClick={() => setRunning(false)} className="btn-secondary px-6">⏸ Pause</button>
                  )}
                  <button onClick={resetTimer} className="btn-ghost">↺ Reset</button>
                  {!isLast && (
                    <button
                      onClick={() => { resetTimer(); handleAdvance(); }}
                      className="btn-ghost text-gray-400 hover:text-white"
                      title="Skip to next idea"
                    >
                      Skip ⏭
                    </button>
                  )}
                </div>

                {phase === 'done' && (
                  <div className="text-center">
                    <p className="text-brand-400 font-semibold mb-3">Time's up! Great presentation 👏</p>
                    {!isLast ? (
                      <button onClick={() => { resetTimer(); handleAdvance(); }} className="btn-primary">Next Idea →</button>
                    ) : (
                      <button onClick={handleOpenVoting} className="btn-primary">All Done — Open Voting →</button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-gray-500 text-center">
              <p className="text-xl">No ideas to present</p>
            </div>
          )}
        </div>

        {/* Queue sidebar */}
        <div className="w-72 bg-surface-800 border-l border-surface-600 overflow-y-auto p-4">
          <h3 className="font-semibold text-gray-300 text-sm mb-4">Presentation Queue</h3>
          <div className="space-y-2">
            {ideas.map((idea, idx) => (
              <div key={idea.id} className={`p-3 rounded-lg border transition-all ${idx === currentIdx ? 'border-brand-500/60 bg-brand-900/20' : idx < currentIdx ? 'border-surface-500 opacity-40' : 'border-surface-600'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-600 w-4">{idx + 1}</span>
                  {idx === currentIdx && <span className="text-brand-400 text-xs">● Now</span>}
                  {idx < currentIdx && <span className="text-gray-600 text-xs">✓ Done</span>}
                </div>
                <div className="text-sm font-medium text-white line-clamp-1">{idea.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{idea.presenter_name}</div>
              </div>
            ))}
          </div>

          {!isLast && phase === 'done' && (
            <button onClick={handleAdvance} className="btn-primary w-full mt-4 text-sm">
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
