import { useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Trees, Building2, Umbrella, Navigation, Clock, ThermometerSnowflake } from "lucide-react";
import { Card } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";

const BORDEAUX_CENTER = { longitude: -0.5792, latitude: 44.8378 };

const coolSpots = [
  { id: 1, name: "Jardin Public", type: "park", distance: 450, walkTime: 6, temperature: 28, address: "Cours de Verdun", longitude: -0.5765, latitude: 44.8455 },
  { id: 2, name: "Bibliothèque Mériadeck", type: "building", distance: 850, walkTime: 11, temperature: 22, address: "85 Cours du Maréchal Juin", longitude: -0.5876, latitude: 44.8378 },
  { id: 3, name: "Parc Bordelais", type: "park", distance: 1200, walkTime: 15, temperature: 26, address: "Rue du Bocage", longitude: -0.5934, latitude: 44.8456 },
  { id: 4, name: "Place de la Bourse", type: "shade", distance: 600, walkTime: 8, temperature: 30, address: "Place de la Bourse", longitude: -0.5703, latitude: 44.8412 },
];

const getSpotColor = (temperature) => {
  if (temperature < 24) return "#3b82f6";
  if (temperature < 28) return "#22c55e";
  if (temperature < 32) return "#f97316";
  return "#ef4444";
};

const getSpotIcon = (type) => {
  switch (type) {
    case "park": return Trees;
    case "building": return Building2;
    case "shade": return Umbrella;
    default: return Navigation;
  }
};

export function MapScreen() {
  const [selectedSpot, setSelectedSpot] = useState(null);

  const [route, setRoute] = useState(null);
  const [userPos] = useState({ longitude: -0.5792, latitude: 44.8378 });

  return (
    <div className="min-h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
        <h1 className="text-2xl text-slate-900">Refuges à proximité</h1>
        <p className="text-slate-600 text-sm mt-1">Bordeaux Centre</p>
      </div>

      {/* Carte MapLibre */}
      <div style={{ height: "400px" }}>
        <Map
          initialViewState={{
            ...BORDEAUX_CENTER,
            zoom: 14,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        >
          {/* Position utilisateur */}
          <Marker longitude={BORDEAUX_CENTER.longitude} latitude={BORDEAUX_CENTER.latitude}>
            <div style={{
              width: 16, height: 16, background: "#2563eb",
              borderRadius: "50%", border: "3px solid white",
              boxShadow: "0 0 0 3px #93c5fd"
            }} />
          </Marker>

          {/* Spots */}
          {coolSpots.map((spot) => {
            const Icon = getSpotIcon(spot.type);
            return (
              <Marker
                key={spot.id}
                longitude={spot.longitude}
                latitude={spot.latitude}
                onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedSpot(spot); }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: getSpotColor(spot.temperature),
                  border: selectedSpot?.id === spot.id ? "3px solid white" : "2px solid white",
                  boxShadow: selectedSpot?.id === spot.id ? "0 0 0 3px #93c5fd" : "0 2px 8px rgba(0,0,0,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  transform: selectedSpot?.id === spot.id ? "scale(1.2)" : "scale(1)",
                  transition: "transform 0.15s",
                }}>
                  <Icon size={18} color="white" />
                </div>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* Fiche ou liste */}
      <div className="p-4">
        {selectedSpot ? (
          <Card className="p-5 shadow-lg border-blue-200 border-2">
            <div className="flex items-start gap-4 mb-4">
              <div style={{ background: getSpotColor(selectedSpot.temperature) }}
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white">
                {(() => { const Icon = getSpotIcon(selectedSpot.type); return <Icon size={24} />; })()}
              </div>
              <div className="flex-1">
                <h3 className="text-xl text-slate-900 mb-1">{selectedSpot.name}</h3>
                <p className="text-sm text-slate-600">{selectedSpot.address}</p>
              </div>
              <button onClick={() => setSelectedSpot(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-1 text-slate-600 mb-1">
                  <Navigation size={14} /><span className="text-xs">Distance</span>
                </div>
                <p className="text-slate-900">{selectedSpot.distance}m</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center gap-1 text-slate-600 mb-1">
                  <Clock size={14} /><span className="text-xs">Temps</span>
                </div>
                <p className="text-slate-900">{selectedSpot.walkTime} min</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-1 text-blue-600 mb-1">
                  <ThermometerSnowflake size={14} /><span className="text-xs">Temp.</span>
                </div>
                <p className="text-blue-700">{selectedSpot.temperature}°C</p>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => fetchRoute(selectedSpot)}
            >
              <Navigation size={20} className="mr-2" />
              Voir l’itinéraire
            </Button>
          </Card>
        ) : (
          <div>
            <h2 className="text-xl mb-4 text-slate-900">Refuges disponibles ({coolSpots.length})</h2>
            <div className="space-y-3">
              {coolSpots.map((spot) => {
                const Icon = getSpotIcon(spot.type);
                return (
                  <Card key={spot.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow border-slate-200"
                    onClick={() => setSelectedSpot(spot)}>
                    <div className="flex items-center gap-3">
                      <div style={{ background: getSpotColor(spot.temperature) }}
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white">
                        <Icon size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-slate-900">{spot.name}</h3>
                        <p className="text-sm text-slate-600">{spot.distance}m • {spot.walkTime} min</p>
                      </div>
                      <p style={{ color: getSpotColor(spot.temperature) }} className="text-lg">
                        {spot.temperature}°C
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}