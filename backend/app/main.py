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

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / 'data'
BORDEAUX_CENTER = {"name": "Bordeaux Centre",
                   "lat": 44.837789, "lng": -0.57918}

app = FastAPI(title="Refuge API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def get_cool_spots():
    return load_json('cool_spots.json')


@lru_cache(maxsize=1)
def get_heat_zones():
    return load_json('heat_zones.json')


@lru_cache(maxsize=1)
def get_water_stations():
    data = load_json('water_stations.json')
    # Normalize geom field to lat/lng
    return [
        {**item, 'lat': item['geom']['lat'], 'lng': item['geom']['lon']}
        for item in data
    ]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * \
        cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def with_live_distance(items: list[dict], user_lat: float, user_lng: float) -> list[dict]:
    enriched = []
    for item in items:
        distance_km = haversine_km(
            user_lat, user_lng, item['lat'], item['lng'])
        distance_m = int(round(distance_km * 1000))
        clone = dict(item)
        clone['distance'] = distance_m
        clone['distanceToUserKm'] = round(distance_km, 2)
        clone['walkTime'] = max(2, round(distance_m / 80))
        enriched.append(clone)
    return sorted(enriched, key=lambda x: x['distance'])


def estimate_zone_name(user_lat: float, user_lng: float) -> str:
    lat_diff = user_lat - BORDEAUX_CENTER['lat']
    lng_diff = user_lng - BORDEAUX_CENTER['lng']

    # ~0.003 deg is roughly a few hundred meters in Bordeaux.
    if abs(lat_diff) < 0.003 and abs(lng_diff) < 0.003:
        return BORDEAUX_CENTER['name']

    if lat_diff >= 0.003:
        north_south = 'Nord'
    elif lat_diff <= -0.003:
        north_south = 'Sud'
    else:
        north_south = ''

    if lng_diff >= 0.003:
        east_west = 'Est'
    elif lng_diff <= -0.003:
        east_west = 'Ouest'
    else:
        east_west = ''

    if north_south and east_west:
        return f"Bordeaux {north_south}-{east_west}"
    if north_south:
        return f"Bordeaux {north_south}"
    if east_west:
        return f"Bordeaux {east_west}"
    return "Bordeaux"


@lru_cache(maxsize=512)
def reverse_city_name(lat_key: float, lng_key: float) -> str | None:
    user_agent = 'climasafe/1.0 (+hackathon)'

    # Primary: OSM Nominatim reverse geocoding
    nominatim_params = urlencode({
        'format': 'jsonv2',
        'lat': lat_key,
        'lon': lng_key,
        'accept-language': 'fr',
    })
    nominatim_url = f"https://nominatim.openstreetmap.org/reverse?{nominatim_params}"
    nominatim_request = Request(
        nominatim_url,
        headers={'User-Agent': user_agent}
    )

    try:
        with urlopen(nominatim_request, timeout=3) as response:
            payload = json.loads(response.read().decode('utf-8'))
        address = payload.get('address') or {}
        city = (
            address.get('city')
            or address.get('town')
            or address.get('village')
            or address.get('municipality')
        )
        if city:
            return city
    except (URLError, TimeoutError, ValueError):
        pass

    # Fallback: adresse.data.gouv.fr reverse
    ban_params = urlencode({
        'lat': lat_key,
        'lon': lng_key,
        'type': 'municipality',
    })
    ban_url = f"https://api-adresse.data.gouv.fr/reverse/?{ban_params}"
    ban_request = Request(
        ban_url,
        headers={'User-Agent': user_agent}
    )

    try:
        with urlopen(ban_request, timeout=3) as response:
            payload = json.loads(response.read().decode('utf-8'))
        features = payload.get('features') or []
        if not features:
            return None
        properties = features[0].get('properties') or {}
        return properties.get('city') or properties.get('name')
    except (URLError, TimeoutError, ValueError):
        return None


def resolve_zone_name(user_lat: float, user_lng: float) -> str:
    # Round coordinates to limit cache cardinality while keeping city precision.
    lat_key = round(user_lat, 4)
    lng_key = round(user_lng, 4)
    city_name = reverse_city_name(lat_key, lng_key)
    if city_name:
        return city_name

    distance_from_center_km = haversine_km(
        user_lat,
        user_lng,
        BORDEAUX_CENTER['lat'],
        BORDEAUX_CENTER['lng']
    )
    if distance_from_center_km > 25:
        return "Ville inconnue"

    return estimate_zone_name(user_lat, user_lng)


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.get('/api/data-sources')
def data_sources():
    return {
        'project': 'Refuge',
        'sources': [
            {
                'name': 'LCZ SPOT 2022 Bordeaux',
                'type': 'uploaded_shapefile',
                'description': 'Données LCZ/îlots chaleur-fraîcheur dérivées du fichier fourni par l’équipe.',
            },
            {
                'name': 'Espaces fraîcheur - Bordeaux Métropole',
                'type': 'official_web_map',
                'url': 'https://geo.bordeaux-metropole.fr/adws/app/33cebc9f-cd8e-11ed-ad24-9bf3b515cd35/?context=q3KX',
            },
            {
                'name': 'ri_icu_ifu_s',
                'type': 'official_dataset_identifier',
                'description': 'Jeu de données Bordeaux Métropole sur les îlots de chaleur ou de fraîcheur urbains basés sur l’analyse des températures de surface de 2022.',
            },
        ],
    }


@app.get('/api/weather')
async def get_weather(
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
):
    return await fetch_current_weather(lat, lng)


@app.get('/api/risks')
async def get_risks(
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
):
    cool_spots = with_live_distance(get_cool_spots(), lat, lng)
    heat_zones = with_live_distance(get_heat_zones(), lat, lng)

    nearest_cool = cool_spots[0]
    nearest_hot = heat_zones[0]

    hot_nearby = sum(1 for z in heat_zones if z['distance'] <= 1000)
    cool_nearby = sum(1 for s in cool_spots if s['distance'] <= 1000)

    weather = await fetch_current_weather(lat, lng)

    real_temp = weather.get("temperature")
    humidity = weather.get("humidity")
    apparent_temp = weather.get("apparent_temperature")

    # Keep safe defaults only when weather provider does not return a value.
    if real_temp is None:
        real_temp = 30
    if humidity is None:
        humidity = 45
    if apparent_temp is None:
        apparent_temp = real_temp

    if real_temp < 0:
        thermal_score = 0
    elif real_temp < 8:
        thermal_score = 3
    elif real_temp < 16:
        thermal_score = 8
    elif real_temp < 20:
        thermal_score = 12
    elif real_temp < 24:
        thermal_score = 18
    elif real_temp < 27:
        thermal_score = 24
    elif real_temp < 30:
        thermal_score = 34
    elif real_temp < 33:
        thermal_score = 48
    elif real_temp < 36:
        thermal_score = 68
    else:
        thermal_score = 82

    raw_urban_adjust = hot_nearby * 2 - cool_nearby * 2

    if real_temp < 22:
        urban_cap = 6
    elif real_temp < 30:
        urban_cap = 10
    elif real_temp < 35:
        urban_cap = 14
    else:
        urban_cap = 20

    urban_adjust = min(urban_cap, max(-10, raw_urban_adjust))

    if real_temp >= 26:
        humidity_adjust = 6 if humidity >= 75 else 3 if humidity >= 60 else 0
    else:
        humidity_adjust = 0

    if real_temp >= 30:
        apparent_adjust = 6 if apparent_temp >= 40 else 3 if apparent_temp >= 36 else 0
    else:
        apparent_adjust = 0

    score = thermal_score + urban_adjust + humidity_adjust + apparent_adjust

    if real_temp < 20:
        score = min(score, 25)
    elif real_temp < 24:
        score = min(score, 35)

    score = min(95, max(5, score))

    if score >= 70:
        level = 'high'
    elif score >= 40:
        level = 'medium'
    else:
        level = 'low'

    dynamic_zone = resolve_zone_name(lat, lng)

    return {
        'level': level,
        'score': score,
        'temperature': real_temp,
        'humidity': humidity,
        'apparent_temperature': apparent_temp,
        'weather_code': weather.get("weather_code"),
        'wind_speed': weather.get("wind_speed"),
        'weather_time': weather.get("time"),
        'zone': dynamic_zone,
        'method': 'lcz_plus_open_meteo',
        'nearestRefuge': {
            'name': nearest_cool['name'],
            'distance': nearest_cool['distance'],
            'walkTime': nearest_cool['walkTime'],
            'lat': nearest_cool['lat'],
            'lng': nearest_cool['lng'],
        },
        'nearestHotZone': {
            'name': nearest_hot['name'],
            'distance': nearest_hot['distance'],
            'risk': nearest_hot['risk'],
        },
    }


@app.get('/api/cool-spots')
def cool_spots(
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
    limit: int = Query(20, ge=1, le=100),
):
    return with_live_distance(get_cool_spots(), lat, lng)[:limit]


@app.get('/api/heat-zones')
def heat_zones(
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
    limit: int = Query(20, ge=1, le=100),
):
    return with_live_distance(get_heat_zones(), lat, lng)[:limit]


@app.get('/api/water-stations')
def water_stations(
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
):
    stations = with_live_distance(get_water_stations(), lat, lng)
    return stations[offset: offset + limit]


@app.get('/api/water-stations/count')
def water_stations_count():
    return {'count': len(get_water_stations())}


@app.get('/api/alerts')
async def get_alerts(
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
):
    risk = await get_risks(lat=lat, lng=lng)

    heat_alert_active = risk['score'] >= 40
    vigilance_type = 'high' if risk['score'] >= 70 else 'medium' if risk['score'] >= 40 else 'low'

    return [
        {
            'id': 1,
            'type': vigilance_type,
            'title': 'Alerte chaleur élevée' if heat_alert_active else 'Situation thermique stable',
            'message': f"Indice local estimé à {risk['score']}/100 autour de {risk['zone']}."
            + (' Rejoignez une zone fraîche proche.' if heat_alert_active else ' Restez hydraté et surveillez l’évolution météo.'),
            'time': 'Source LCZ 2022 + météo temps réel',
            'isActive': heat_alert_active,
        },
        {
            'id': 2,
            'type': 'medium',
            'title': 'Refuge frais le plus proche',
            'message': f"{risk['nearestRefuge']['name']} à {risk['nearestRefuge']['distance']} m, environ {risk['nearestRefuge']['walkTime']} min à pied.",
            'time': 'Calcul dynamique',
            'isActive': heat_alert_active,
        },
    ]


@app.get('/api/tips')
def get_tips():
    return [
        {
            'category': 'Hydratation',
            'tips': [
                'Buvez de l’eau régulièrement, même sans soif.',
                'Gardez une bouteille d’eau avec vous.',
                'Évitez l’alcool pendant les fortes chaleurs.',
            ],
        },
        {
            'category': 'Déplacements',
            'tips': [
                'Cherchez les zones ombragées ou végétalisées.',
                'Réduisez les trajets entre 12h et 16h.',
                'Privilégiez les trajets courts vers les refuges frais.',
            ],
        },
    ]


@app.get('/api/route-safe/{spot_id}')
def get_route_safe(
    spot_id: int,
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
):
    spots = with_live_distance(get_cool_spots(), lat, lng)
    spot = next((s for s in spots if s['id'] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail='Spot not found')

    instructions = [
        'Suivez un trajet le plus direct possible vers la zone fraîche.',
        'Privilégiez les rues ombragées et faites des pauses si nécessaire.',
        'Hydratez-vous pendant le trajet et limitez l’effort physique.',
    ]

    return {
        'spot_id': spot_id,
        'destination': spot['name'],
        'distance': spot['distance'],
        'walkTime': spot['walkTime'],
        'safety': 'safe' if spot['distance'] <= 1500 else 'moderate',
        'destinationLat': spot['lat'],
        'destinationLng': spot['lng'],
        'instructions': instructions,
    }
