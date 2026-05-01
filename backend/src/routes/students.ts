import { Router, Request, Response } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { Session, Student } from '../types';
import { getIo } from '../socket';

const router = Router();

// Join a session by code
router.post('/join', (req: Request, res: Response) => {
  const { code, name } = req.body;
  if (!code?.trim() || !name?.trim()) {
    return res.status(400).json({ error: 'Session code and name are required' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE code = ?').get(code.trim().toUpperCase()) as Session | undefined;
  if (!session) return res.status(404).json({ error: 'Session not found. Check the code.' });
  if (session.state === 'results') return res.status(400).json({ error: 'This session has ended.' });

  // Check for duplicate name in session
  const existing = db.prepare('SELECT id FROM students WHERE session_id = ? AND LOWER(name) = LOWER(?)').get(session.id, name.trim()) as Student | undefined;
  if (existing) {
    // Return existing student token (rejoin)
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(existing.id) as Student;
    return res.json({ student, session });
  }

  const id = uuidv4();
  const token = uuidv4();
  db.prepare('INSERT INTO students (id, session_id, name, token, created_at) VALUES (?, ?, ?, ?, ?)').run(
    id, session.id, name.trim(), token, Date.now()
  );

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Student;
  getIo().to(`session:${session.id}`).emit('session:student_joined', { id, name: name.trim() });

  res.status(201).json({ student, session });
});

// Get student by token (for reconnect)
router.get('/me', (req: Request, res: Response) => {
  const token = req.headers['x-student-token'] as string;
  if (!token) return res.status(401).json({ error: 'No token' });

  const student = db.prepare('SELECT * FROM students WHERE token = ?').get(token) as Student | undefined;
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(student.session_id) as Session;
  res.json({ student, session });
});

export default router;
