from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from app.services.weather import fetch_current_weather

# ── Paths & defaults ──────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"

BORDEAUX_LAT = 44.837789
BORDEAUX_LNG = -0.57918
BORDEAUX_CENTER = {"name": "Bordeaux Centre", "lat": BORDEAUX_LAT, "lng": BORDEAUX_LNG}

# ── App setup ─────────────────────────────────────────────────────────────

app = FastAPI(title="ClimaSafe API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Data loading ──────────────────────────────────────────────────────────

def _load_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def get_cool_spots():
    return _load_json("cool_spots.json")


@lru_cache(maxsize=1)
def get_heat_zones():
    return _load_json("heat_zones.json")


@lru_cache(maxsize=1)
def get_water_stations():
    data = _load_json("water_stations.json")
    return [
        {**item, "lat": item["geom"]["lat"], "lng": item["geom"]["lon"]}
        for item in data
    ]

# ── Geo helpers ───────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def with_live_distance(items: list[dict], user_lat: float, user_lng: float) -> list[dict]:
    enriched = []
    for item in items:
        km = haversine_km(user_lat, user_lng, item["lat"], item["lng"])
        m  = int(round(km * 1000))
        enriched.append({
            **item,
            "distance":          m,
            "distanceToUserKm":  round(km, 2),
            "walkTime":          max(2, round(m / 80)),
        })
    return sorted(enriched, key=lambda x: x["distance"])

# ── Reverse geocoding ─────────────────────────────────────────────────────

def _estimate_zone_name(lat: float, lng: float) -> str:
    dlat = lat - BORDEAUX_LAT
    dlng = lng - BORDEAUX_LNG
    threshold = 0.003

    if abs(dlat) < threshold and abs(dlng) < threshold:
        return BORDEAUX_CENTER["name"]

    ns = "Nord" if dlat >= threshold else "Sud" if dlat <= -threshold else ""
    ew = "Est"  if dlng >= threshold else "Ouest" if dlng <= -threshold else ""

    if ns and ew:
        return f"Bordeaux {ns}-{ew}"
    return f"Bordeaux {ns or ew}" if (ns or ew) else "Bordeaux"


@lru_cache(maxsize=512)
def _reverse_city_name(lat_key: float, lng_key: float) -> str | None:
    ua = "climasafe/1.0 (+hackathon)"

    # Primary: OSM Nominatim
    params = urlencode({"format": "jsonv2", "lat": lat_key, "lon": lng_key, "accept-language": "fr"})
    try:
        with urlopen(Request(f"https://nominatim.openstreetmap.org/reverse?{params}", headers={"User-Agent": ua}), timeout=3) as r:
            addr = json.loads(r.read().decode()).get("address", {})
            city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
            if city:
                return city
    except (URLError, TimeoutError, ValueError):
        pass

    # Fallback: BAN (Base Adresse Nationale)
    params = urlencode({"lat": lat_key, "lon": lng_key, "type": "municipality"})
    try:
        with urlopen(Request(f"https://api-adresse.data.gouv.fr/reverse/?{params}", headers={"User-Agent": ua}), timeout=3) as r:
            features = json.loads(r.read().decode()).get("features", [])
            if features:
                props = features[0].get("properties", {})
                return props.get("city") or props.get("name")
    except (URLError, TimeoutError, ValueError):
        pass

    return None


def resolve_zone_name(lat: float, lng: float) -> str:
    city = _reverse_city_name(round(lat, 4), round(lng, 4))
    if city:
        return city
    if haversine_km(lat, lng, BORDEAUX_LAT, BORDEAUX_LNG) > 25:
        return "Ville inconnue"
    return _estimate_zone_name(lat, lng)

# ── Risk score computation ────────────────────────────────────────────────

def _thermal_score(temp: float) -> int:
    thresholds = [(0, 0), (8, 3), (16, 8), (20, 12), (24, 18), (27, 24), (30, 34), (33, 48), (36, 68)]
    for limit, score in reversed(thresholds):
        if temp >= limit:
            return score
    return 82  # >= 36 °C


def compute_risk_score(
    real_temp: float,
    humidity: float,
    apparent_temp: float,
    hot_nearby: int,
    cool_nearby: int,
) -> int:
    score = _thermal_score(real_temp)

    # Urban heat island adjustment (capped by temperature band)
    urban_cap = 6 if real_temp < 22 else 10 if real_temp < 30 else 14 if real_temp < 35 else 20
    score += min(urban_cap, max(-10, hot_nearby * 2 - cool_nearby * 2))

    # Humidity adjustment (only relevant above 26 °C)
    if real_temp >= 26:
        score += 6 if humidity >= 75 else 3 if humidity >= 60 else 0

    # Apparent-temperature adjustment (only relevant above 30 °C)
    if real_temp >= 30:
        score += 6 if apparent_temp >= 40 else 3 if apparent_temp >= 36 else 0

    # Cap low temperatures
    if real_temp < 20:
        score = min(score, 25)
    elif real_temp < 24:
        score = min(score, 35)

    return min(95, max(5, score))

# ── Routes ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/data-sources")
def data_sources():
    return {
        "project": "ClimaSafe",
        "sources": [
            {
                "name": "LCZ SPOT 2022 Bordeaux",
                "type": "uploaded_shapefile",
                "description": "Données LCZ/îlots chaleur-fraîcheur dérivées du fichier fourni par l'équipe.",
            },
            {
                "name": "Espaces fraîcheur - Bordeaux Métropole",
                "type": "official_web_map",
                "url": "https://geo.bordeaux-metropole.fr/adws/app/33cebc9f-cd8e-11ed-ad24-9bf3b515cd35/?context=q3KX",
            },
            {
                "name": "ri_icu_ifu_s",
                "type": "official_dataset_identifier",
                "description": "Jeu de données Bordeaux Métropole — îlots de chaleur et de fraîcheur urbains (2022).",
            },
        ],
    }


@app.get("/api/weather")
async def get_weather(
    lat: float = Query(BORDEAUX_LAT),
    lng: float = Query(BORDEAUX_LNG),
):
    return await fetch_current_weather(lat, lng)


@app.get("/api/risks")
async def get_risks(
    lat: float = Query(BORDEAUX_LAT),
    lng: float = Query(BORDEAUX_LNG),
):
    cool_spots = with_live_distance(get_cool_spots(), lat, lng)
    heat_zones = with_live_distance(get_heat_zones(), lat, lng)

    hot_nearby  = sum(1 for z in heat_zones if z["distance"] <= 1000)
    cool_nearby = sum(1 for s in cool_spots if s["distance"] <= 1000)

    weather        = await fetch_current_weather(lat, lng)
    real_temp      = weather.get("temperature")      or 30
    humidity       = weather.get("humidity")         or 45
    apparent_temp  = weather.get("apparent_temperature") or real_temp

    score = compute_risk_score(real_temp, humidity, apparent_temp, hot_nearby, cool_nearby)
    level = "high" if score >= 70 else "medium" if score >= 40 else "low"

    nearest_cool = cool_spots[0]
    nearest_hot  = heat_zones[0]

    return {
        "level":               level,
        "score":               score,
        "temperature":         real_temp,
        "humidity":            humidity,
        "apparent_temperature":apparent_temp,
        "weather_code":        weather.get("weather_code"),
        "wind_speed":          weather.get("wind_speed"),
        "weather_time":        weather.get("time"),
        "zone":                resolve_zone_name(lat, lng),
        "method":              "lcz_plus_open_meteo",
        "nearestRefuge": {
            "name":     nearest_cool["name"],
            "distance": nearest_cool["distance"],
            "walkTime": nearest_cool["walkTime"],
            "lat":      nearest_cool["lat"],
            "lng":      nearest_cool["lng"],
        },
        "nearestHotZone": {
            "name":     nearest_hot["name"],
            "distance": nearest_hot["distance"],
            "risk":     nearest_hot["risk"],
        },
    }


@app.get("/api/cool-spots")
def cool_spots(
    lat:   float = Query(BORDEAUX_LAT),
    lng:   float = Query(BORDEAUX_LNG),
    limit: int   = Query(20, ge=1, le=100),
):
    return with_live_distance(get_cool_spots(), lat, lng)[:limit]


@app.get("/api/heat-zones")
def heat_zones(
    lat:   float = Query(BORDEAUX_LAT),
    lng:   float = Query(BORDEAUX_LNG),
    limit: int   = Query(20, ge=1, le=100),
):
    return with_live_distance(get_heat_zones(), lat, lng)[:limit]


@app.get("/api/water-stations")
def water_stations(
    lat:    float = Query(BORDEAUX_LAT),
    lng:    float = Query(BORDEAUX_LNG),
    offset: int   = Query(0, ge=0),
    limit:  int   = Query(20, ge=1, le=1000),
):
    stations = with_live_distance(get_water_stations(), lat, lng)
    return stations[offset: offset + limit]


@app.get("/api/water-stations/count")
def water_stations_count():
    return {"count": len(get_water_stations())}


@app.get("/api/alerts")
async def get_alerts(
    lat: float = Query(BORDEAUX_LAT),
    lng: float = Query(BORDEAUX_LNG),
):
    risk = await get_risks(lat=lat, lng=lng)

    is_active      = risk["score"] >= 40
    vigilance_type = "high" if risk["score"] >= 70 else "medium" if risk["score"] >= 40 else "low"

    return [
        {
            "id":       1,
            "type":     vigilance_type,
            "title":    "Alerte chaleur élevée" if is_active else "Situation thermique stable",
            "message":  (
                f"Indice local estimé à {risk['score']}/100 autour de {risk['zone']}."
                + (" Rejoignez une zone fraîche proche." if is_active else " Restez hydraté et surveillez l'évolution météo.")
            ),
            "time":     "Source LCZ 2022 + météo temps réel",
            "isActive": is_active,
        },
        {
            "id":       2,
            "type":     "medium",
            "title":    "Refuge frais le plus proche",
            "message":  f"{risk['nearestRefuge']['name']} à {risk['nearestRefuge']['distance']} m, environ {risk['nearestRefuge']['walkTime']} min à pied.",
            "time":     "Calcul dynamique",
            "isActive": is_active,
        },
    ]


@app.get("/api/tips")
def get_tips():
    return [
        {
            "category": "Hydratation",
            "tips": [
                "Buvez de l'eau régulièrement, même sans soif.",
                "Gardez une bouteille d'eau avec vous.",
                "Évitez l'alcool pendant les fortes chaleurs.",
            ],
        },
        {
            "category": "Déplacements",
            "tips": [
                "Cherchez les zones ombragées ou végétalisées.",
                "Réduisez les trajets entre 12 h et 16 h.",
                "Privilégiez les trajets courts vers les refuges frais.",
            ],
        },
    ]


@app.get("/api/route-safe/{spot_id}")
def get_route_safe(
    spot_id: int,
    lat: float = Query(BORDEAUX_LAT),
    lng: float = Query(BORDEAUX_LNG),
):
    spots = with_live_distance(get_cool_spots(), lat, lng)
    spot  = next((s for s in spots if s["id"] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")

    return {
        "spot_id":        spot_id,
        "destination":    spot["name"],
        "distance":       spot["distance"],
        "walkTime":       spot["walkTime"],
        "safety":         "safe" if spot["distance"] <= 1500 else "moderate",
        "destinationLat": spot["lat"],
        "destinationLng": spot["lng"],
        "instructions": [
            "Suivez un trajet le plus direct possible vers la zone fraîche.",
            "Privilégiez les rues ombragées et faites des pauses si nécessaire.",
            "Hydratez-vous pendant le trajet et limitez l'effort physique.",
        ],
    }
