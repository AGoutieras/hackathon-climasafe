from typing import Dict, Any, List, Tuple


def _clamp_multiplier(m: float) -> float:
    return max(0.78, min(1.9, m))


def _age_multiplier(age: int | None) -> Tuple[float, str]:
    if age is None:
        return 1.0, "âge inconnu"
    if age < 40:
        return 0.9, "<40"
    if age < 60:
        return 1.0, "40-59"
    if age < 75:
        return 1.15, "60-74"
    return 1.35, "75+"


def _activity_multiplier(level: str | None) -> Tuple[float, str]:
    lvl = (level or "low").lower()
    if lvl in ("low", "sédentaire", "sedentary"):
        return 1.0, "activité faible"
    if lvl in ("moderate", "moyenne"):
        return 1.05, "activité modérée"
    if lvl in ("high", "forte"):
        return 1.2, "activité élevée"
    if lvl in ("very_high", "très_forte", "tres_forte"):
        return 1.3, "activité très élevée"
    return 1.0, lvl


def compute_personal_multiplier(profile: Dict[str, Any]) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Compute multiplier and breakdown from a user profile.

    Profile fields supported:
    - age: int
    - heart_disease: bool
    - diabetes: bool
    - pregnant: bool
    - activity: str (low|moderate|high|very_high)
    - ac: bool (has air conditioning)
    - overheated_home: bool (home is overheated)

    Returns (multiplier, breakdown list)
    """
    parts: List[Dict[str, Any]] = []
    m = 1.0

    age = profile.get("age")
    age_m, age_label = _age_multiplier(age)
    m *= age_m
    parts.append({"factor": "age", "label": age_label, "multiplier": age_m})

    if profile.get("heart_disease"):
        m *= 1.25
        parts.append({"factor": "heart_disease", "label": "maladie cardiaque", "multiplier": 1.25})

    if profile.get("diabetes"):
        m *= 1.2
        parts.append({"factor": "diabetes", "label": "diabète", "multiplier": 1.2})

    if profile.get("pregnant"):
        m *= 1.2
        parts.append({"factor": "pregnant", "label": "grossesse", "multiplier": 1.2})

    activity_m, activity_label = _activity_multiplier(profile.get("activity"))
    m *= activity_m
    parts.append({"factor": "activity", "label": activity_label, "multiplier": activity_m})

    # Housing / AC
    if profile.get("overheated_home"):
        # Overheated home increases vulnerability
        m *= 1.25
        parts.append({"factor": "overheated_home", "label": "logement surchauffé", "multiplier": 1.25})
    elif profile.get("ac"):
        # Having AC reduces risk
        m *= 0.85
        parts.append({"factor": "ac", "label": "logement climatisé", "multiplier": 0.85})

    m = _clamp_multiplier(m)

    # Convert multipliers into human-friendly breakdown percentages
    breakdown: List[Dict[str, Any]] = []
    for p in parts:
        pct = round((p["multiplier"] - 1.0) * 100)
        sign = "+" if pct >= 0 else ""
        breakdown.append({"factor": p["factor"], "label": p["label"], "pct": f"{sign}{pct}%", "multiplier": p["multiplier"]})

    return m, breakdown


def apply_personal_risk(base_score: float, profile: Dict[str, Any]) -> Dict[str, Any]:
    m, breakdown = compute_personal_multiplier(profile)
    adjusted = int(round(min(100, base_score * m)))
    return {
        "base_score": int(round(base_score)),
        "multiplier": round(m, 3),
        "score": adjusted,
        "breakdown": breakdown,
    }
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class UserProfile:
    """A user's personal heat-vulnerability inputs. All fields optional."""

    age: int | None = None
    heart_disease: bool = False
    diabetes: bool = False
    pregnant: bool = False
    # activity right now: "rest" | "light" | "moderate" | "intense"
    activity: str = "light"
    # housing: does the dwelling have air conditioning / stay cool?
    air_conditioned: bool = False
    # is the dwelling poorly insulated / top floor / facing full sun?
    overheated_housing: bool = False


def _age_factor(age: int | None) -> float:
    """Older and very young people are far more vulnerable."""
    if age is None:
        return 1.0
    if age >= 80:
        return 1.45
    if age >= 70:
        return 1.30
    if age >= 65:
        return 1.18
    if age <= 4:
        return 1.35
    if age <= 12:
        return 1.12
    return 1.0


def _health_factor(profile: UserProfile) -> float:
    """Chronic conditions stack, with diminishing returns."""
    factor = 1.0
    if profile.heart_disease:
        factor += 0.22
    if profile.diabetes:
        factor += 0.15
    if profile.pregnant:
        factor += 0.12
    # cap so a multi-condition profile doesn't explode
    return min(factor, 1.55)


def _activity_factor(activity: str) -> float:
    """Physical exertion in the heat sharply raises risk."""
    return {
        "rest": 0.95,
        "light": 1.0,
        "moderate": 1.12,
        "intense": 1.28,
    }.get(activity, 1.0)


def _housing_factor(profile: UserProfile) -> float:
    """A cool home protects; an overheating home is a 24/7 exposure."""
    factor = 1.0
    if profile.air_conditioned:
        factor -= 0.18
    if profile.overheated_housing:
        factor += 0.18
    return max(0.78, factor)


def compute_user_multiplier(profile: UserProfile) -> float:
    """Combine all personal factors into a single 0.78-1.9 multiplier."""
    multiplier = (
        _age_factor(profile.age)
        * _health_factor(profile)
        * _activity_factor(profile.activity)
        * _housing_factor(profile)
    )
    return round(max(0.78, min(1.9, multiplier)), 3)


def personalise_risk(weather_risk: int, profile: UserProfile) -> dict:
    """
    Apply the personal multiplier to the environmental risk score.

    Returns a dict with the final score, level, the multiplier used,
    and the individual factor breakdown (useful for the UI to explain
    *why* the score is high).
    """
    multiplier = compute_user_multiplier(profile)
    final_score = int(round(weather_risk * multiplier))
    final_score = max(5, min(100, final_score))

    level = (
        "high" if final_score >= 70
        else "medium" if final_score >= 40
        else "low"
    )

    return {
        "weatherRisk": weather_risk,
        "userRisk": final_score,
        "multiplier": multiplier,
        "level": level,
        "factors": {
            "age": _age_factor(profile.age),
            "health": _health_factor(profile),
            "activity": _activity_factor(profile.activity),
            "housing": _housing_factor(profile),
        },
    }
