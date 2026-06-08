export const CITY_CENTERS = {
	bordeaux: { key: "bordeaux", name: "Bordeaux", label: "Bordeaux Métropole", longitude: -0.5792, latitude: 44.8378 },
	paris: { key: "paris", name: "Paris", label: "Paris", longitude: 2.3522, latitude: 48.8566 },
};

export const DEFAULT_CITY_KEY = import.meta.env.VITE_DEFAULT_CITY?.toLowerCase?.() || "paris";
export const DEFAULT_CITY = CITY_CENTERS[DEFAULT_CITY_KEY] ?? CITY_CENTERS.paris;
export const BORDEAUX_CENTER = CITY_CENTERS.bordeaux;

export const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/foot";
