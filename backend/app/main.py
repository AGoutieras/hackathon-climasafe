
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Refuge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RISKS = {
    "level": "high",
    "score": 82,
    "temperature": 38,
    "humidity": 25,
    "zone": "Bordeaux Centre"
}

COOL_SPOTS = [
    {"id": 1, "name": "Jardin Public", "type": "park", "distance": 450, "walkTime": 6, "temperature": 28, "address": "Cours de Verdun", "x": 40, "y": 35},
    {"id": 2, "name": "Bibliothèque Mériadeck", "type": "building", "distance": 850, "walkTime": 11, "temperature": 22, "address": "85 Cours du Maréchal Juin", "x": 65, "y": 55},
    {"id": 3, "name": "Parc Bordelais", "type": "park", "distance": 1200, "walkTime": 15, "temperature": 26, "address": "Rue du Bocage", "x": 25, "y": 70},
    {"id": 4, "name": "Place de la Bourse", "type": "shade", "distance": 600, "walkTime": 8, "temperature": 30, "address": "Place de la Bourse", "x": 55, "y": 25},
]

ALERTS = [
    {"id": 1, "type": "high", "title": "Alerte canicule niveau 3", "message": "Températures exceptionnelles attendues. Évitez toute exposition au soleil entre 12h et 17h.", "time": "Il y a 15 minutes", "isActive": True},
    {"id": 2, "type": "high", "title": "Pic de chaleur à 15h", "message": "Température maximale prévue de 39°C cet après-midi.", "time": "Il y a 1 heure", "isActive": True},
    {"id": 3, "type": "medium", "title": "Qualité de l'air dégradée", "message": "Les personnes sensibles doivent limiter les activités extérieures.", "time": "Il y a 3 heures", "isActive": False},
]

TIPS = [
    {"category": "Hydratation", "tips": ["Buvez de l'eau régulièrement", "Évitez l'alcool", "Ayez toujours une bouteille d'eau sur vous"]},
    {"category": "Déplacements", "tips": ["Évitez de sortir entre 12h et 16h", "Cherchez l'ombre", "Faites des pauses fréquentes"]},
]

@app.get('/api/risks')
def get_risks():
    return RISKS

@app.get('/api/cool-spots')
def get_cool_spots():
    return COOL_SPOTS

@app.get('/api/alerts')
def get_alerts():
    return ALERTS

@app.get('/api/tips')
def get_tips():
    return TIPS

@app.get('/api/route-safe/{spot_id}')
def get_route_safe(spot_id: int):
    spot = next((s for s in COOL_SPOTS if s['id'] == spot_id), None)
    if not spot:
        return {"error": "Spot not found"}
    return {
        "spot_id": spot_id,
        "destination": spot['name'],
        "distance": spot['distance'],
        "walkTime": spot['walkTime'],
        "safety": "safe",
        "instructions": [
            "Prenez l'itinéraire ombragé principal",
            "Hydratez-vous pendant le trajet",
            "Arrivez au refuge et restez au frais"
        ]
    }
