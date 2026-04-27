const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('ss_token');
}

async function request(method: string, path: string, body?: unknown) {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Cannot connect to server. Please make sure the backend is running.');
  }

  // Safely parse JSON — an empty body causes "Unexpected end of JSON input"
  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned invalid response (status ${res.status}). Is the backend running?`);
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data;
}

// Auth
export const api = {
  auth: {
    register: (username: string, email: string, password: string) =>
      request('POST', '/auth/register', { username, email, password }),
    login: (email: string, password: string) =>
      request('POST', '/auth/login', { email, password }),
    me: () => request('GET', '/auth/me'),
    logout: () => request('POST', '/auth/logout'),
  },
  goals: {
    list: () => request('GET', '/goals'),
    create: (goal: unknown) => request('POST', '/goals', goal),
    update: (id: string, goal: unknown) => request('PUT', `/goals/${id}`, goal),
    delete: (id: string) => request('DELETE', `/goals/${id}`),
  },
  notes: {
    list: () => request('GET', '/notes'),
    create: (note: unknown) => request('POST', '/notes', note),
    delete: (id: string) => request('DELETE', `/notes/${id}`),
  },
  notifications: {
    list: () => request('GET', '/notifications'),
    create: (n: unknown) => request('POST', '/notifications', n),
    markRead: (id: string) => request('PUT', `/notifications/${id}/read`),
    clearAll: () => request('DELETE', '/notifications'),
  },
  quizzes: {
    list: () => request('GET', '/quizzes'),
    create: (q: unknown) => request('POST', '/quizzes', q),
  },
  activity: {
    get: () => request('GET', '/activity'),
    log: (minutes: number = 0) => request('POST', '/activity', { minutes }),
  },
  stats: {
    get: () => request('GET', '/stats'),
    update: (stats: unknown) => request('PUT', '/stats', stats),
  },
  chat: {
    list: () => request('GET', '/chat'),
    create: (m: unknown) => request('POST', '/chat', m),
    clear: () => request('DELETE', '/chat'),
  },
};
