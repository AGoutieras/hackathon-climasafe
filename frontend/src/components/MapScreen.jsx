import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Trees, Flame, Droplets, Navigation, Clock,
  ThermometerSnowflake, Loader2, AlertTriangle,
  LocateFixed, X, ChevronRight, Footprints,
  TriangleAlert, MapPin, CheckCircle2,
} from "lucide-react";
import { Card } from "./ui/card.jsx";
import { api } from "../lib/api.js";

const BORDEAUX_CENTER = { longitude: -0.5792, latitude: 44.8378 };
const OSRM = "https://router.project-osrm.org/route/v1/foot";

// ─── colour helpers ────────────────────────────────────────────────────────

const coolColor = (score) =>
  score >= 90 ? "#0ea5e9" : score >= 80 ? "#22c55e" : "#84cc16";

const heatColor = (risk) =>
  ({ very_high: "#ef4444", high: "#f97316", medium: "#facc15" }[risk] ?? "#fde68a");

const riskLabel = (r) =>
  ({ very_high: "Très élevé", high: "Élevé", medium: "Modéré" }[r] ?? "Faible");

const spotTypeLabel = (t) =>
  ({ park: "Zone boisée", water: "Plan d'eau", green: "Espace vert" }[t] ?? "Zone fraîche");

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

// ─── helper to get offset position behind user ─────────────────────────────

function getOffsetPosBehindUser(pos, heading) {
  const offsetMeters = 40;
  const offsetDegrees = offsetMeters / 111000; // ~111km per degree
  const behindHeading = (heading + 180) % 360; // opposite direction
  const rad = (behindHeading * Math.PI) / 180;
  return {
    lng: pos.longitude - offsetDegrees * Math.sin(rad),
    lat: pos.latitude - offsetDegrees * Math.cos(rad),
  };
}

// ─── OSRM routing ──────────────────────────────────────────────────────────

async function fetchRoute(userPos, dest) {
  const url = `${OSRM}/${userPos.longitude},${userPos.latitude};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing error");
  const data = await res.json();
  const route = data.routes[0];
  return {
    geojson: route.geometry,
    distance: route.distance,          // metres
    duration: route.duration,          // seconds
    steps: route.legs[0].steps.map((s) => ({
      instruction: s.maneuver.instruction ?? s.name,
      distance: s.distance,
      type: s.maneuver.type,
    })),
  };
}

// ─── marker components ─────────────────────────────────────────────────────

function CoolMarker({ spot, selected, onClick }) {
  const c = coolColor(spot.coolnessScore);
  return (
    <Marker longitude={spot.lng} latitude={spot.lat}
      onClick={(e) => { e.originalEvent.stopPropagation(); onClick(spot); }}>
      <div style={{
        width: selected ? 40 : 28, height: selected ? 40 : 28,
        borderRadius: spot.type === "water" ? "6px" : "50%",
        background: c, border: selected ? "3px solid white" : "2px solid rgba(255,255,255,.8)",
        boxShadow: selected ? `0 0 0 3px ${c}80,0 4px 12px rgba(0,0,0,.4)` : "0 2px 6px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        transition: "all .15s",
      }}>
        {spot.type === "water"
          ? <Droplets size={selected ? 20 : 14} color="white" />
          : <Trees size={selected ? 20 : 14} color="white" />}
      </div>
    </Marker>
  );
}

function HeatMarker({ zone, selected, onClick }) {
  const c = heatColor(zone.risk);
  return (
    <Marker longitude={zone.lng} latitude={zone.lat}
      onClick={(e) => { e.originalEvent.stopPropagation(); onClick(zone); }}>
      <div style={{
        width: selected ? 34 : 22, height: selected ? 34 : 22,
        borderRadius: "3px", background: c, opacity: .9,
        border: selected ? "3px solid white" : "2px solid rgba(255,255,255,.6)",
        boxShadow: selected ? `0 0 0 3px ${c}80,0 4px 12px rgba(0,0,0,.4)` : "0 2px 6px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        transition: "all .15s", transform: "rotate(45deg)",
      }}>
        <Flame size={selected ? 16 : 11} color="white" style={{ transform: "rotate(-45deg)" }} />
      </div>
    </Marker>
  );
}

function WaterMarker({ station, selected, onClick }) {
  return (
    <Marker longitude={station.lng} latitude={station.lat}
      onClick={(e) => { e.originalEvent.stopPropagation(); onClick(station); }}>
      <div style={{
        width: selected ? 36 : 24, height: selected ? 36 : 24,
        borderRadius: "50%", background: "#06b6d4",
        border: selected ? "3px solid white" : "2px solid rgba(255,255,255,.7)",
        boxShadow: selected ? "0 0 0 3px #06b6d480,0 4px 12px rgba(0,0,0,.3)" : "0 2px 6px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        transition: "all .15s",
      }}>
        <Droplets size={selected ? 18 : 13} color="white" />
      </div>
    </Marker>
  );
}

// ─── navigation panel ─────────────────────────────────────────────────────

function NavPanel({ route, dest, onCancel }) {
  const mins = Math.round(route.duration / 60);
  const km = (route.distance / 1000).toFixed(2);
  return (
    <div className="fixed bottom-20 left-0 right-0 w-full max-w-2xl mx-auto px-3 z-50 md:bottom-24">
      <Card className="shadow-2xl border-0 overflow-hidden">
        {/* top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-sky-600 text-white">
          <div className="flex items-center gap-2">
            <Footprints size={20} />
            <div>
              <p className="text-sm font-semibold leading-none">{dest.name}</p>
              <p className="text-xs text-sky-100 mt-0.5">{km} km · {mins} min à pied</p>
            </div>
          </div>
          <button onClick={onCancel}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
            <X size={16} />
          </button>
        </div>

        {/* steps */}
        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
          {route.steps.slice(0, 6).map((s, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                i === 0 ? "bg-sky-100 text-sky-600" :
                i === route.steps.length - 1 || i === 5 ? "bg-green-100 text-green-600" :
                "bg-slate-100 text-slate-500"}`}>
                {i === 0 ? <Navigation size={14} /> :
                 (i === route.steps.length - 1 || i === 5) ? <CheckCircle2 size={14} /> :
                 <ChevronRight size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 leading-snug">{s.instruction || "Continuez tout droit"}</p>
                {s.distance > 5 && (
                  <p className="text-xs text-slate-400 mt-0.5">{Math.round(s.distance)} m</p>
                )}
              </div>
            </div>
          ))}
          {route.steps.length > 6 && (
            <p className="text-xs text-slate-400 text-center py-2">
              +{route.steps.length - 6} étapes supplémentaires
            </p>
          )}
        </div>

        {/* open in maps fallback */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=walking`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-sky-600 hover:text-sky-700 font-medium"
          >
            <MapPin size={14} />
            Ouvrir dans Google Maps
          </a>
        </div>
      </Card>
    </div>
  );
}

// ─── detail panel cool ────────────────────────────────────────────────────

function CoolPanel({ spot, onClose, onNavigate, navigating }) {
  const c = coolColor(spot.coolnessScore);
  return (
    <Card className="p-5 shadow-xl border-2 mb-4" style={{ borderColor: c }}>
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0"
          style={{ background: c }}>
          {spot.type === "water" ? <Droplets size={26} /> : <Trees size={26} />}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 mb-1">{spot.name}</h3>
          <p className="text-sm text-slate-500">{spotTypeLabel(spot.type)}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: <Navigation size={12} />, val: `${spot.distance}m`, label: "Distance" },
          { icon: <Clock size={12} />, val: `${spot.walkTime} min`, label: "À pied" },
          { icon: <ThermometerSnowflake size={12} />, val: `${spot.estimatedTemperature}°C`, label: "Estimé", accent: c },
        ].map((item, i) => (
          <div key={i} className="p-3 rounded-lg text-center"
            style={item.accent ? { background: `${item.accent}20` } : { background: "#f8fafc" }}>
            <div className="flex justify-center mb-1" style={item.accent ? { color: c } : { color: "#94a3b8" }}>
              {item.icon}
            </div>
            <p className="text-base font-semibold text-slate-900" style={item.accent ? { color: c } : {}}>
              {item.val}
            </p>
            <p className="text-xs text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Indice de fraîcheur</span>
          <span className="font-medium">{spot.coolnessScore}/100</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${spot.coolnessScore}%`, background: c }} />
        </div>
      </div>

      <button
        onClick={() => onNavigate(spot)}
        disabled={navigating}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold transition-all disabled:opacity-60"
        style={{ background: navigating ? "#94a3b8" : "#0284c7" }}
      >
        {navigating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
        {navigating ? "Calcul de l'itinéraire…" : "M'y guider"}
      </button>
    </Card>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────

const routeLineLayer = {
  id: "route-line",
  type: "line",
  paint: {
    "line-color": "#0284c7",
    "line-width": 5,
    "line-opacity": 0.9,
  },
  layout: { "line-join": "round", "line-cap": "round" },
};

const routeOutlineLayer = {
  id: "route-outline",
  type: "line",
  paint: {
    "line-color": "#ffffff",
    "line-width": 9,
    "line-opacity": 0.4,
  },
  layout: { "line-join": "round", "line-cap": "round" },
};

export function MapScreen() {
  const [coolSpots, setCoolSpots] = useState([]);
  const [heatZones, setHeatZones] = useState([]);
  const [waterStations, setWaterStations] = useState([]);
  const [waterStationsCount, setWaterStationsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  // GPS
  const [userPos, setUserPos] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  const [gpsError, setGpsError] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const watchId = useRef(null);

  // Routing
  const [route, setRoute] = useState(null);           // { geojson, distance, duration, steps }
  const [routeDest, setRouteDest] = useState(null);   // spot being navigated to
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [activeNavigation, setActiveNavigation] = useState(false);

  // Layers
  const [showCool, setShowCool] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [showWater, setShowWater] = useState(true);

  const mapRef = useRef(null);

  const recenterOnUser = useCallback(() => {
    const target = userPos ?? BORDEAUX_CENTER;

    mapRef.current?.flyTo({
      center: [target.longitude, target.latitude],
      zoom: userPos ? 15.5 : 13.5,
      pitch: 0,
      bearing: 0,
      duration: 700,
    });
  }, [userPos]);

  // ── load backend data ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadWaterStationsProgressively = async (totalCount) => {
      const pageSize = 250;
      let offset = 0;
      let accumulated = [];

      while (!cancelled && offset < totalCount) {
        const batch = await api.getWaterStations(
          BORDEAUX_CENTER.latitude,
          BORDEAUX_CENTER.longitude,
          offset,
          pageSize
        );

        if (!Array.isArray(batch) || batch.length === 0) break;

        accumulated = [...accumulated, ...batch];
        if (!cancelled) setWaterStations(accumulated);
        offset += batch.length;
      }
    };

    (async () => {
      try {
        const [cd, hd, wc] = await Promise.all([
          api.getCoolSpots(BORDEAUX_CENTER.latitude, BORDEAUX_CENTER.longitude, 80),
          api.getHeatZones(BORDEAUX_CENTER.latitude, BORDEAUX_CENTER.longitude, 80),
          api.getWaterStationsCount(),
        ]);
        setCoolSpots(cd);
        setHeatZones(hd);
        const totalCount = wc.count ?? 0;
        setWaterStationsCount(totalCount);
        await loadWaterStationsProgressively(totalCount);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────────
  const startGps = useCallback(() => {
    if (!navigator.geolocation) { setGpsError("GPS non disponible"); return; }
    setGpsLoading(true);
    setGpsError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
        const heading = Number.isFinite(pos.coords.heading) && pos.coords.heading >= 0
          ? pos.coords.heading
          : null;
        setUserPos(p);
        if (heading !== null) setUserHeading(heading);
        setGpsLoading(false);
        mapRef.current?.flyTo({ center: [p.longitude, p.latitude], zoom: 15, duration: 800 });
      },
      (err) => {
        console.error("Erreur GPS :", err);

        if (err.code === 1) {
          setGpsError("Accès au GPS refusé. Carte centrée sur Bordeaux.");
        } else if (err.code === 2) {
          setGpsError("Position indisponible. Carte centrée sur Bordeaux.");
        } else if (err.code === 3) {
          setGpsError("Le GPS a mis trop de temps à répondre. Carte centrée sur Bordeaux.");
        } else {
          setGpsError("Position indisponible. Carte centrée sur Bordeaux.");
        }
        
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

  const effectivePos = userPos ?? BORDEAUX_CENTER;

  const nearbyCoolSpots = useMemo(() => {
    return [...coolSpots]
      .map((spot) => {
        const computedDistance = Math.round(
          distanceMeters(effectivePos, { latitude: spot.lat, longitude: spot.lng })
        );
        return {
          ...spot,
          computedDistance,
          computedWalkTime: walkTimeFromDistance(computedDistance),
        };
      })
      .sort((a, b) => a.computedDistance - b.computedDistance);
  }, [coolSpots, effectivePos]);

  const nearbyWaterStations = useMemo(() => {
    return [...waterStations]
      .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng))
      .map((station) => {
        const computedDistance = Math.round(
          distanceMeters(effectivePos, { latitude: station.lat, longitude: station.lng })
        );
        return {
          ...station,
          computedDistance,
          computedWalkTime: walkTimeFromDistance(computedDistance),
        };
      })
      .sort((a, b) => a.computedDistance - b.computedDistance);
  }, [waterStations, effectivePos]);

  const nearbyHeatZones = useMemo(() => {
    return [...heatZones]
      .map((zone) => {
        const computedDistance = Math.round(
          distanceMeters(effectivePos, { latitude: zone.lat, longitude: zone.lng })
        );
        return {
          ...zone,
          computedDistance,
        };
      })
      .sort((a, b) => a.computedDistance - b.computedDistance);
  }, [heatZones, effectivePos]);

  const nearbyPlaces = useMemo(() => {
    const coolPlaces = nearbyCoolSpots.map((spot) => ({
      id: `cool-${spot.id}`,
      kind: "cool",
      data: spot,
      computedDistance: spot.computedDistance,
      computedWalkTime: spot.computedWalkTime,
    }));

    const waterPlaces = nearbyWaterStations.map((station) => ({
      id: `water-${station.id}`,
      kind: "water",
      data: station,
      computedDistance: station.computedDistance,
      computedWalkTime: station.computedWalkTime,
    }));

    return [...coolPlaces, ...waterPlaces]
      .sort((a, b) => a.computedDistance - b.computedDistance);
  }, [nearbyCoolSpots, nearbyWaterStations]);

  // ── navigate to spot ──────────────────────────────────────────────────
  const handleNavigate = useCallback(async (spot) => {
    setRouteLoading(true);
    setRouteError(null);
    setRoute(null);
    setActiveNavigation(false);
    try {
      const r = await fetchRoute(effectivePos, spot);
      setRoute(r);
      setRouteDest(spot);
      setActiveNavigation(true);
      
      // Position camera behind user with high pitch (Google Maps style)
      if (userPos) {
        const offset = getOffsetPosBehindUser(userPos, userHeading);
        mapRef.current?.flyTo({
          center: [offset.lng, offset.lat],
          zoom: 17.5,
          pitch: 70,
          bearing: userHeading,
          duration: 1000,
          essential: true,
        });
      }
    } catch {
      setRouteError("Impossible de calculer l'itinéraire.");
    } finally {
      setRouteLoading(false);
    }
  }, [effectivePos, userPos, userHeading]);

  const cancelNav = () => {
    setRoute(null);
    setRouteDest(null);
    setActiveNavigation(false);
    // Reset camera to normal view
    mapRef.current?.flyTo({
      center: [effectivePos.longitude, effectivePos.latitude],
      zoom: 15,
      pitch: 0,
      bearing: 0,
      duration: 700,
    });
  };

  // ── route GeoJSON source ──────────────────────────────────────────────
  const routeSource = route ? {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: route.geojson }],
  } : null;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
        <h1 className="text-2xl text-slate-900">Carte thermique</h1>
        <div className="text-slate-500 text-sm mt-0.5 space-y-1">
          <p>
            {loading
              ? "Chargement…"
              : `${coolSpots.length} zones fraîches · ${heatZones.length} zones chaudes · ${waterStationsCount} fontaines`}
          </p>
          <p className="text-xs">
            {userPos ? "Position GPS active" : "Carte centrée sur Bordeaux"}
          </p>
      </div>
    </div>

      {/* Layer toggle */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-slate-100 flex-wrap">
        <button
          onClick={() => setShowCool((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            showCool
              ? "bg-sky-100 border-sky-300 text-sky-700"
              : "bg-slate-100 border-slate-200 text-slate-500"
          }`}
        >
          <Trees size={13} /> Zones fraîches
        </button>

        <button
          onClick={() => setShowHeat((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            showHeat
              ? "bg-red-100 border-red-300 text-red-700"
              : "bg-slate-100 border-slate-200 text-slate-500"
          }`}
        >
          <Flame size={13} /> Zones chaudes
        </button>

        <button
          onClick={() => setShowWater((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            showWater
              ? "bg-cyan-100 border-cyan-300 text-cyan-700"
              : "bg-slate-100 border-slate-200 text-slate-500"
          }`}
        >
          <Droplets size={13} /> Fontaines
        </button>

        <button
          onClick={startGps}
          disabled={gpsLoading}
          className={`w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            userPos
              ? "bg-green-100 border-green-300 text-green-700"
              : gpsLoading
              ? "bg-slate-100 border-slate-200 text-slate-400"
              : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {gpsLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
          <LocateFixed size={13} />
          )}
          {userPos ? "GPS actif" : gpsLoading ? "Localisation…" : "Me localiser"}
        </button>

        <button
          onClick={recenterOnUser}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <Navigation size={13} />
          Recentrer
        </button>
      </div>

      {/* GPS / route errors */}
      {(gpsError || routeError) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
          <TriangleAlert size={15} />
          {gpsError || routeError}
        </div>
      )}

      {/* Map */}
      <div style={{ height: "min(62vh, 560px)", position: "relative" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <Loader2 className="animate-spin text-slate-500" size={32} />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 p-6 text-center">
            <div>
              <AlertTriangle className="text-red-400 mx-auto mb-2" size={32} />
              <p className="text-slate-700 text-sm">
                Impossible de joindre le backend.<br />
                <span className="text-slate-400 text-xs">Assurez-vous que FastAPI tourne sur le port 8000.</span>
              </p>
            </div>
          </div>
        )}

        <Map
          ref={mapRef}
          initialViewState={{ ...BORDEAUX_CENTER, zoom: 13.5 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          onClick={() => setSelected(null)}
        >
          <NavigationControl position="top-right" />

          {/* Route */}
          {routeSource && (
            <Source id="route" type="geojson" data={routeSource}>
              <Layer {...routeOutlineLayer} />
              <Layer {...routeLineLayer} />
            </Source>
          )}

          {/* User position */}
          <Marker longitude={effectivePos.longitude} latitude={effectivePos.latitude}>
            {activeNavigation && userPos ? (
              <div style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "#dbeafe",
                boxShadow: "0 0 0 4px #93c5fd77, 0 4px 12px rgba(2, 6, 23, 0.2)",
              }}>
                <div style={{ transform: `rotate(${userHeading}deg)` }}>
                  <Navigation size={24} color="#2563eb" fill="#2563eb" strokeWidth={2.4} />
                </div>
              </div>
            ) : (
              <div style={{
                width: 18,
                height: 18,
                background: userPos ? "#16a34a" : "#2563eb",
                borderRadius: "50%",
                border: "3px solid white",
                boxShadow: `0 0 0 4px ${userPos ? "#86efac" : "#93c5fd"}88`,
              }} />
            )}
          </Marker>

          {/* Destination flag */}
          {routeDest && (
            <Marker longitude={routeDest.lng} latitude={routeDest.lat}>
              <div style={{
                width: 32, height: 32, background: "#0284c7",
                borderRadius: "50% 50% 50% 0", border: "3px solid white",
                boxShadow: "0 2px 8px rgba(0,0,0,.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: "rotate(-45deg)",
              }}>
                <MapPin size={16} color="white" style={{ transform: "rotate(45deg)" }} />
              </div>
            </Marker>
          )}

          {/* Heat zones */}
          {showHeat && heatZones.map((z) => (
            <HeatMarker key={`h-${z.id}`} zone={z}
              selected={selected?.kind === "heat" && selected.data.id === z.id}
              onClick={(z) => setSelected({ kind: "heat", data: z })} />
          ))}

          {/* Water stations */}
          {showWater && waterStations.map((w) => (
            <WaterMarker key={`w-${w.id}`} station={w}
              selected={selected?.kind === "water" && selected.data.id === w.id}
              onClick={(w) => setSelected({ kind: "water", data: w })} />
          ))}

          {/* Cool spots */}
          {showCool && coolSpots.map((s) => (
            <CoolMarker key={`c-${s.id}`} spot={s}
              selected={selected?.kind === "cool" && selected.data.id === s.id}
              onClick={(s) => setSelected({ kind: "cool", data: s })} />
          ))}
        </Map>
      </div>

      {/* Navigation panel overlay */}
      {route && routeDest && (
        <NavPanel route={route} dest={routeDest} onCancel={cancelNav} />
      )}

      {/* Legend */}
      <div className="px-4 py-2 bg-white border-b border-slate-100 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#0ea5e9" }} />Eau</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#22c55e" }} />Boisé</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full inline-block" style={{ background: "#06b6d4" }} />Fontaines</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rotate-45 inline-block" style={{ background: "#ef4444" }} />Très chaud</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rotate-45 inline-block" style={{ background: "#f97316" }} />Chaud</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rotate-45 inline-block" style={{ background: "#facc15" }} />Modéré</span>
      </div>

      {/* Detail / list */}
      <div className="p-4 pb-8">
        {selected?.kind === "cool" && (
          <CoolPanel
            spot={selected.data}
            onClose={() => setSelected(null)}
            onNavigate={handleNavigate}
            navigating={routeLoading}
          />
        )}

        {selected?.kind === "heat" && (
          <Card className="p-5 shadow-xl border-2 mb-4" style={{ borderColor: heatColor(selected.data.risk) }}>
            <div className="flex items-start gap-4 mb-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: heatColor(selected.data.risk) }}>
                <Flame size={26} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{selected.data.name}</h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-full text-white"
                  style={{ background: heatColor(selected.data.risk) }}>
                  Risque {riskLabel(selected.data.risk)}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
              style={{ background: `${heatColor(selected.data.risk)}15` }}>
              <AlertTriangle size={16} style={{ color: heatColor(selected.data.risk), flexShrink: 0, marginTop: 2 }} />
              <p className="text-slate-700">Zone à forte accumulation de chaleur — limitez votre exposition.</p>
            </div>
          </Card>
        )}

        {selected?.kind === "water" && (
          <Card className="p-5 shadow-xl border-2 mb-4" style={{ borderColor: "#06b6d4" }}>
            <div className="flex items-start gap-4 mb-3">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: "#06b6d4" }}>
                <Droplets size={26} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-1">{selected.data.nom_fontaine}</h3>
                <p className="text-sm text-slate-500">{selected.data.adresse}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-3 rounded-lg text-center bg-cyan-50">
                <p className="text-xs text-slate-500">État</p>
                <p className="text-sm font-semibold text-slate-900">{selected.data.etat}</p>
              </div>
              <div className="p-3 rounded-lg text-center bg-cyan-50">
                <p className="text-xs text-slate-500">Robinets</p>
                <p className="text-sm font-semibold text-slate-900">{selected.data.nombre_robinets}</p>
              </div>
            </div>
          </Card>
        )}

        {selected?.kind === "water" && selected.data.lat && selected.data.lng && (
          <button
            onClick={() => handleNavigate(selected.data)}
            disabled={routeLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold transition-all disabled:opacity-60 mb-4"
            style={{ background: routeLoading ? "#94a3b8" : "#06b6d4" }}
          >
            {routeLoading ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
            {routeLoading ? "Calcul de l'itinéraire…" : "M'y guider"}
          </button>
        )}

        {!selected && (
          <>
            <h2 className="text-base font-semibold text-slate-900 mb-3">Endroits les plus proches</h2>
            <div className="space-y-2 mb-6">
              {nearbyPlaces.slice(0, 5).map((place) => {
                const isCool = place.kind === "cool";
                const item = place.data;
                const iconColor = isCool ? coolColor(item.coolnessScore) : "#06b6d4";
                return (
                  <Card key={place.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow border-slate-200"
                    onClick={() => setSelected({ kind: place.kind, data: item })}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                        style={{ background: iconColor }}>
                        {isCool ? <Trees size={18} /> : <Droplets size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {isCool ? item.name : item.nom_fontaine}
                        </p>
                        <p className="text-xs text-slate-500">
                          {place.computedDistance}m · {place.computedWalkTime} min
                        </p>
                      </div>
                      {isCool ? (
                        <p className="text-sm font-semibold flex-shrink-0" style={{ color: iconColor }}>
                          {item.estimatedTemperature}°C
                        </p>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-cyan-700 bg-cyan-100 flex-shrink-0">
                          Fontaine
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            <h2 className="text-base font-semibold text-slate-900 mb-3">Zones chaudes à éviter</h2>
            <div className="space-y-2">
              {nearbyHeatZones.slice(0, 5).map((z) => {
                const c = heatColor(z.risk);
                return (
                  <Card key={z.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow border-slate-200"
                    onClick={() => setSelected({ kind: "heat", data: z })}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                        style={{ background: c }}>
                        <Flame size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{z.name}</p>
                        <p className="text-xs text-slate-500">{z.computedDistance}m · Classe {z.sourceClass}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                        style={{ background: c }}>
                        {riskLabel(z.risk)}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
