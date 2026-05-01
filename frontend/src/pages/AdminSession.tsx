import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Session, Idea, IdeaType } from '../types';
import { joinSessionRoom, leaveSessionRoom, getSocket } from '../socket';

const TYPE_LABELS: Record<IdeaType, string> = { solo: 'Solo', duo: 'Duo', group: 'Group' };
const TYPE_COLORS: Record<IdeaType, string> = { solo: 'badge-blue', duo: 'badge-purple', group: 'badge-yellow' };

interface IdeaFormData {
  title: string;
  description: string;
  type: IdeaType;
  presenter_name: string;
  member_names_raw: string;
}

const emptyForm = (): IdeaFormData => ({
  title: '', description: '', type: 'solo', presenter_name: '', member_names_raw: '',
});

export default function AdminSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<IdeaFormData>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

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
    const refresh = () => load();
    socket.on('session:idea_added', refresh);
    socket.on('session:idea_updated', refresh);
    socket.on('session:idea_deleted', refresh);
    socket.on('session:ideas_reordered', refresh);
    socket.on('session:student_joined', refresh);
    socket.on('session:vote_cast', refresh);
    return () => {
      leaveSessionRoom(id!);
      socket.off('session:idea_added', refresh);
      socket.off('session:idea_updated', refresh);
      socket.off('session:idea_deleted', refresh);
      socket.off('session:ideas_reordered', refresh);
      socket.off('session:student_joined', refresh);
      socket.off('session:vote_cast', refresh);
    };
  }, [id, load]);

  async function handleSubmitIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSaving(true);
    const members = form.member_names_raw
      .split(',').map(s => s.trim()).filter(Boolean);
    try {
      if (editingId) {
        await api.ideas.update(id, editingId, {
          title: form.title, description: form.description,
          type: form.type, member_names: members, presenter_name: form.presenter_name,
        });
      } else {
        await api.ideas.create(id, {
          title: form.title, description: form.description,
          type: form.type, member_names: members, presenter_name: form.presenter_name,
        });
      }
      setForm(emptyForm());
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  }

  function startEdit(idea: Idea) {
    setForm({
      title: idea.title, description: idea.description, type: idea.type,
      presenter_name: idea.presenter_name,
      member_names_raw: idea.member_names.join(', '),
    });
    setEditingId(idea.id);
    setShowForm(true);
  }

  async function handleDelete(ideaId: string) {
    if (!id || !confirm('Remove this idea?')) return;
    await api.ideas.delete(id, ideaId);
    load();
  }

  async function handleStateChange(state: string) {
    if (!id) return;
    await api.sessions.setState(id, state);
    load();
    if (state === 'presenting') navigate(`/admin/session/${id}/present`);
    if (state === 'results') navigate(`/admin/session/${id}/results`);
  }

  // Simple drag-to-reorder
  const ideas = session?.ideas ?? [];
  async function handleDrop(targetId: string) {
    if (!id || !dragging || dragging === targetId) return;
    const newOrder = [...ideas.map(i => i.id)];
    const fromIdx = newOrder.indexOf(dragging);
    const toIdx = newOrder.indexOf(targetId);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragging);
    await api.ideas.reorder(id, newOrder);
    load();
    setDragging(null);
  }

  if (loading) return <div className="min-h-screen bg-surface-900 flex items-center justify-center text-gray-400">Loading…</div>;
  if (!session) return null;

  const stateFlow = ['setup', 'presenting', 'voting', 'results'];
  const currentIdx = stateFlow.indexOf(session.state);

  return (
    <div className="min-h-screen bg-surface-900 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link to="/admin" className="text-xs text-gray-500 hover:text-gray-300 mb-2 inline-block">← Dashboard</Link>
          <h1 className="text-2xl font-bold text-white">{session.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
            <span>
              Join code: <span className="font-mono text-brand-400 bg-surface-700 px-2 py-0.5 rounded text-base font-bold">{session.code}</span>
            </span>
            <span>·</span>
            <span>{session.students?.length ?? 0} students</span>
            <span>·</span>
            <span>{session.voteCount ?? 0} votes cast</span>
          </div>
        </div>

        {/* State controls */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          {/* Clickable stage stepper — click any stage to jump there */}
          <div className="flex items-center gap-1">
            {stateFlow.map((s, i) => {
              const isCurrent = i === currentIdx;
              const isPast = i < currentIdx;
              const label = s.charAt(0).toUpperCase() + s.slice(1);
              const disabled = s === 'setup' && ideas.length === 0 && session.state !== 'setup';
              return (
                <span key={s} className="flex items-center gap-1">
                  <button
                    onClick={() => !isCurrent && !disabled && handleStateChange(s)}
                    disabled={isCurrent || disabled}
                    title={isCurrent ? 'Current stage' : `Switch to ${label}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                      ${isCurrent
                        ? 'bg-brand-500 text-surface-900 border-brand-500 cursor-default'
                        : isPast
                        ? 'border-brand-800 text-brand-600 hover:bg-brand-900/40 hover:text-brand-400 cursor-pointer'
                        : 'border-surface-500 text-gray-500 hover:border-gray-400 hover:text-gray-300 cursor-pointer'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {isPast && !isCurrent ? '↩ ' : ''}{label}
                  </button>
                  {i < stateFlow.length - 1 && <span className="text-gray-700 text-xs">›</span>}
                </span>
              );
            })}
          </div>

          {/* Contextual action buttons */}
          <div className="flex gap-2">
            {session.state === 'presenting' && (
              <Link to={`/admin/session/${id}/present`} className="btn-secondary text-xs">
                🎬 Presentation Mode
              </Link>
            )}
            {session.state === 'results' && (
              <Link to={`/admin/session/${id}/results`} className="btn-primary text-xs">
                View Results →
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6">
        {/* Ideas List */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-200">
              Exhibition Ideas <span className="text-gray-500 font-normal">({ideas.length})</span>
            </h2>
            {session.state === 'setup' && (
              <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }} className="btn-primary text-xs">
                + Add Idea
              </button>
            )}
          </div>

          {ideas.length === 0 ? (
            <div className="card text-center py-12 text-gray-600">
              <div className="text-4xl mb-3">💡</div>
              <p className="text-gray-500">No ideas yet. Add the first one!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ideas.map((idea, idx) => (
                <div
                  key={idea.id}
                  draggable={session.state === 'setup'}
                  onDragStart={() => setDragging(idea.id)}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={() => handleDrop(idea.id)}
                  className={`card flex items-start gap-3 cursor-default transition-all ${dragging === idea.id ? 'opacity-40' : ''} ${session.state === 'setup' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="text-gray-600 font-mono text-sm w-6 shrink-0 pt-0.5 text-center">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-white">{idea.title}</span>
                      <span className={TYPE_COLORS[idea.type]}>{TYPE_LABELS[idea.type]}</span>
                      {idea.member_names.length > 0 && (
                        <span className="text-xs text-gray-500">{idea.member_names.length + 1} members</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-2 mb-1">{idea.description}</p>
                    <p className="text-xs text-gray-500">Presenter: <span className="text-gray-300">{idea.presenter_name}</span></p>
                  </div>
                  {session.state === 'setup' && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(idea)} className="btn-ghost text-xs py-1 px-2">Edit</button>
                      <button onClick={() => handleDelete(idea.id)} className="btn-ghost text-red-400 hover:text-red-300 text-xs py-1 px-2">✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {session.state === 'setup' && ideas.length > 1 && (
            <p className="text-xs text-gray-600 mt-2 text-center">Drag to reorder presentation sequence</p>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Students */}
          <div className="card">
            <h3 className="font-semibold text-gray-300 mb-3 text-sm">Students Joined</h3>
            {(session.students?.length ?? 0) === 0 ? (
              <p className="text-xs text-gray-600">No one yet — share code <span className="text-brand-400 font-mono font-bold">{session.code}</span></p>
            ) : (
              <ul className="space-y-1">
                {session.students!.map(s => (
                  <li key={s.id} className="text-sm text-gray-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></span>
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Voting progress */}
          {session.state === 'voting' && (
            <div className="card">
              <h3 className="font-semibold text-gray-300 mb-3 text-sm">Voting Progress</h3>
              <div className="text-3xl font-bold text-white text-center mb-1">
                {session.voteCount} <span className="text-gray-500 text-lg font-normal">/ {session.students?.length ?? 0}</span>
              </div>
              <div className="w-full bg-surface-600 rounded-full h-2 mt-2">
                <div
                  className="bg-brand-500 h-2 rounded-full transition-all"
                  style={{ width: `${session.students?.length ? (session.voteCount! / session.students.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">students have voted</p>
            </div>
          )}

          {/* Scoring rubric reminder */}
          <div className="card">
            <h3 className="font-semibold text-gray-300 mb-3 text-sm">Voting Rubric</h3>
            <div className="space-y-2 text-xs text-gray-400">
              <div className="flex gap-2">
                <span className="text-yellow-400">🥇</span>
                <div><span className="text-yellow-300 font-medium">Gold (3 pts)</span> — Most feasible + exciting</div>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-300">🥈</span>
                <div><span className="text-gray-200 font-medium">Silver (2 pts)</span> — Most conceptually rigorous</div>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-600">🥉</span>
                <div><span className="text-amber-500 font-medium">Bronze (1 pt)</span> — Wildcard / most experimental</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-surface-600 text-xs text-gray-500">
              Weights: Solo ×1.0 · Duo ×1.2 · Group ×1.5
            </div>
          </div>
        </div>
      </div>

      {/* Idea Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 w-full max-w-lg animate-fade-in-up">
            <h3 className="font-bold text-lg mb-5">{editingId ? 'Edit Idea' : 'Add Exhibition Idea'}</h3>
            <form onSubmit={handleSubmitIdea} className="space-y-4">
              <div>
                <label className="label">Idea Title *</label>
                <input className="input" placeholder="e.g. Breathing City: Urban Air Visualizer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Description *</label>
                <textarea className="input" rows={3} placeholder="Describe the exhibition concept, how it works, and audience interaction…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Project Type *</label>
                  <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as IdeaType }))}>
                    <option value="solo">Solo</option>
                    <option value="duo">Duo (2 people)</option>
                    <option value="group">Group (3–4 people)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Presenting Speaker *</label>
                  <input className="input" placeholder="Who pitches?" value={form.presenter_name} onChange={e => setForm(f => ({ ...f, presenter_name: e.target.value }))} required />
                </div>
              </div>
              {form.type !== 'solo' && (
                <div>
                  <label className="label">Other Members (comma-separated)</label>
                  <input className="input" placeholder="Alex, Jordan, Sam" value={form.member_names_raw} onChange={e => setForm(f => ({ ...f, member_names_raw: e.target.value }))} />
                </div>
              )}
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Idea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
