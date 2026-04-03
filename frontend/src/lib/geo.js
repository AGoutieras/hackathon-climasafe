/**
 * Haversine distance between two {latitude, longitude} points, in metres.
 */
export function distanceMeters(from, to) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(to.latitude  - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Walking time in minutes at 80 m/min, minimum 1 min. */
export function walkMinutes(meters) {
  return Math.max(1, Math.ceil(meters / 80));
}

/**
 * Returns the lng/lat position a given number of metres behind the user
 * (opposite to their heading), used for "navigation camera" offset.
 */
export function behindPosition(pos, headingDeg, offsetMeters = 40) {
  const offsetDeg = offsetMeters / 111_000;
  const rad = ((headingDeg + 180) % 360) * (Math.PI / 180);
  return {
    lng: pos.longitude - offsetDeg * Math.sin(rad),
    lat: pos.latitude  - offsetDeg * Math.cos(rad),
  };
}
