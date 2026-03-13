const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    fetchWithAuth('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    fetchWithAuth('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => fetchWithAuth('/api/auth/me'),
};

// Chat API
export const chatApi = {
  getHistory: (limit = 50) => fetchWithAuth(`/api/chat?limit=${limit}`),
  send: (content: string) =>
    fetchWithAuth('/api/chat', { method: 'POST', body: JSON.stringify({ content }) }),
  getWelcome: () => fetchWithAuth('/api/chat/welcome'),
};

// Profile API
export const profileApi = {
  get: () => fetchWithAuth('/api/profile'),
  onboard: (data: any) =>
    fetchWithAuth('/api/profile/onboard', { method: 'POST', body: JSON.stringify(data) }),
  update: (data: any) =>
    fetchWithAuth('/api/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

// Nexus API
export const nexusApi = {
  getInbox: (limit = 20) => fetchWithAuth(`/api/nexus/inbox?limit=${limit}`),
  submitFeedback: (routingId: string, feedback: string) =>
    fetchWithAuth(`/api/nexus/inbox/${routingId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),
  query: (query: string) =>
    fetchWithAuth('/api/nexus/query', { method: 'POST', body: JSON.stringify({ query }) }),
  getConversations: (limit = 20) => fetchWithAuth(`/api/nexus/conversations?limit=${limit}`),
  getStats: () => fetchWithAuth('/api/nexus/stats'),
  syncInsights: () => fetchWithAuth('/api/nexus/sync-insights', { method: 'POST' }),
};
