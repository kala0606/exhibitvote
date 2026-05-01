import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { initDb } from './db';
import { initSocket } from './socket';
import sessionsRouter from './routes/sessions';
import studentsRouter from './routes/students';
import ideasRouter from './routes/ideas';
import votesRouter from './routes/votes';
import resultsRouter from './routes/results';

const app = express();
const httpServer = createServer(app);
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: '*' }));
app.use(express.json());

initDb();
initSocket(httpServer);

app.use('/api/sessions', sessionsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/sessions/:sessionId/ideas', ideasRouter);
app.use('/api/sessions/:sessionId/votes', votesRouter);
app.use('/api/sessions/:sessionId/results', resultsRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// In production serve the built React app and handle SPA routing
if (isProd) {
  const staticDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(staticDir));
  app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
}

const PORT = process.env.PORT ?? 4001;
httpServer.listen(PORT, () => {
  console.log(`ExhibitVote backend running on http://localhost:${PORT} [${isProd ? 'production' : 'dev'}]`);
});
