import { useEffect, useMemo, useState } from "react";
import { ThermometerSun, MapPin, TrendingUp, Droplets } from "lucide-react";
import { Link } from "react-router-dom";
import { RiskIndicator } from "./RiskIndicator.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import logoClimaSafe from "../assets/LOGO_CLIMASAFE.png";

const API_BASE = "http://localhost:8000/api";
const BORDEAUX_CENTER = { longitude: -0.5792, latitude: 44.8378 };

function distanceMeters(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkTimeFromDistance(distanceInMeters) {
  const walkingSpeedMetersPerMinute = 80;
  return Math.max(1, Math.ceil(distanceInMeters / walkingSpeedMetersPerMinute));
}

export function HomeScreen() {
  const riskLevel = "high"; // Could be "low", "medium", or "high"
  const riskScore = 82;
  const currentTemp = 38;
  const [coolSpots, setCoolSpots] = useState([]);
  const [waterStations, setWaterStations] = useState([]);
  const [currentPos, setCurrentPos] = useState(BORDEAUX_CENTER);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [coolRes, waterCountRes] = await Promise.all([
          fetch(`${API_BASE}/cool-spots?limit=80`),
          fetch(`${API_BASE}/water-stations/count`),
        ]);

        if (!coolRes.ok || !waterCountRes.ok) throw new Error("Erreur API");

        const [coolData, waterCount] = await Promise.all([coolRes.json(), waterCountRes.json()]);
        const totalWaterStations = waterCount.count ?? 0;
        const pageSize = 250;
        let offset = 0;
        let allWaterStations = [];

        while (!cancelled && offset < totalWaterStations) {
          const waterRes = await fetch(`${API_BASE}/water-stations?limit=${pageSize}&offset=${offset}`);
          if (!waterRes.ok) throw new Error("Erreur API");
          const batch = await waterRes.json();
          if (!Array.isArray(batch) || batch.length === 0) break;
          allWaterStations = [...allWaterStations, ...batch];
          offset += batch.length;
        }

        if (!cancelled) {
          setCoolSpots(Array.isArray(coolData) ? coolData : []);
          setWaterStations(allWaterStations);
        }
      } catch {
        if (!cancelled) {
          setCoolSpots([]);
          setWaterStations([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPos({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        });
      },
      () => {
        setCurrentPos(BORDEAUX_CENTER);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const nearestPlace = useMemo(() => {
    const nearbyCoolSpots = coolSpots.map((spot) => {
      const computedDistance = Math.round(
        distanceMeters(currentPos, { latitude: spot.lat, longitude: spot.lng })
      );
      return {
        id: `cool-${spot.id}`,
        kind: "cool",
        name: spot.name,
        computedDistance,
        computedWalkTime: walkTimeFromDistance(computedDistance),
      };
    });

    const nearbyWaterStations = waterStations
      .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng))
      .map((station) => {
        const computedDistance = Math.round(
          distanceMeters(currentPos, { latitude: station.lat, longitude: station.lng })
        );
        return {
          id: `water-${station.id}`,
          kind: "water",
          name: station.nom_fontaine,
          computedDistance,
          computedWalkTime: walkTimeFromDistance(computedDistance),
        };
      });

    return [...nearbyCoolSpots, ...nearbyWaterStations]
      .sort((a, b) => a.computedDistance - b.computedDistance)[0] ?? null;
  }, [coolSpots, waterStations, currentPos]);

  return (
    <div className="min-h-full bg-gradient-to-b from-orange-50 to-slate-50 p-4 sm:p-6">
      {/* Header */}
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={logoClimaSafe}
            alt="Logo ClimaSafe"
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
          />
          <h1 className="text-3xl sm:text-4xl text-slate-900">ClimaSafe</h1>
        </div>
        <p className="text-slate-600 text-base sm:text-lg">Votre assistant canicule</p>
      </div>

      {/* Alert Banner */}
      <div className="bg-red-500 text-white p-4 rounded-2xl mb-6 shadow-lg">
        <div className="flex items-center gap-3">
          <ThermometerSun size={28} />
          <div className="flex-1">
            <p className="font-semibold text-lg">Alerte chaleur élevée</p>
            <p className="text-red-100 text-sm">Évitez l'exposition au soleil</p>
          </div>
        </div>
      </div>

      {/* Risk Indicator */}
      <RiskIndicator level={riskLevel} score={riskScore} />

      {/* Current Conditions */}
      <Card className="p-4 sm:p-5 mb-6 shadow-sm border-slate-200">
        <h2 className="text-xl mb-4 text-slate-900">Conditions actuelles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <ThermometerSun className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">{currentTemp}°C</p>
              <p className="text-sm text-slate-500">Température</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Droplets className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">25%</p>
              <p className="text-sm text-slate-500">Humidité</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Nearest Refuge */}
      <Card className="p-4 sm:p-5 mb-6 bg-blue-50 border-blue-200 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <MapPin className="text-blue-600" size={24} />
          <div className="flex-1">
            <p className="text-sm text-slate-600">Refuge / fontaine la plus proche</p>
            <p className="text-xl text-slate-900">{nearestPlace?.name ?? "Chargement..."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-600 mb-4">
          <TrendingUp size={18} />
          <p className="text-sm">
            {nearestPlace
              ? `${nearestPlace.computedDistance} mètres • ${nearestPlace.computedWalkTime} min à pied`
              : "Distance indisponible"}
          </p>
        </div>
        <Link to="/carte">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 sm:h-14 text-base sm:text-lg rounded-xl shadow-md">
            Trouver un refuge
          </Button>
        </Link>
      </Card>

      {/* Quick Tips */}
      <Card className="p-4 sm:p-5 shadow-sm border-slate-200">
        <h2 className="text-xl mb-3 text-slate-900">Conseils rapides</h2>
        <ul className="space-y-2 text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
            <span>Buvez de l'eau régulièrement</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
            <span>Évitez les efforts physiques</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
            <span>Restez à l'ombre ou au frais</span>
          </li>
        </ul>
        <Link to="/conseils">
          <Button variant="outline" className="w-full mt-4 h-12 text-base border-slate-300 rounded-xl">
            Voir tous les conseils
          </Button>
        </Link>
      </Card>
    </div>
  );
}
