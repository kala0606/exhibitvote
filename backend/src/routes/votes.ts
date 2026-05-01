import { Router, Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { Session, Student, IdeaRow, Vote } from '../types';
import { getIo } from '../socket';

const router = Router({ mergeParams: true });

// Submit votes
router.post('/', (req: Request, res: Response) => {
  const token = req.headers['x-student-token'] as string;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const student = db.prepare('SELECT * FROM students WHERE token = ?').get(token) as Student | undefined;
  if (!student || student.session_id !== req.params.sessionId) {
    return res.status(403).json({ error: 'Not authorized for this session' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.sessionId) as Session | undefined;
  if (!session || session.state !== 'voting') {
    return res.status(400).json({ error: 'Voting is not open' });
  }

  const { gold_idea_id, silver_idea_id, bronze_idea_id } = req.body;
  if (!gold_idea_id || !silver_idea_id || !bronze_idea_id) {
    return res.status(400).json({ error: 'All three votes (gold, silver, bronze) are required' });
  }

  const ideaIds = new Set([gold_idea_id, silver_idea_id, bronze_idea_id]);
  if (ideaIds.size !== 3) {
    return res.status(400).json({ error: 'All three votes must be for different ideas' });
  }

  // Validate ideas exist in this session
  for (const ideaId of ideaIds) {
    const idea = db.prepare('SELECT * FROM ideas WHERE id = ? AND session_id = ?').get(ideaId, req.params.sessionId) as IdeaRow | undefined;
    if (!idea) return res.status(400).json({ error: `Idea ${ideaId} not found in this session` });

    // Enforce fairness: can't vote for own idea
    const members: string[] = JSON.parse(idea.member_names);
    const presenterIsVoter = idea.presenter_name.toLowerCase() === student.name.toLowerCase();
    const memberIsVoter = members.some(m => m.toLowerCase() === student.name.toLowerCase());
    if (presenterIsVoter || memberIsVoter) {
      return res.status(400).json({ error: `You cannot vote for your own idea: "${idea.title}"` });
    }
  }

  // Upsert vote (allow changing before session ends)
  const existing = db.prepare('SELECT id FROM votes WHERE session_id = ? AND voter_id = ?').get(req.params.sessionId, student.id) as Vote | undefined;

  if (existing) {
    db.prepare(
      'UPDATE votes SET gold_idea_id = ?, silver_idea_id = ?, bronze_idea_id = ?, created_at = ? WHERE id = ?'
    ).run(gold_idea_id, silver_idea_id, bronze_idea_id, Date.now(), existing.id);
  } else {
    db.prepare(
      'INSERT INTO votes (id, session_id, voter_id, gold_idea_id, silver_idea_id, bronze_idea_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), req.params.sessionId, student.id, gold_idea_id, silver_idea_id, bronze_idea_id, Date.now());
  }

  const voteCount = (db.prepare('SELECT COUNT(*) as count FROM votes WHERE session_id = ?').get(req.params.sessionId) as { count: number }).count;
  const studentCount = (db.prepare('SELECT COUNT(*) as count FROM students WHERE session_id = ?').get(req.params.sessionId) as { count: number }).count;

  getIo().to(`session:${req.params.sessionId}`).emit('session:vote_cast', {
    voteCount,
    studentCount,
    voterId: student.id,
  });

  res.json({ ok: true, voteCount, studentCount });
});

// Check if current student has voted
router.get('/status', (req: Request, res: Response) => {
  const token = req.headers['x-student-token'] as string;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const student = db.prepare('SELECT * FROM students WHERE token = ?').get(token) as Student | undefined;
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const vote = db.prepare('SELECT * FROM votes WHERE session_id = ? AND voter_id = ?').get(req.params.sessionId, student.id) as Vote | undefined;
  res.json({ hasVoted: !!vote, vote: vote ?? null });
});

export default router;
