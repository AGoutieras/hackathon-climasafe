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
