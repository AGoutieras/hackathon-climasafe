from __future__ import annotations

import json
from functools import lru_cache
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.cities import (
    DEFAULT_CITY_KEY,
    get_city_config,
    haversine_km as city_haversine_km,
    infer_city_key,
    list_cities,
    load_cool_spots,
    load_heat_zones,
    load_water_stations,
    resolve_zone_name as resolve_city_zone_name,
)
from app.services.weather import fetch_current_weather
from app.services.user_risk import UserProfile, personalise_risk

DEFAULT_CITY = get_city_config(DEFAULT_CITY_KEY)
DEFAULT_LAT = DEFAULT_CITY.latitude
DEFAULT_LNG = DEFAULT_CITY.longitude

app = FastAPI(title="ClimaSafe API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return city_haversine_km(lat1, lon1, lat2, lon2)


def with_live_distance(
    items: list[dict],
    user_lat: float,
    user_lng: float,
) -> list[dict]:
    enriched = []
    for item in items:
        km = haversine_km(user_lat, user_lng, item["lat"], item["lng"])
        distance_m = int(round(km * 1000))
        enriched.append(
            {
                **item,
                "distance": distance_m,
                "distanceToUserKm": round(km, 2),
                "walkTime": max(2, round(distance_m / 80)),
            }
        )
    return sorted(enriched, key=lambda item: item["distance"])


@lru_cache(maxsize=512)
def _reverse_city_name(lat_key: float, lng_key: float) -> str | None:
    user_agent = "climasafe/1.0 (+hackathon)"
    params = urlencode(
        {
            "format": "jsonv2",
            "lat": lat_key,
            "lon": lng_key,
            "accept-language": "fr",
        }
    )

    try:
        request = Request(
            f"https://nominatim.openstreetmap.org/reverse?{params}",
            headers={"User-Agent": user_agent},
        )
        with urlopen(request, timeout=3) as response:
            addr = json.loads(response.read().decode()).get("address", {})
            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("municipality")
            )
            if city:
                return city
    except (URLError, TimeoutError, ValueError):
        pass

    params = urlencode(
        {"lat": lat_key, "lon": lng_key, "type": "municipality"}
    )
    try:
        request = Request(
            f"https://api-adresse.data.gouv.fr/reverse/?{params}",
            headers={"User-Agent": user_agent},
        )
        with urlopen(request, timeout=3) as response:
            features = json.loads(response.read().decode()).get("features", [])
            if features:
                props = features[0].get("properties", {})
                return props.get("city") or props.get("name")
    except (URLError, TimeoutError, ValueError):
        pass

    return None


def resolve_location_name(lat: float, lng: float) -> str:
    city = _reverse_city_name(round(lat, 4), round(lng, 4))
    if city:
        return city

    city_key = infer_city_key(lat, lng)
    return resolve_city_zone_name(lat, lng, city_key)


def _thermal_score(temp: float) -> int:
    thresholds = [
        (0, 0),
        (8, 3),
        (16, 8),
        (20, 12),
        (24, 18),
        (27, 24),
        (30, 34),
        (33, 48),
        (36, 68),
    ]
    for limit, score in reversed(thresholds):
        if temp >= limit:
            return score
    return 82


def compute_risk_score(
    real_temp: float,
    humidity: float,
    apparent_temp: float,
    hot_nearby: int,
    cool_nearby: int,
) -> int:
    score = _thermal_score(real_temp)

    urban_cap = 20
    if real_temp < 22:
        urban_cap = 6
    elif real_temp < 30:
        urban_cap = 10
    elif real_temp < 35:
        urban_cap = 14

    score += min(urban_cap, max(-10, hot_nearby * 2 - cool_nearby * 2))

    if real_temp >= 26:
        score += 6 if humidity >= 75 else 3 if humidity >= 60 else 0

    if real_temp >= 30:
        score += 6 if apparent_temp >= 40 else 3 if apparent_temp >= 36 else 0

    if real_temp < 20:
        score = min(score, 25)
    elif real_temp < 24:
        score = min(score, 35)

    return min(95, max(5, score))


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/data-sources")
def data_sources():
    return {
        "project": "ClimaSafe",
        "defaultCity": DEFAULT_CITY.key,
        "cities": [
            {
                "key": city.key,
                "name": city.display_name,
                "label": city.label,
                "center": {"lat": city.latitude, "lng": city.longitude},
                "datasets": sorted(city.datasets.keys()),
            }
            for city in list_cities()
        ],
    }


@app.get("/api/weather")
async def get_weather(
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
):
    return await fetch_current_weather(lat, lng)


@app.get("/api/risks")
async def get_risks(
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
    city: str | None = Query(None),
    age: int | None = Query(None),
    heart_disease: bool = Query(False),
    diabetes: bool = Query(False),
    pregnant: bool = Query(False),
    activity: str = Query("light"),
    air_conditioned: bool = Query(False),
    overheated_housing: bool = Query(False),
):
    city_key = infer_city_key(lat, lng, city)
    cool_spots = with_live_distance(load_cool_spots(city_key), lat, lng)
    heat_zones = with_live_distance(load_heat_zones(city_key), lat, lng)

    hot_nearby = sum(1 for zone in heat_zones if zone["distance"] <= 1000)
    cool_nearby = sum(1 for spot in cool_spots if spot["distance"] <= 1000)

    weather = await fetch_current_weather(lat, lng)
    real_temp = weather.get("temperature") or 30
    humidity = weather.get("humidity") or 45
    apparent_temp = weather.get("apparent_temperature") or real_temp

    score = compute_risk_score(
        real_temp,
        humidity,
        apparent_temp,
        hot_nearby,
        cool_nearby,
    )
    level = "high" if score >= 70 else "medium" if score >= 40 else "low"

    profile = UserProfile(
        age=age,
        heart_disease=heart_disease,
        diabetes=diabetes,
        pregnant=pregnant,
        activity=activity,
        air_conditioned=air_conditioned,
        overheated_housing=overheated_housing,
    )
    personalised = personalise_risk(score, profile)

    nearest_cool = cool_spots[0]
    nearest_hot = heat_zones[0]

    return {
        "level": level,
        "score": score,
        "temperature": real_temp,
        "humidity": humidity,
        "apparent_temperature": apparent_temp,
        "weather_code": weather.get("weather_code"),
        "wind_speed": weather.get("wind_speed"),
        "weather_time": weather.get("time"),
        "zone": resolve_city_zone_name(lat, lng, city_key),
        "method": "lcz_plus_open_meteo",
        "personalized": personalised,
        "nearestRefuge": {
            "name": nearest_cool["name"],
            "distance": nearest_cool["distance"],
            "walkTime": nearest_cool["walkTime"],
            "lat": nearest_cool["lat"],
            "lng": nearest_cool["lng"],
        },
        "nearestHotZone": {
            "name": nearest_hot["name"],
            "distance": nearest_hot["distance"],
            "risk": nearest_hot["risk"],
        },
    }


@app.get("/api/cool-spots")
def cool_spots(
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
    limit: int = Query(20, ge=1, le=100),
    city: str | None = Query(None),
):
    city_key = infer_city_key(lat, lng, city)
    spots = load_cool_spots(city_key)
    return with_live_distance(spots, lat, lng)[:limit]


@app.get("/api/heat-zones")
def heat_zones(
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
    limit: int = Query(20, ge=1, le=100),
    city: str | None = Query(None),
):
    city_key = infer_city_key(lat, lng, city)
    zones = load_heat_zones(city_key)
    return with_live_distance(zones, lat, lng)[:limit]


@app.get("/api/water-stations")
def water_stations(
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    city: str | None = Query(None),
):
    city_key = infer_city_key(lat, lng, city)
    stations = with_live_distance(load_water_stations(city_key), lat, lng)
    return stations[offset: offset + limit]


@app.get("/api/water-stations/count")
def water_stations_count(city: str | None = Query(None)):
    city_key = infer_city_key(DEFAULT_LAT, DEFAULT_LNG, city)
    return {"count": len(load_water_stations(city_key))}


@app.get("/api/alerts")
async def get_alerts(
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
    city: str | None = Query(None),
):
    risk = await get_risks(
        lat=lat,
        lng=lng,
        city=city,
        age=None,
        heart_disease=False,
        diabetes=False,
        pregnant=False,
        activity="light",
        air_conditioned=False,
        overheated_housing=False,
    )

    is_active = risk["score"] >= 40
    vigilance_type = "high"
    if risk["score"] < 70:
        vigilance_type = "medium" if risk["score"] >= 40 else "low"

    return [
        {
            "id": 1,
            "type": vigilance_type,
            "title": (
                "Alerte chaleur élevée"
                if is_active
                else "Situation thermique stable"
            ),
            "message": (
                "Indice local estimé à "
                f"{risk['score']}/100 autour de {risk['zone']}."
                + (
                    " Rejoignez une zone fraîche proche."
                    if is_active
                    else " Restez hydraté et surveillez l'évolution météo."
                )
            ),
            "time": "Source LCZ 2022 + météo temps réel",
            "isActive": is_active,
        },
        {
            "id": 2,
            "type": "medium",
            "title": "Refuge frais le plus proche",
            "message": (
                f"{risk['nearestRefuge']['name']} à "
                f"{risk['nearestRefuge']['distance']} m, "
                f"environ {risk['nearestRefuge']['walkTime']} min à pied."
            ),
            "time": "Calcul dynamique",
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
    lat: float = Query(DEFAULT_LAT),
    lng: float = Query(DEFAULT_LNG),
    city: str | None = Query(None),
):
    city_key = infer_city_key(lat, lng, city)
    spots = with_live_distance(load_cool_spots(city_key), lat, lng)
    spot = next((item for item in spots if item["id"] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")

    return {
        "spot_id": spot_id,
        "destination": spot["name"],
        "distance": spot["distance"],
        "walkTime": spot["walkTime"],
        "safety": "safe" if spot["distance"] <= 1500 else "moderate",
        "destinationLat": spot["lat"],
        "destinationLng": spot["lng"],
        "instructions": [
            "Suivez un trajet le plus direct possible vers la zone fraîche.",
            "Privilégiez les rues ombragées et faites des pauses si "
            "nécessaire.",
            "Hydratez-vous pendant le trajet et limitez l'effort physique.",
        ],
    }
