import { Router, Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { IdeaRow, Idea, IdeaType } from '../types';
import { getIo } from '../socket';

const router = Router({ mergeParams: true });

function parseIdea(row: IdeaRow): Idea {
  return { ...row, member_names: JSON.parse(row.member_names) };
}

// List ideas for session
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM ideas WHERE session_id = ? ORDER BY order_index').all(req.params.sessionId) as IdeaRow[];
  res.json(rows.map(parseIdea));
});

// Add idea
router.post('/', (req: Request, res: Response) => {
  const { title, description, type, member_names, presenter_name } = req.body;
  if (!title?.trim() || !description?.trim() || !presenter_name?.trim()) {
    return res.status(400).json({ error: 'title, description, and presenter_name are required' });
  }

  const validTypes: IdeaType[] = ['solo', 'duo', 'group'];
  const ideaType: IdeaType = validTypes.includes(type) ? type : 'solo';
  const members: string[] = Array.isArray(member_names) ? member_names : [];

  const maxOrder = (db.prepare('SELECT MAX(order_index) as m FROM ideas WHERE session_id = ?').get(req.params.sessionId) as { m: number | null }).m ?? -1;

  const id = uuidv4();
  db.prepare(
    'INSERT INTO ideas (id, session_id, title, description, type, member_names, presenter_name, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.params.sessionId, title.trim(), description.trim(), ideaType, JSON.stringify(members), presenter_name.trim(), maxOrder + 1, Date.now());

  const idea = parseIdea(db.prepare('SELECT * FROM ideas WHERE id = ?').get(id) as IdeaRow);
  getIo().to(`session:${req.params.sessionId}`).emit('session:idea_added', idea);
  res.status(201).json(idea);
});

// Update idea
router.put('/:ideaId', (req: Request, res: Response) => {
  const { title, description, type, member_names, presenter_name } = req.body;
  const existing = db.prepare('SELECT * FROM ideas WHERE id = ? AND session_id = ?').get(req.params.ideaId, req.params.sessionId) as IdeaRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const validTypes: IdeaType[] = ['solo', 'duo', 'group'];
  const ideaType: IdeaType = validTypes.includes(type) ? type : existing.type;
  const members: string[] = Array.isArray(member_names) ? member_names : JSON.parse(existing.member_names);

  db.prepare(
    'UPDATE ideas SET title = ?, description = ?, type = ?, member_names = ?, presenter_name = ? WHERE id = ?'
  ).run(
    title?.trim() ?? existing.title,
    description?.trim() ?? existing.description,
    ideaType,
    JSON.stringify(members),
    presenter_name?.trim() ?? existing.presenter_name,
    req.params.ideaId
  );

  const idea = parseIdea(db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.ideaId) as IdeaRow);
  getIo().to(`session:${req.params.sessionId}`).emit('session:idea_updated', idea);
  res.json(idea);
});

// Reorder ideas
router.put('/reorder', (req: Request, res: Response) => {
  const { order } = req.body as { order: string[] };
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of idea IDs' });

  const updateStmt = db.prepare('UPDATE ideas SET order_index = ? WHERE id = ? AND session_id = ?');
  const updateAll = db.transaction(() => {
    order.forEach((id, idx) => updateStmt.run(idx, id, req.params.sessionId));
  });
  updateAll();

  const rows = db.prepare('SELECT * FROM ideas WHERE session_id = ? ORDER BY order_index').all(req.params.sessionId) as IdeaRow[];
  const ideas = rows.map(parseIdea);
  getIo().to(`session:${req.params.sessionId}`).emit('session:ideas_reordered', ideas);
  res.json(ideas);
});

// Delete idea
router.delete('/:ideaId', (req: Request, res: Response) => {
  db.prepare('DELETE FROM ideas WHERE id = ? AND session_id = ?').run(req.params.ideaId, req.params.sessionId);
  getIo().to(`session:${req.params.sessionId}`).emit('session:idea_deleted', { id: req.params.ideaId });
  res.json({ ok: true });
});

export default router;
