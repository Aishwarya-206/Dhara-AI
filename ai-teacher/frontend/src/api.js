const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getToken() {
  return localStorage.getItem('ai_teacher_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('ai_teacher_token', token);
  else localStorage.removeItem('ai_teacher_token');
}

async function request(path, { method = 'GET', body, isFormData = false, isBlob = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (isBlob) {
    if (!res.ok) {
      let msg = 'Request failed';
      try {
        const errJson = await res.json();
        msg = errJson.error || msg;
      } catch {}
      throw new Error(msg);
    }
    return res.blob();
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),

  uploadMaterial: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/materials/upload', { method: 'POST', body: form, isFormData: true });
  },
  listMaterials: () => request('/materials'),
  deleteMaterial: (id) => request(`/materials/${id}`, { method: 'DELETE' }),

  startSession: (payload) => request('/chat/sessions', { method: 'POST', body: payload }),
  listSessions: () => request('/chat/sessions'),
  getSession: (id) => request(`/chat/sessions/${id}`),
  sendMessage: (id, message) => request(`/chat/sessions/${id}/message`, { method: 'POST', body: { message } }),
  generateAssessment: (id) => request(`/chat/sessions/${id}/assessment`, { method: 'POST' }),
  gradeAssessment: (assessmentId, answers) =>
    request(`/chat/assessments/${assessmentId}/grade`, { method: 'POST', body: { answers } }),

  getProfile: () => request('/profile'),
  updateProfile: (payload) => request('/profile', { method: 'PUT', body: payload }),
  getRecommendations: () => request('/profile/recommendations'),

  speak: (text) => request('/media/speak', { method: 'POST', body: { text }, isBlob: true }),
  avatarStatus: () => request('/media/avatar-status'),
  avatarVideo: (text, language) => request('/media/avatar-video', { method: 'POST', body: { text, language } }),

  health: () => request('/health'),
};
