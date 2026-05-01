import { Session, Idea, IdeaType, ResultsSummary, Student } from './types';

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('ev_student_token');
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  withToken = false
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withToken) {
    const token = getToken();
    if (token) headers['x-student-token'] = token;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

// Sessions
export const api = {
  sessions: {
    list: () => req<Session[]>('GET', '/sessions'),
    create: (name: string) => req<Session>('POST', '/sessions', { name }),
    get: (id: string) => req<Session>('GET', `/sessions/${id}`),
    setState: (id: string, state: string) => req<Session>('PUT', `/sessions/${id}/state`, { state }),
    advance: (id: string) => req<{ current_idea_index: number }>('PUT', `/sessions/${id}/advance`, {}),
    delete: (id: string) => req<{ ok: boolean }>('DELETE', `/sessions/${id}`),
  },
  students: {
    join: (code: string, name: string) =>
      req<{ student: Student; session: Session }>('POST', '/students/join', { code, name }),
    me: () => req<{ student: Student; session: Session }>('GET', '/students/me', undefined, true),
  },
  ideas: {
    list: (sessionId: string) => req<Idea[]>('GET', `/sessions/${sessionId}/ideas`),
    create: (sessionId: string, data: {
      title: string; description: string; type: IdeaType;
      member_names: string[]; presenter_name: string;
    }) => req<Idea>('POST', `/sessions/${sessionId}/ideas`, data),
    update: (sessionId: string, ideaId: string, data: Partial<Idea>) =>
      req<Idea>('PUT', `/sessions/${sessionId}/ideas/${ideaId}`, data),
    reorder: (sessionId: string, order: string[]) =>
      req<Idea[]>('PUT', `/sessions/${sessionId}/ideas/reorder`, { order }),
    delete: (sessionId: string, ideaId: string) =>
      req<{ ok: boolean }>('DELETE', `/sessions/${sessionId}/ideas/${ideaId}`),
  },
  votes: {
    submit: (sessionId: string, gold: string, silver: string, bronze: string) =>
      req<{ ok: boolean; voteCount: number; studentCount: number }>(
        'POST', `/sessions/${sessionId}/votes`,
        { gold_idea_id: gold, silver_idea_id: silver, bronze_idea_id: bronze },
        true
      ),
    status: (sessionId: string) =>
      req<{ hasVoted: boolean; vote: unknown }>('GET', `/sessions/${sessionId}/votes/status`, undefined, true),
  },
  results: {
    get: (sessionId: string) => req<ResultsSummary>('GET', `/sessions/${sessionId}/results`),
  },
};
