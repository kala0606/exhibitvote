import { Router, Request, Response } from 'express';
import { db } from '../db';
import { IdeaRow, Idea, Vote } from '../types';
import { calculateResults } from '../services/votingAlgorithm';

const router = Router({ mergeParams: true });

function parseIdea(row: IdeaRow): Idea {
  return { ...row, member_names: JSON.parse(row.member_names) };
}

router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM ideas WHERE session_id = ? ORDER BY order_index').all(req.params.sessionId) as IdeaRow[];
  const ideas = rows.map(parseIdea);
  const votes = db.prepare('SELECT * FROM votes WHERE session_id = ?').all(req.params.sessionId) as Vote[];

  const results = calculateResults(ideas, votes);
  res.json(results);
});

export default router;
