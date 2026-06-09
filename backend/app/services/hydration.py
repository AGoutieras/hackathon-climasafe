from __future__ import annotations

from typing import Dict


def compute_water_need(weight_kg: float, temperature: float, activity: str = "light") -> Dict[str, object]:
    """Compute daily water need.

    - Base: 35 ml per kg
    - Heat bonus: if temperature > 25°C, add 100 ml per degree above 25
    - Activity multiplier: "light"=1.0, "moderate"=1.15, "intense"=1.3

    Returns a dict with: weightKg, temperature, needMl (int), needL (float 1 dec),
    baseMl, heatBonusMl
    """
    try:
        w = float(weight_kg) if weight_kg is not None else None
    except (TypeError, ValueError):
        w = None

    if w is None or w <= 0:
        w = 70.0

    base_ml = int(round(35.0 * w))

    heat_bonus_ml = 0
    try:
        temp = float(temperature)
    except (TypeError, ValueError):
        temp = 25.0

    if temp > 25.0:
        heat_bonus_ml = int(round((temp - 25.0) * 100.0))

    act = (activity or "").lower()
    multipliers = {
        "light": 1.0,
        "moderate": 1.15,
        "intense": 1.3,
    }
    multiplier = multipliers.get(act, 1.0)

    total_ml = int(round((base_ml + heat_bonus_ml) * multiplier))
    need_l = round(total_ml / 1000.0, 1)

    return {
        "weightKg": float(round(w, 1)),
        "temperature": float(round(temp, 1)),
        "needMl": int(total_ml),
        "needL": float(need_l),
        "baseMl": int(base_ml),
        "heatBonusMl": int(heat_bonus_ml),
    }
