const API_BASE = 'http://localhost:8000/api';

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export const api = {
  getRisks: () => fetchJson('/risks'),
  getCoolSpots: () => fetchJson('/cool-spots?limit=20'),
  getAlerts: () => fetchJson('/alerts'),
  getTips: () => fetchJson('/tips'),
  getRoute: (spotId) => fetchJson(`/route-safe/${spotId}`),
};
