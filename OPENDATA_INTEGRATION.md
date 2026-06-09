# Intégration OpenData Paris - Îlots de Fraîcheur

## Vue d'ensemble

L'application ClimaSafe intègre désormais deux datasets OpenData de la Ville de Paris pour enrichir les recommandations de zones fraîches :

### Sources de données

1. **Îlots de fraîcheur - Espaces verts frais**
   - URL: `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/ilots-de-fraicheur-espaces-verts-frais/records`
   - 400+ entrées
   - Contient : jardins, parcs, squares, jardinières végétalisées
   - Métrique clé : `proportion_vegetation_haute` (densité de végétation haute)

2. **Îlots de fraîcheur - Équipements et activités**
   - URL: `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/ilots-de-fraicheur-equipements-activites/records`
   - 547+ entrées
   - Contient : structures d'ombrage, équipements aquatiques, lieux de culte (abris)
   - Métrique clé : type d'équipement pour scoring

## Architecture technique

### Normalisation des données

Deux fonctions de normalisation convertissent les formats OpenData au format interne :

#### `_normalize_paris_cool_spots_green()`

- Extrait les coordonnées de la géométrie GeoJSON (polygones)
- Calcule un score de fraîcheur (50-100) basé sur `proportion_vegetation_haute`
- Mappe les catégories vers les types internes : `park`, `garden`, etc.
- Préserve les métadonnées originales : arrondissement, adresse, statut d'ouverture

#### `_normalize_paris_cool_spots_amenities()`

- Extrait les coordonnées de `geo_point_2d`
- Scoring intelligent basé sur le type d'équipement :
  - Structures d'ombrage : 85/100
  - Équipements aquatiques : 90-95/100
  - Lieux de culte : 70/100
  - Bâtiments : 65/100
- Mappe les types : `water`, `shelter`, `pool`, `garden`

### Fusion des sources

La fonction `load_cool_spots()` pour Paris :

1. Charge les deux datasets en parallèle
2. Les fusionne dans une liste unique
3. Les trie par score de fraîcheur (descendant)
4. Retourne le classement combiné

**Total : ~950 points de fraîcheur à Paris**

## Intégration API

### Endpoint affecté

```
GET /api/cool-spots?lat={lat}&lng={lng}&limit={limit}
```

La réponse inclut désormais les points des deux sources OpenData avec :

- Coordonnées précises (lat/lng)
- Score de fraîcheur (0-100)
- Distance/temps de marche
- Type et catégorie
- Source (green_space ou amenity)

### Structure de réponse

```json
{
  "id": "ID1598 ou amenity-123",
  "name": "JARDINIERES DU BOULEVARD BOURDON",
  "type": "garden",
  "category": "Jardinière",
  "sourceClass": "green_space",
  "coolnessScore": 70,
  "distance": 412,
  "distanceKm": 0.41,
  "walkTime": 5,
  "lat": 48.851679,
  "lng": 2.367853,
  "address": "2 BOULEVARD BOURDON",
  "arrondissement": "75004"
}
```

## Performance & Caching

- ✅ Les données sont cachées en mémoire (`@lru_cache`) après le premier chargement
- ✅ Pagination automatique pour les APIs OpenData (jusqu'à 1000+ entrées)
- ✅ Timeout de 5s par requête réseau
- ✅ Rechargement intelligent (cache invalidation si erreur)

## Avantages de cette approche

1. **Données officielles** : Sources directes de la Ville de Paris
2. **Continuité** : Système compatible avec les datasets de Bordeaux
3. **Extensibilité** : Facile d'ajouter d'autres sources (autres villes, APIs)
4. **Qualité** : ~1000 points de fraîcheur à Paris vs ~2000 à Bordeaux
5. **Pertinence** : Scoring basé sur caractéristiques réelles (végétation, équipements)

## Notes de maintenance

- Les URLs OpenData peuvent changer : mettre à jour dans `CITY_CONFIGS`
- Format stable (GeoJSON standard) : peu de risque de rupture
- En cas d'indisponibilité API : fallback vers liste vide avec message d'erreur
- Monitoring possible via les endpoints de santé (`/api/status`)

## Exemples d'utilisation

### Frontend

```javascript
// Charger les zones fraîches près de l'utilisateur
const response = await fetch("/api/cool-spots?lat=48.853&lng=2.350&limit=20");
const coolSpots = await response.json();

// Filtrer par type
const waterSpots = coolSpots.filter(
  (s) => s.sourceClass === "amenity" && s.type === "water",
);
const parks = coolSpots.filter((s) => s.sourceClass === "green_space");
```

### Backend

```python
from app.cities import load_cool_spots

# Charger tous les cool spots de Paris
spots = load_cool_spots("paris")  # 947 spots

# Top 5 par score de fraîcheur
top_spots = sorted(spots, key=lambda x: x['coolnessScore'], reverse=True)[:5]
```
