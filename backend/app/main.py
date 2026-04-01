from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

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


@app.get('/api/risks')
def get_risks(
    lat: float = Query(BORDEAUX_CENTER['lat']),
    lng: float = Query(BORDEAUX_CENTER['lng']),
):
    cool_spots = with_live_distance(get_cool_spots(), lat, lng)
    heat_zones = with_live_distance(get_heat_zones(), lat, lng)

    nearest_cool = cool_spots[0]
    nearest_hot = heat_zones[0]

    hot_nearby = sum(1 for z in heat_zones if z['distance'] <= 1000)
    cool_nearby = sum(1 for s in cool_spots if s['distance'] <= 1000)
    score = min(95, max(20, 55 + hot_nearby * 7 - cool_nearby * 4))
    if score >= 80:
        level = 'high'
    elif score >= 60:
        level = 'medium'
    else:
        level = 'low'

    return {
        'level': level,
        'score': score,
        'temperature': 38 if level == 'high' else 34 if level == 'medium' else 30,
        'humidity': 25,
        'zone': BORDEAUX_CENTER['name'],
        'method': 'proxy_from_uploaded_lcz_data',
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
def get_alerts():
    risk = get_risks()
    return [
        {
            'id': 1,
            'type': 'high' if risk['score'] >= 80 else 'medium',
            'title': 'Alerte chaleur élevée',
            'message': f"Indice local estimé à {risk['score']}/100 autour de {risk['zone']}. Rejoignez une zone fraîche proche.",
            'time': 'Source LCZ 2022 + logique app',
            'isActive': True,
        },
        {
            'id': 2,
            'type': 'medium',
            'title': 'Refuge frais le plus proche',
            'message': f"{risk['nearestRefuge']['name']} à {risk['nearestRefuge']['distance']} m, environ {risk['nearestRefuge']['walkTime']} min à pied.",
            'time': 'Calcul dynamique',
            'isActive': True,
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
