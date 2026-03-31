# ☀️ CLIMASAFE

**Prévenir et agir face aux vagues de chaleur**

CLIMASAFE est une application web conçue pour **anticiper, alerter et protéger les populations lors des épisodes de canicule**, avec un focus particulier sur les zones urbaines comme Bordeaux Métropole.

---

## 🎯 Problématique

Les épisodes de canicule deviennent :

* Plus **fréquents**
* Plus **intenses**
* Plus **dangereux en ville** (îlots de chaleur urbains)

👉 Pourtant, les citoyens manquent :

* d’informations **localisées**
* d’alertes **claires et exploitables**
* de **guides d’action concrets**

---

## 💡 Solution

CLIMASAFE propose une plateforme simple et accessible qui permet de :

* 🌡️ **Visualiser les zones à risque de chaleur**
* 🚨 **Recevoir des alertes en temps réel**
* 🧠 **Adopter les bons réflexes face à la canicule**
* 🏙️ **Mieux comprendre son environnement urbain**

---

## 🔥 Fonctionnalités principales

### 📍 Carte des zones de chaleur

* Identification des îlots de chaleur urbains
* Visualisation des zones critiques en temps réel
* Intégration de données open data (Bordeaux Métropole)

---

### 🚨 Système d’alerte canicule

* Notifications selon la localisation utilisateur
* Niveaux d’alerte (vigilance, danger, extrême)
* Messages simples et actionnables

---

### 👤 Dashboard utilisateur

* Vue personnalisée des risques
* Suivi des alertes reçues
* Informations locales en continu

---

### 💡 Conseils intelligents

* Recommandations adaptées :

  * Hydratation 💧
  * Horaires à éviter ⛔
  * Comportements à adopter 🧢
* Conseils ciblés selon niveau de danger

---

## 🛠️ Stack technique

### Frontend

* React.js
* Interface responsive & moderne

### Backend

* Python (API REST)
* Framework : FastAPI / Flask

### Données

* Open Data Bordeaux Métropole
* Données géospatiales
* APIs environnementales

---

## 📂 Structure du projet

```
/climasafe
│
├── frontend/        # App React (UI, carte, dashboard)
├── backend/         # API Python (data, alertes)
├── data/            # Données canicule (open data)
├── assets/          # UI, images
└── README.md
```

---

## ⚙️ Installation

### 1. Clone

```bash
git clone https://github.com/ton-projet/climasafe.git
cd climasafe
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Sources de données

* Open Data Bordeaux Métropole
* Données climatiques publiques
* Données géographiques urbaines

---

## 🎯 Impact

CLIMASAFE permet :

* 🧑‍🤝‍🧑 Aux citoyens → de **se protéger efficacement**
* 🏙️ Aux villes → de **mieux anticiper les crises**
* 🌍 À la société → de **s’adapter au réchauffement climatique**

---

## 🚀 Vision

Faire de CLIMASAFE un **assistant climatique urbain spécialisé canicule**, capable de :

* Prédire les zones à risque 🔮
* Alerter automatiquement 📲
* Sauver des vies ❤️

---

## 🤝 Projet Hackathon

Projet développé dans le cadre du **Hackathon Bordeaux Métropole**, avec un focus sur un enjeu majeur :

👉 **La gestion des vagues de chaleur en milieu urbain**

---

## 👥 Team 

*  ÉQUIPE : 
° Anthony GOUTIERAS
° Steven MARIANI
° Victoire BOUTIN
° Vitushan SATKUNANATHAN

*  GITHUB
° @AGoutieras
°
° @Victoire07
°

