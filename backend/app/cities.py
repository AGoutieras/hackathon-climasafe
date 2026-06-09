from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import lru_cache
from math import atan2, cos, radians, sin, sqrt
from pathlib import Path
from typing import Callable
from urllib.error import URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"

CityDatasetTransform = Callable[[list[dict], "CityConfig"], list[dict]]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    return radius_km * 2 * atan2(sqrt(a), sqrt(1 - a))


@dataclass(frozen=True)
class CityConfig:
    key: str
    display_name: str
    label: str
    latitude: float
    longitude: float
    datasets: dict[str, str]
    remote_datasets: dict[str, str] = field(default_factory=dict)
    transforms: dict[str, CityDatasetTransform] = field(default_factory=dict)


def _normalize_water_stations(raw: list[dict], _: CityConfig) -> list[dict]:
    return [
        {**item, "lat": item["geom"]["lat"], "lng": item["geom"]["lon"]}
        for item in raw
    ]


def _normalize_paris_water_stations(
    raw: list[dict],
    city: CityConfig,
) -> list[dict]:
    stations = []
    for index, item in enumerate(raw, start=1):
        geo = item.get("geo_point_2d") or {}
        lat = geo.get("lat")
        lng = geo.get("lon")
        if lat is None or lng is None:
            continue

        number = item.get("no_voirie_pair") or item.get("no_voirie_impair")
        address_parts = []
        if number:
            address_parts.append(str(number))
        if item.get("voie"):
            address_parts.append(item["voie"])
        if item.get("commune"):
            address_parts.append(item["commune"])

        stations.append(
            {
                "id": int(item.get("gid") or index),
                "nom_fontaine": (
                    item.get("voie")
                    or item.get("type_objet")
                    or f"Fontaine {index}"
                ),
                "nombre_robinets": 1,
                "modele_fontaine": (
                    item.get("modele")
                    or item.get("type_objet")
                    or "Fontaine"
                ),
                "adresse": ", ".join(address_parts) or city.display_name,
                "date_dernier_controle": item.get("debut_ind"),
                "etat": (
                    "fonctionnelle"
                    if item.get("dispo") == "OUI"
                    else "indisponible"
                ),
                "hivernage": "non",
                "complement_information": item.get("motif_ind"),
                "lat": lat,
                "lng": lng,
                "geom": {"lon": lng, "lat": lat},
                "code_insee": None,
            }
        )

    return stations


def _normalize_paris_heat_zones(
    raw: list[dict],
    city: CityConfig,
) -> list[dict]:
    zones = []
    for index, item in enumerate(raw, start=1):
        flux = item.get("flux_chaleur", 0) or 0
        day_risk = item.get("alea_jour", 0) or 0
        night_risk = item.get("alea_nuit", 0) or 0

        if flux >= 60 or night_risk >= 22:
            risk = "very_high"
        elif flux >= 30 or night_risk >= 18:
            risk = "high"
        elif flux > 0 or day_risk >= 8:
            risk = "medium"
        else:
            risk = "low"

        zones.append(
            {
                "id": index,
                "name": f"Îlot {city.display_name} {index}",
                "sourceClass": item.get("lcz") or item.get("type_lcz") or "?",
                "risk": risk,
                "distanceToCenterKm": round(
                    haversine_km(
                        item["lat"],
                        item["lng"],
                        city.latitude,
                        city.longitude,
                    ),
                    3,
                ),
                "areaM2": int(item.get("area", 0)),
                "lat": item["lat"],
                "lng": item["lng"],
            }
        )

    return zones


def _normalize_iledefrance_heat_zones(
    raw: list[dict],
    city: CityConfig,
) -> list[dict]:
    zones = []
    for index, item in enumerate(raw, start=1):
        if isinstance(item, dict) and "fields" in item:
            fields = item["fields"]
        else:
            fields = item

        geo_point = fields.get("geo_point_2d") or item.get(
            "geo_point_2d") or {}
        if isinstance(geo_point, dict):
            lat = geo_point.get("lat")
            lng = geo_point.get("lon")
        elif isinstance(geo_point, (list, tuple)) and len(geo_point) >= 2:
            lat, lng = geo_point[0], geo_point[1]
        else:
            lat = None
            lng = None

        if lat is None or lng is None:
            geo_shape = fields.get("geo_shape", item.get(
                "geo_shape", {})).get("geometry", {})
            coordinates = geo_shape.get("coordinates") or []
            try:
                lng, lat = coordinates[0][0][0][:2]
            except (IndexError, TypeError):
                continue

        flux = fields.get("flux_chale", fields.get("flux_chaleur", 0)) or 0
        day_risk = fields.get("aleaj_note", 0) or 0
        night_risk = fields.get("alean_note", 0) or 0

        if flux >= 60 or night_risk >= 22:
            risk = "very_high"
        elif flux >= 30 or night_risk >= 18:
            risk = "high"
        elif flux > 0 or day_risk >= 8:
            risk = "medium"
        else:
            risk = "low"

        zones.append(
            {
                "id": fields.get("code_imu") or index,
                "name": f"Îlot {city.display_name} {index}",
                "sourceClass": fields.get("lcz1") or fields.get("type_lcz") or "?",
                "risk": risk,
                "distanceToCenterKm": round(
                    haversine_km(lat, lng, city.latitude, city.longitude),
                    3,
                ),
                "areaM2": int(fields.get("st_areasha", 0) or 0),
                "lat": lat,
                "lng": lng,
            }
        )

    return zones


def _normalize_paris_cool_spots_green(
    raw: list[dict],
    city: CityConfig,
) -> list[dict]:
    """Normalize Paris green cool spots (espaces verts frais) from OpenData."""
    spots = []

    for index, item in enumerate(raw, start=1):
        # Extract coordinates
        geo_shape = item.get("geo_shape") or {}
        geometry = geo_shape.get("geometry") or {}

        # Handle polygon coordinates (first polygon, first ring, first coordinate)
        coordinates = geometry.get("coordinates")
        if not coordinates:
            continue

        try:
            if isinstance(coordinates[0][0], list):  # Polygon
                # First coordinate of first ring
                lon, lat = coordinates[0][0][0][:2]
            else:  # Fallback
                continue
        except (IndexError, TypeError):
            continue

        vegetation_ratio = (
            item.get("proportion_vegetation_haute") or 0) / 100.0
        # Score based on vegetation density: 50-100
        coolness_score = 50 + int(vegetation_ratio * 50)

        # Type mapping for categorization
        type_map = {
            "Jardiniere": "garden",
            "Parc": "park",
            "Square": "park",
            "Jardin": "park",
            "Allée": "path",
        }
        spot_type = type_map.get(item.get("categorie", ""), "park")

        spots.append(
            {
                "id": item.get("identifiant", f"green-{index}"),
                "name": item.get("nom", f"Espace vert {index}"),
                "type": spot_type,
                "category": item.get("categorie", "Jardin"),
                "sourceClass": "green_space",
                "coolnessScore": coolness_score,
                "estimatedTemperature": None,
                "distanceToCenterKm": round(
                    haversine_km(lat, lon, city.latitude, city.longitude),
                    3,
                ),
                "address": item.get("adresse", f"Paris {item.get('arrondissement', '')}"),
                "arrondissement": item.get("arrondissement"),
                "vegetation_height_percent": item.get("proportion_vegetation_haute"),
                "open_24h": item.get("ouvert_24h") == "Oui",
                "lat": lat,
                "lng": lon,
            }
        )

    return spots


def _normalize_paris_cool_spots_amenities(
    raw: list[dict],
    city: CityConfig,
) -> list[dict]:
    """Normalize Paris cool spot amenities/activities from OpenData."""
    spots = []

    for index, item in enumerate(raw, start=1):
        # Extract coordinates from geo_point_2d
        geo_point = item.get("geo_point_2d") or {}
        lat = geo_point.get("lat")
        lon = geo_point.get("lon")

        if lat is None or lon is None:
            continue

        # Determine amenity type and score cooling potential
        item_type = (item.get("type") or "").lower()
        if not item_type:
            continue

        # Scoring based on cooling amenities
        type_scores = {
            "ombri": 85,  # Shade structures
            "ombre": 85,
            "eau": 90,    # Water features
            "bassin": 90,
            "fontaine": 90,
            "piscine": 95,
            "lac": 90,
            "jardin": 80,
            "parc": 80,
            "lieux de culte": 70,  # Religious buildings (shelters)
            "bâtiment": 65,
            "équipement": 70,
        }

        # Find matching score
        coolness_score = 70  # Default
        for key, score in type_scores.items():
            if key in item_type:
                coolness_score = score
                break

        # Map types to categories
        type_map = {
            "ombri": "shelter",
            "ombre": "shelter",
            "eau": "water",
            "bassin": "water",
            "fontaine": "water",
            "piscine": "pool",
            "lac": "water",
            "jardin": "garden",
            "parc": "park",
            "lieux de culte": "shelter",
            "bâtiment": "building",
        }

        spot_type = "amenity"
        for key, value in type_map.items():
            if key in item_type:
                spot_type = value
                break

        spots.append(
            {
                "id": item.get("identifiant", f"amenity-{index}"),
                "name": item.get("nom", f"Équipement {index}"),
                "type": spot_type,
                "category": item.get("type", "Équipement"),
                "sourceClass": "amenity",
                "coolnessScore": coolness_score,
                "estimatedTemperature": None,
                "distanceToCenterKm": round(
                    haversine_km(lat, lon, city.latitude, city.longitude),
                    3,
                ),
                "address": item.get("adresse", f"Paris {item.get('arrondissement', '')}"),
                "arrondissement": item.get("arrondissement"),
                "payant": item.get("payant", "Non"),
                "lat": lat,
                "lng": lon,
            }
        )

    return spots


def _merge_paris_cool_spots(raw: list[list[dict]], city: CityConfig) -> list[dict]:
    """Merge multiple cool spot data sources for Paris.

    This is a special merger function that combines:
    - Green spaces (espaces verts frais)
    - Amenities/activities (équipements et activités)
    """
    # Flatten and combine all sources
    all_spots = []
    for source_spots in raw:
        if isinstance(source_spots, list):
            all_spots.extend(source_spots)

    # Sort by coolness score descending
    all_spots.sort(key=lambda x: x.get("coolnessScore", 0), reverse=True)

    return all_spots


CITY_CONFIGS: dict[str, CityConfig] = {
    "bordeaux": CityConfig(
        key="bordeaux",
        display_name="Bordeaux",
        label="Bordeaux Métropole",
        latitude=44.837789,
        longitude=-0.57918,
        datasets={
            "cool_spots": "bdx_cool_spots.json",
            "heat_zones": "bdx_heat_zones.json",
            "water_stations": "bdx_water_stations.json",
        },
        transforms={"water_stations": _normalize_water_stations},
    ),
    "paris": CityConfig(
        key="paris",
        display_name="Paris",
        label="Paris",
        latitude=48.8566,
        longitude=2.3522,
        datasets={
            "heat_zones": "paris_14_15_propre.json",
        },
        remote_datasets={
            "water_stations": (
                "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
                "fontaines-a-boire/records?limit=100&offset=0"
            ),
            "cool_spots_green": (
                "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
                "ilots-de-fraicheur-espaces-verts-frais/records?limit=100&offset=0"
            ),
            "cool_spots_amenities": (
                "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
                "ilots-de-fraicheur-equipements-activites/records?limit=100&offset=0"
            ),
            "heat_zones_if": (
                "https://data.iledefrance.fr/api/records/1.0/search/?"
                "dataset=ilots-de-chaleur-urbains-icu-classification-des-imu-en-zone-climatique-locale-lc&rows=1000&start=0"
            ),
        },
        transforms={
            "heat_zones": _normalize_paris_heat_zones,
            "heat_zones_if": _normalize_iledefrance_heat_zones,
            "water_stations": _normalize_paris_water_stations,
            "cool_spots_green": _normalize_paris_cool_spots_green,
            "cool_spots_amenities": _normalize_paris_cool_spots_amenities,
        },
    ),
}

DEFAULT_CITY_KEY = (
    os.environ.get("CLIMASAFE_DEFAULT_CITY")
    or os.environ.get("CLIMASAFE_DEFAULT")
    or "bordeaux"
).strip().lower()


def list_cities() -> list[CityConfig]:
    return list(CITY_CONFIGS.values())


def get_city_config(city_key: str | None = None) -> CityConfig:
    if not city_key:
        return CITY_CONFIGS[DEFAULT_CITY_KEY]
    normalized = city_key.strip().lower()
    return CITY_CONFIGS.get(normalized, CITY_CONFIGS[DEFAULT_CITY_KEY])


@lru_cache(maxsize=128)
def _load_json(filename: str):
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))


@lru_cache(maxsize=128)
def _load_remote_json(url: str):
    parts = urlsplit(url)
    base_query = dict(parse_qsl(parts.query, keep_blank_values=True))
    offset_key = "start" if "start" in base_query else "offset"
    limit_key = "rows" if "rows" in base_query else "limit"
    offset = int(base_query.get(offset_key, 0) or 0)
    limit = int(base_query.get(limit_key, 100) or 100)
    first_page_only = offset == 0 and limit_key in base_query

    records = []
    total_count = None
    while True:
        query = dict(base_query)
        query[offset_key] = str(offset)
        query[limit_key] = str(limit)
        page_url = urlunsplit(
            (
                parts.scheme,
                parts.netloc,
                parts.path,
                urlencode(query),
                parts.fragment,
            )
        )
        request = Request(
            page_url,
            headers={"User-Agent": "climasafe/1.0 (+hackathon)"},
        )
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))

        if isinstance(payload, dict):
            if "records" in payload:
                page_records = payload.get("records", [])
                total_count = payload.get("nhits", total_count)
            else:
                page_records = payload.get("results", [])
                total_count = payload.get("total_count", total_count)
        else:
            page_records = []
        records.extend(page_records)

        if not page_records:
            break
        if first_page_only:
            break

        offset += len(page_records)
        if total_count is not None and offset >= total_count:
            break
        if len(page_records) < limit:
            break

    return {"results": records}


def _merge_url_query(url: str, extra_query: str) -> str:
    parts = urlsplit(url)
    base_query = dict(parse_qsl(parts.query, keep_blank_values=True))
    extra = dict(parse_qsl(extra_query, keep_blank_values=True))
    base_query.update(extra)
    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(base_query),
            parts.fragment,
        )
    )


@lru_cache(maxsize=128)
def load_city_dataset(
    city_key: str,
    dataset_name: str,
    extra_query: str = "",
) -> list[dict]:
    city = get_city_config(city_key)
    filename = city.datasets.get(dataset_name)
    if not filename:
        remote_url = city.remote_datasets.get(dataset_name)
        if not remote_url:
            return []
        if extra_query:
            remote_url = _merge_url_query(remote_url, extra_query)
        try:
            payload = _load_remote_json(remote_url)
        except (URLError, TimeoutError, ValueError):
            return []
        raw = (
            payload.get("results", [])
            if isinstance(payload, dict)
            else payload
        )
    else:
        raw = _load_json(filename)

    transform = city.transforms.get(dataset_name)
    if transform:
        return transform(raw, city)
    return raw


def load_cool_spots(city_key: str) -> list[dict]:
    """Load cool spots for a city.

    For Paris, this merges green spaces and amenities from OpenData.
    For other cities, loads from local JSON.
    """
    city = get_city_config(city_key)

    # Special handling for Paris: merge multiple sources
    if city.key == "paris":
        spots = []

        # Load green spaces
        try:
            green_spots = load_city_dataset(city_key, "cool_spots_green")
            spots.extend(green_spots)
        except Exception:
            pass

        # Load amenities
        try:
            amenity_spots = load_city_dataset(city_key, "cool_spots_amenities")
            spots.extend(amenity_spots)
        except Exception:
            pass

        # Sort by coolness score descending
        spots.sort(key=lambda x: x.get("coolnessScore", 0), reverse=True)
        return spots

    # For other cities, use standard dataset loader
    return load_city_dataset(city_key, "cool_spots")


def _heat_zones_query(lat: float, lng: float, radius_m: int, limit: int = 1000) -> str:
    return f"geofilter.distance={lat},{lng},{radius_m}&rows={limit}&start=0"


def load_heat_zones(
    city_key: str,
    lat: float | None = None,
    lng: float | None = None,
) -> list[dict]:
    city = get_city_config(city_key)
    if city.key == "paris":
        if lat is not None and lng is not None:
            for radius in (1000, 2000, 5000):
                try:
                    zones = load_city_dataset(
                        city_key,
                        "heat_zones_if",
                        _heat_zones_query(lat, lng, radius),
                    )
                except Exception:
                    zones = []

                if len(zones) >= 20 or radius == 5000:
                    return zones

        zones = []
        try:
            zones.extend(load_city_dataset(city_key, "heat_zones"))
        except Exception:
            pass
        try:
            if lat is not None and lng is not None:
                zones.extend(
                    load_city_dataset(
                        city_key,
                        "heat_zones_if",
                        _heat_zones_query(lat, lng, 5000),
                    )
                )
            else:
                zones.extend(load_city_dataset(city_key, "heat_zones_if"))
        except Exception:
            pass
        return zones

    return load_city_dataset(city_key, "heat_zones")


def load_water_stations(city_key: str) -> list[dict]:
    return load_city_dataset(city_key, "water_stations")


def infer_city_key(lat: float, lng: float, fallback: str | None = None) -> str:
    candidate = fallback or DEFAULT_CITY_KEY
    nearest_key = candidate
    nearest_distance = float("inf")

    for city in CITY_CONFIGS.values():
        distance = haversine_km(lat, lng, city.latitude, city.longitude)
        if distance < nearest_distance:
            nearest_key = city.key
            nearest_distance = distance

    return nearest_key if nearest_distance <= 25 else candidate


def resolve_zone_name(
    lat: float,
    lng: float,
    city_key: str | None = None,
) -> str:
    city = get_city_config(city_key or infer_city_key(lat, lng))
    distance_to_city = haversine_km(lat, lng, city.latitude, city.longitude)
    if distance_to_city > 25:
        return "Ville inconnue"

    delta_lat = lat - city.latitude
    delta_lng = lng - city.longitude
    threshold = 0.003

    if abs(delta_lat) < threshold and abs(delta_lng) < threshold:
        return f"{city.display_name} Centre"

    north_south = (
        "Nord"
        if delta_lat >= threshold
        else "Sud"
        if delta_lat <= -threshold
        else ""
    )
    east_west = (
        "Est"
        if delta_lng >= threshold
        else "Ouest"
        if delta_lng <= -threshold
        else ""
    )

    if north_south and east_west:
        return f"{city.display_name} {north_south}-{east_west}"
    if north_south or east_west:
        return f"{city.display_name} {north_south or east_west}"
    return city.display_name
