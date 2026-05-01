import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { ResultsSummary, IdeaResult } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';

const WEIGHT_LABEL: Record<number, string> = {
  1: 'Solo ×1.0',
  1.2: 'Duo ×1.2',
  1.5: 'Group ×1.5',
};

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

function ScoreBar({ result, max }: { result: IdeaResult; max: number }) {
  const pct = max > 0 ? (result.weightedScore / max) * 100 : 0;
  return (
    <div className="w-full bg-surface-700 rounded-full h-2">
      <div className="h-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdminResults() {
  const { id } = useParams<{ id: string }>();
  const [results, setResults] = useState<ResultsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'ranked' | 'raw'>('overview');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await api.results.get(id);
      setResults(r);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="min-h-screen bg-surface-900 flex items-center justify-center text-gray-400">Calculating results…</div>;
  if (!results) return null;

  const maxScore = Math.max(...results.ideas.map(i => i.weightedScore), 0.01);

  const chartData = results.ideas.slice(0, 8).map(idea => ({
    name: idea.title.length > 20 ? idea.title.slice(0, 18) + '…' : idea.title,
    'Weighted Score': parseFloat(idea.weightedScore.toFixed(2)),
    'Raw Score': idea.rawScore,
  }));

  return (
    <div className="min-h-screen bg-surface-900 p-6 max-w-5xl mx-auto">
      <header className="mb-8">
        <Link to={`/admin/session/${id}`} className="text-xs text-gray-500 hover:text-gray-300 mb-3 inline-block">← Back to Session</Link>
        <h1 className="text-2xl font-bold text-white mb-1">Voting Results</h1>
        <p className="text-gray-400 text-sm">{results.totalVoters} student{results.totalVoters !== 1 ? 's' : ''} voted · {results.ideas.length} ideas evaluated</p>
        {results.tiebreakApplied && (
          <div className="mt-2 inline-flex items-center gap-2 text-xs bg-yellow-900/30 border border-yellow-700/40 text-yellow-400 px-3 py-1.5 rounded-lg">
            ⚖️ Tie-breaker applied — solo project given priority per the rules
          </div>
        )}
      </header>

      {/* Winner */}
      {results.winner && (
        <div className="card mb-8 border-brand-500/40 bg-gradient-to-br from-brand-900/30 to-surface-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 text-8xl opacity-10 pointer-events-none select-none">🏆</div>
          <div className="relative">
            <div className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-2">🏆 Winner — Ranked Choice</div>
            <h2 className="text-3xl font-bold text-white mb-2">{results.winner.title}</h2>
            <p className="text-gray-400 mb-3">Presented by {results.winner.presenterName}</p>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="bg-surface-700 px-3 py-1 rounded-full text-gray-300">
                Weighted Score: <strong className="text-brand-400">{results.winner.weightedScore.toFixed(2)}</strong>
              </span>
              <span className="bg-surface-700 px-3 py-1 rounded-full text-gray-300">
                Gold votes: <strong className="text-yellow-400">{results.winner.goldVotes}</strong>
              </span>
              <span className="bg-surface-700 px-3 py-1 rounded-full text-gray-300">
                {WEIGHT_LABEL[results.winner.weightMultiplier] ?? `×${results.winner.weightMultiplier}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-800 p-1 rounded-lg w-fit border border-surface-600">
        {(['overview', 'ranked', 'raw'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? 'bg-brand-500 text-surface-900' : 'text-gray-400 hover:text-white'}`}>
            {t === 'overview' ? 'Score Overview' : t === 'ranked' ? 'Ranked Choice Rounds' : 'Raw Data'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Bar chart */}
          <div className="card">
            <h3 className="font-semibold text-gray-300 mb-4">Weighted Scores</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#182419', border: '1px solid #243526', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                <Bar dataKey="Weighted Score" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#22c55e' : i === 1 ? '#16a34a' : '#166534'} />
                  ))}
                </Bar>
                <Bar dataKey="Raw Score" fill="#374151" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leaderboard */}
          <div className="space-y-3">
            {results.ideas.map((idea, idx) => (
              <div key={idea.id} className={`card flex items-center gap-4 ${idx === 0 ? 'border-brand-500/50' : ''}`}>
                <div className="text-2xl w-8 text-center">{MEDAL[idx] ?? `#${idx + 1}`}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-white">{idea.title}</span>
                    <span className="text-xs text-gray-500">{WEIGHT_LABEL[idea.weightMultiplier] ?? `×${idea.weightMultiplier}`}</span>
                  </div>
                  <ScoreBar result={idea} max={maxScore} />
                  <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                    <span className="text-yellow-400">🥇 {idea.goldVotes}</span>
                    <span className="text-gray-300">🥈 {idea.silverVotes}</span>
                    <span className="text-amber-600">🥉 {idea.bronzeVotes}</span>
                    <span>Raw: {idea.rawScore}</span>
                    <span className="text-brand-400 font-medium">Weighted: {idea.weightedScore.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ranked' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Ranked choice uses Gold votes as 1st-choice preferences. If no idea has a majority, the weakest is eliminated and votes redistribute to each voter's next preference.
          </p>
          {results.rankedChoiceRounds.map(round => {
            const total = Object.values(round.counts).reduce((a, b) => a + b, 0);
            return (
              <div key={round.round} className="card">
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-semibold text-white">Round {round.round}</span>
                  {round.winner && <span className="badge-green">🏆 Winner determined</span>}
                  {round.eliminated && <span className="badge-gray text-xs">Eliminated: {results.ideas.find(i => i.id === round.eliminated)?.title ?? round.eliminated}</span>}
                </div>
                <div className="space-y-2">
                  {Object.entries(round.counts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([ideaId, count]) => {
                      const idea = results.ideas.find(i => i.id === ideaId);
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={ideaId}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className={`${round.winner === ideaId ? 'text-brand-400 font-semibold' : round.eliminated === ideaId ? 'text-red-400 line-through opacity-50' : 'text-gray-300'}`}>
                              {idea?.title ?? ideaId}
                            </span>
                            <span className="text-gray-400 text-xs">{count.toFixed(2)} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-surface-700 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${round.winner === ideaId ? 'bg-brand-500' : round.eliminated === ideaId ? 'bg-red-700' : 'bg-surface-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
          {results.rankedChoiceRounds.length === 0 && (
            <p className="text-gray-500 text-sm">No votes recorded yet.</p>
          )}
        </div>
      )}

      {tab === 'raw' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-surface-600">
                <th className="pb-3 pr-4">Idea</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4 text-yellow-400">Gold</th>
                <th className="pb-3 pr-4 text-gray-300">Silver</th>
                <th className="pb-3 pr-4 text-amber-600">Bronze</th>
                <th className="pb-3 pr-4">Raw</th>
                <th className="pb-3 pr-4">Weight</th>
                <th className="pb-3 text-brand-400">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {results.ideas.map((idea, i) => (
                <tr key={idea.id} className={`border-b border-surface-700 ${i === 0 ? 'text-brand-300' : 'text-gray-300'}`}>
                  <td className="py-2.5 pr-4 font-medium">{idea.title}</td>
                  <td className="py-2.5 pr-4 text-gray-500 capitalize">{idea.type}</td>
                  <td className="py-2.5 pr-4 text-yellow-400">{idea.goldVotes}</td>
                  <td className="py-2.5 pr-4">{idea.silverVotes}</td>
                  <td className="py-2.5 pr-4 text-amber-600">{idea.bronzeVotes}</td>
                  <td className="py-2.5 pr-4">{idea.rawScore}</td>
                  <td className="py-2.5 pr-4 text-gray-500">×{idea.weightMultiplier}</td>
                  <td className="py-2.5 font-bold text-brand-400">{idea.weightedScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
