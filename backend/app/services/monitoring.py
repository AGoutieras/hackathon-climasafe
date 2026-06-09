from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Any

MONITORING_STORE: dict[str, dict[str, Any]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _enrich_monitoring(monitoring: dict[str, Any]) -> dict[str, Any]:
    last_check_in = datetime.fromisoformat(monitoring["last_check_in"])
    deadline = last_check_in + timedelta(hours=monitoring["interval_hours"])
    now = _now()
    minutes_remaining = int(round((deadline - now).total_seconds() / 60))

    if now >= deadline:
        status = "alert"
    elif now >= deadline - timedelta(minutes=30):
        status = "soon"
    else:
        status = "ok"

    return {
        **monitoring,
        "status": status,
        "nextCheckInIso": deadline.isoformat(),
        "minutesRemaining": minutes_remaining,
    }


def create_monitoring(
    name: str,
    age: int | None,
    interval_hours: float,
) -> dict[str, Any]:
    if not name.strip():
        raise ValueError("Le nom est requis")
    if interval_hours <= 0:
        raise ValueError("interval_hours doit être positif")

    now = _now()
    monitoring = {
        "id": uuid4().hex,
        "name": name.strip(),
        "age": age,
        "interval_hours": interval_hours,
        "last_check_in": _iso(now),
        "created_at": _iso(now),
    }
    MONITORING_STORE[monitoring["id"]] = monitoring
    return _enrich_monitoring(monitoring.copy())


def list_monitoring() -> list[dict[str, Any]]:
    return [
        _enrich_monitoring(item.copy())
        for item in sorted(
            MONITORING_STORE.values(),
            key=lambda item: item["created_at"],
            reverse=True,
        )
    ]


def get_monitoring(monitoring_id: str) -> dict[str, Any] | None:
    item = MONITORING_STORE.get(monitoring_id)
    return _enrich_monitoring(item.copy()) if item is not None else None


def checkin_monitoring(monitoring_id: str) -> dict[str, Any] | None:
    item = MONITORING_STORE.get(monitoring_id)
    if item is None:
        return None
    item["last_check_in"] = _iso(_now())
    return _enrich_monitoring(item.copy())


def delete_monitoring(monitoring_id: str) -> bool:
    return MONITORING_STORE.pop(monitoring_id, None) is not None
