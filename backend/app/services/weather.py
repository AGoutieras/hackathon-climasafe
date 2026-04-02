from __future__ import annotations

import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def fetch_current_weather(lat: float, lng: float) -> dict:
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "precipitation",
            "weather_code",
            "wind_speed_10m",
        ]),
        "timezone": "Europe/Paris",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()

        current = data.get("current", {})

        return {
            "temperature": current.get("temperature_2m"),
            "humidity": current.get("relative_humidity_2m"),
            "apparent_temperature": current.get("apparent_temperature"),
            "precipitation": current.get("precipitation"),
            "weather_code": current.get("weather_code"),
            "wind_speed": current.get("wind_speed_10m"),
            "time": current.get("time"),
            "source": "open-meteo",
        }

    except Exception:
        return {
            "temperature": None,
            "humidity": None,
            "apparent_temperature": None,
            "precipitation": None,
            "weather_code": None,
            "wind_speed": None,
            "time": None,
            "source": "fallback",
        }
