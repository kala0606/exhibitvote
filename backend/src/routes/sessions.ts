import { Router, Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { Session, IdeaRow, Idea } from '../types';
import { getIo } from '../socket';

const router = Router();

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function parseIdea(row: IdeaRow): Idea {
  return { ...row, member_names: JSON.parse(row.member_names) };
}

// List all sessions (admin)
router.get('/', (_req: Request, res: Response) => {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all() as Session[];
  res.json(sessions);
});

// Create session
router.post('/', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const id = uuidv4();
  let code = generateCode();
  // Ensure unique code
  while (db.prepare('SELECT id FROM sessions WHERE code = ?').get(code)) {
    code = generateCode();
  }

  db.prepare(
    'INSERT INTO sessions (id, name, code, state, current_idea_index, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name.trim(), code, 'setup', 0, Date.now());

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session;
  res.status(201).json(session);
});

// Get session by ID
router.get('/:id', (req: Request, res: Response) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as Session | undefined;
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const ideas = (db.prepare('SELECT * FROM ideas WHERE session_id = ? ORDER BY order_index').all(req.params.id) as IdeaRow[]).map(parseIdea);
  const students = db.prepare('SELECT id, name, session_id, created_at FROM students WHERE session_id = ?').all(req.params.id);
  const voteCount = (db.prepare('SELECT COUNT(*) as count FROM votes WHERE session_id = ?').get(req.params.id) as { count: number }).count;

  res.json({ ...session, ideas, students, voteCount });
});

// Update session state
router.put('/:id/state', (req: Request, res: Response) => {
  const { state } = req.body;
  const validStates = ['setup', 'presenting', 'voting', 'results'];
  if (!validStates.includes(state)) return res.status(400).json({ error: 'Invalid state' });

  db.prepare('UPDATE sessions SET state = ? WHERE id = ?').run(state, req.params.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as Session | undefined;
  if (!session) return res.status(404).json({ error: 'Session not found' });

  getIo().to(`session:${req.params.id}`).emit('session:state', { state });
  res.json(session);
});

// Advance presentation index
router.put('/:id/advance', (req: Request, res: Response) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as Session | undefined;
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const ideaCount = (db.prepare('SELECT COUNT(*) as count FROM ideas WHERE session_id = ?').get(req.params.id) as { count: number }).count;
  const next = Math.min(session.current_idea_index + 1, ideaCount - 1);
  db.prepare('UPDATE sessions SET current_idea_index = ? WHERE id = ?').run(next, req.params.id);

  getIo().to(`session:${req.params.id}`).emit('session:advance', { current_idea_index: next });
  res.json({ current_idea_index: next });
});

// Delete session
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
