import { useState, useEffect } from "react";
import { BORDEAUX_CENTER } from "./constants.js";

/**
 * Watches the user's GPS position.
 * Falls back gracefully to BORDEAUX_CENTER on permission error.
 * Returns { position, gpsError, gpsStatusMessage }.
 */
export function useGeoPosition() {
  const [position, setPosition] = useState(BORDEAUX_CENTER);
  const [gpsError, setGpsError] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError(true);
      setGpsStatusMessage("Géolocalisation non prise en charge par votre navigateur.");
      return;
    }

    const ERROR_MESSAGES = {
      1: "Accès GPS refusé. Vérifiez les permissions du navigateur.",
      2: "Position indisponible pour le moment.",
      3: "Le GPS met trop de temps à répondre.",
    };

    function onSuccess(pos) {
      setGpsError(false);
      setGpsStatusMessage("");
      setPosition((prev) => {
        const next = { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
        const unchanged =
          Math.abs(next.latitude - prev.latitude) < 0.0001 &&
          Math.abs(next.longitude - prev.longitude) < 0.0001;
        return unchanged ? prev : next;
      });
    }

    function onError(err) {
      setGpsError(true);
      setGpsStatusMessage(ERROR_MESSAGES[err.code] ?? "Erreur GPS inconnue.");
      // Retry with lower accuracy on timeout / unavailable
      if (err.code === 2 || err.code === 3) {
        navigator.geolocation.getCurrentPosition(onSuccess, () => {}, {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60000,
        });
      }
    }

    const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { position, gpsError, gpsStatusMessage };
}
