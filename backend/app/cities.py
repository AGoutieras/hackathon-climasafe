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
            )
        },
        transforms={
            "heat_zones": _normalize_paris_heat_zones,
            "water_stations": _normalize_paris_water_stations,
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
    offset = int(base_query.get("offset", 0) or 0)
    limit = int(base_query.get("limit", 100) or 100)

    records = []
    total_count = None
    while True:
        query = dict(base_query)
        query["offset"] = str(offset)
        query["limit"] = str(limit)
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
            page_records = payload.get("results", [])
            total_count = payload.get("total_count", total_count)
        else:
            page_records = []
        records.extend(page_records)

        if not page_records:
            break

        offset += len(page_records)
        if total_count is not None and offset >= total_count:
            break
        if len(page_records) < limit:
            break

    return {"results": records}


@lru_cache(maxsize=128)
def load_city_dataset(city_key: str, dataset_name: str) -> list[dict]:
    city = get_city_config(city_key)
    filename = city.datasets.get(dataset_name)
    if not filename:
        remote_url = city.remote_datasets.get(dataset_name)
        if not remote_url:
            return []
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
    return load_city_dataset(city_key, "cool_spots")


def load_heat_zones(city_key: str) -> list[dict]:
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
