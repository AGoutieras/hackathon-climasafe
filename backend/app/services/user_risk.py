from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any


@dataclass(frozen=True)
class UserProfile:
    age: int | None = None
    heart_disease: bool = False
    diabetes: bool = False
    pregnant: bool = False
    activity: str = "light"
    air_conditioned: bool = False
    overheated_housing: bool = False


def _age_factor(age: int | None) -> float:
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
    factor = 1.0
    if profile.heart_disease:
        factor += 0.22
    if profile.diabetes:
        factor += 0.15
    if profile.pregnant:
        factor += 0.12
    return min(factor, 1.55)


def _activity_factor(activity: str) -> float:
    return {
        "rest": 0.95,
        "light": 1.0,
        "moderate": 1.12,
        "intense": 1.28,
    }.get(activity, 1.0)


def _housing_factor(profile: UserProfile) -> float:
    factor = 1.0
    if profile.air_conditioned:
        factor -= 0.18
    if profile.overheated_housing:
        factor += 0.18
    return max(0.78, factor)


def compute_user_multiplier(profile: UserProfile) -> float:
    multiplier = (
        _age_factor(profile.age)
        * _health_factor(profile)
        * _activity_factor(profile.activity)
        * _housing_factor(profile)
    )
    return round(max(0.78, min(1.9, multiplier)), 3)


def personalise_risk(weather_risk: int, profile: UserProfile) -> dict:
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


# Backward-compat alias for any code still calling apply_personal_risk
def apply_personal_risk(base_score: float, profile: Dict[str, Any]) -> dict:
    p = UserProfile(
        age=profile.get("age"),
        heart_disease=bool(profile.get("heart_disease")),
        diabetes=bool(profile.get("diabetes")),
        pregnant=bool(profile.get("pregnant")),
        activity=profile.get("activity", "light"),
        air_conditioned=bool(profile.get("ac")),
        overheated_housing=bool(profile.get("overheated_home")),
    )
    return personalise_risk(int(round(base_score)), p)