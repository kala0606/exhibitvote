import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Session } from '../types';

const STATE_LABELS: Record<string, { label: string; cls: string }> = {
  setup: { label: 'Setup', cls: 'badge-gray' },
  presenting: { label: 'Presenting', cls: 'badge-yellow' },
  voting: { label: 'Voting Open', cls: 'badge-green' },
  results: { label: 'Concluded', cls: 'badge-blue' },
};

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.sessions.list().then(setSessions).catch(console.error);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const s = await api.sessions.create(name.trim());
      navigate(`/admin/session/${s.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this session and all its data?')) return;
    await api.sessions.delete(id);
    setSessions(s => s.filter(x => x.id !== id));
  }

  return (
    <div className="min-h-screen bg-surface-900 p-6 max-w-4xl mx-auto">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🌍</span>
            <h1 className="text-2xl font-bold text-white">ExhibitVote</h1>
          </div>
          <p className="text-gray-400 text-sm">Admin Dashboard — manage exhibition voting sessions</p>
        </div>
        <Link to="/join" className="btn-ghost text-xs">
          ↗ Student View
        </Link>
      </header>

      {/* Create Session */}
      <div className="card mb-8">
        <h2 className="text-base font-semibold mb-4">New Session</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Session name, e.g. EarthAlive Off-site 2026"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button className="btn-primary whitespace-nowrap" type="submit" disabled={creating || !name.trim()}>
            {creating ? 'Creating…' : '+ Create Session'}
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      {/* Session List */}
      <div>
        <h2 className="text-base font-semibold text-gray-300 mb-4">
          {sessions.length === 0 ? 'No sessions yet' : `${sessions.length} Session${sessions.length > 1 ? 's' : ''}`}
        </h2>
        <div className="space-y-3">
          {sessions.map(s => {
            const st = STATE_LABELS[s.state] ?? STATE_LABELS.setup;
            return (
              <div key={s.id} className="card flex items-center justify-between gap-4 hover:border-brand-500/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white truncate">{s.name}</span>
                    <span className={st.cls}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="font-mono bg-surface-700 px-2 py-0.5 rounded text-brand-400">
                      Code: {s.code}
                    </span>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/admin/session/${s.id}`} className="btn-secondary text-xs">
                    Manage
                  </Link>
                  <button onClick={() => handleDelete(s.id)} className="btn-ghost text-red-400 hover:text-red-300 text-xs">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <div className="text-5xl mb-4">🗳️</div>
          <p className="text-lg font-medium text-gray-500">No sessions yet</p>
          <p className="text-sm mt-1">Create one above to get started.</p>
        </div>
      )}
    </div>
  );
}
