import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function StudentJoin() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Auto-reconnect if token exists
  useEffect(() => {
    const token = localStorage.getItem('ev_student_token');
    if (!token) return;
    api.students.me()
      .then(({ student, session }) => {
        if (session.state !== 'results') {
          localStorage.setItem('ev_student_id', student.id);
          localStorage.setItem('ev_student_name', student.name);
          localStorage.setItem('ev_session_id', session.id);
          if (session.state === 'voting') navigate('/vote');
          else navigate('/lobby');
        }
      })
      .catch(() => localStorage.clear());
  }, [navigate]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { student, session } = await api.students.join(code.trim(), name.trim());
      localStorage.setItem('ev_student_token', student.token);
      localStorage.setItem('ev_student_id', student.id);
      localStorage.setItem('ev_student_name', student.name);
      localStorage.setItem('ev_session_id', session.id);
      if (session.state === 'voting') navigate('/vote');
      else navigate('/lobby');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not join session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🌍</div>
          <h1 className="text-3xl font-bold text-white mb-1">ExhibitVote</h1>
          <p className="text-gray-500 text-sm">Fair Exhibition Idea Voting</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-5 text-center">Join Your Session</h2>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="label">Session Code</label>
              <input
                className="input text-center text-xl tracking-[0.3em] uppercase font-mono font-bold"
                placeholder="ABC123"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            <div>
              <label className="label">Your Name</label>
              <input
                className="input"
                placeholder="How your classmates know you"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-800/50 text-red-400 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
            <button type="submit" disabled={loading || !code.trim() || !name.trim()} className="btn-primary w-full text-base py-3">
              {loading ? 'Joining…' : 'Join Session →'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/admin" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Admin? Manage sessions →
          </Link>
        </div>
      </div>
    </div>
  );
}
