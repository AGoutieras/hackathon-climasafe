const API_BASE = "http://localhost:8000/api";

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export const api = {
  getWeather:          (lat, lng)           => fetchJson(`/weather?lat=${lat}&lng=${lng}`),
  getRisks:            (lat, lng)           => fetchJson(`/risks?lat=${lat}&lng=${lng}`),
  getCoolSpots:        (lat, lng, limit=20) => fetchJson(`/cool-spots?lat=${lat}&lng=${lng}&limit=${limit}`),
  getHeatZones:        (lat, lng, limit=20) => fetchJson(`/heat-zones?lat=${lat}&lng=${lng}&limit=${limit}`),
  getWaterStations:    (lat, lng, off=0, limit=20) => fetchJson(`/water-stations?lat=${lat}&lng=${lng}&offset=${off}&limit=${limit}`),
  getWaterStationsCount: ()                 => fetchJson(`/water-stations/count`),
  getAlerts:           (lat, lng)           => fetchJson(`/alerts?lat=${lat}&lng=${lng}`),
  getTips:             ()                   => fetchJson(`/tips`),
};
