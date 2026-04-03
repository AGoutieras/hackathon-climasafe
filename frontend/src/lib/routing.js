import { OSRM_BASE_URL } from "./constants.js";

/**
 * Fetches a walking route from `userPos` to `dest` via OSRM.
 * @param {{ longitude, latitude }} userPos
 * @param {{ lng, lat }}            dest
 * @returns {{ geojson, distance, duration, steps }}
 */
export async function fetchRoute(userPos, dest) {
  const url =
    `${OSRM_BASE_URL}/${userPos.longitude},${userPos.latitude};${dest.lng},${dest.lat}` +
    `?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur calcul itinéraire");

  const data  = await res.json();
  const route = data.routes[0];

  return {
    geojson:  route.geometry,
    distance: route.distance,   // metres
    duration: route.duration,   // seconds
    steps: route.legs[0].steps.map((s) => ({
      instruction: s.maneuver.instruction ?? s.name,
      distance:    s.distance,
      type:        s.maneuver.type,
    })),
  };
}
