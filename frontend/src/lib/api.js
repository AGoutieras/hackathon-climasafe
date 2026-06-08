const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

function withCity(path, params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export const api = {
  getWeather: (lat, lng) => fetchJson(withCity("/weather", { lat, lng })),
  getRisks: (lat, lng, city) => fetchJson(withCity("/risks", { lat, lng, city })),
  getCoolSpots: (lat, lng, limit = 20, city) => fetchJson(withCity("/cool-spots", { lat, lng, limit, city })),
  getHeatZones: (lat, lng, limit = 20, city) => fetchJson(withCity("/heat-zones", { lat, lng, limit, city })),
  getWaterStations: (lat, lng, off = 0, limit = 20, city) => fetchJson(withCity("/water-stations", { lat, lng, offset: off, limit, city })),
  getWaterStationsCount: (city) => fetchJson(withCity("/water-stations/count", { city })),
  getAlerts: (lat, lng, city) => fetchJson(withCity("/alerts", { lat, lng, city })),
  getTips: () => fetchJson("/tips"),
};
