/**
 * Derives the thermal comfort level from temperature and/or risk score.
 * Returns one of: "freezing" | "cool" | "mild" | "warm" | "hot" | "extreme"
 */
export function deriveThermalLevel(temperature, score) {
  const LEVELS = ["freezing", "cool", "mild", "warm", "hot", "extreme"];
  const clamp = (i) => Math.max(0, Math.min(LEVELS.length - 1, i));

  const tempIndex = (t) => {
    if (t <= 0)  return 0;
    if (t <= 15) return 1;
    if (t <= 24) return 2;
    if (t <= 30) return 3;
    if (t <= 35) return 4;
    return 5;
  };

  const scoreIndex = (s) => {
    if (s >= 85) return 5;
    if (s >= 70) return 4;
    if (s >= 50) return 3;
    if (s >= 30) return 2;
    if (s >= 15) return 1;
    return 0;
  };

  const safeTemp  = typeof temperature === "number" ? temperature : null;
  const safeScore = typeof score       === "number" ? score       : null;

  if (safeTemp == null && safeScore == null) return "mild";
  if (safeTemp == null) return LEVELS[scoreIndex(safeScore)];

  let idx = tempIndex(safeTemp);
  if (safeScore != null) {
    const si = scoreIndex(safeScore);
    if (si >= idx + 2) idx += 1;
    else if (si <= idx - 2) idx -= 1;
  }
  return LEVELS[clamp(idx)];
}

/**
 * Returns Tailwind class names and UI labels for a given thermal level.
 * Accepts level aliases: "low" → "mild", "moderate" → "warm", "high" → "hot".
 */
export function getThermalUi(level) {
  const ALIAS = { low: "mild", moderate: "warm", high: "hot", medium: "warm" };
  const key = ALIAS[level] ?? level;

  const CONFIG = {
    freezing: {
      pageGradient:   "from-cyan-50 to-slate-50",
      cardBg:         "bg-cyan-700",
      cardSubtext:    "text-cyan-100",
      iconBox:        "bg-cyan-100",
      iconColor:      "text-cyan-700",
      panelBg:        "bg-cyan-50",
      panelBorder:    "border-cyan-300",
      panelAccentBg:  "bg-cyan-700",
      panelText:      "text-cyan-700",
      warningGradient:"from-cyan-700 to-sky-700",
      summaryTitle:   "Froid intense",
      summaryZoneLabel:"Niveau thermique -2",
      riskLabel:      "Risque froid élevé",
      riskMessage:    "Protégez-vous du froid",
    },
    cool: {
      pageGradient:   "from-sky-100 to-slate-50",
      cardBg:         "bg-sky-700",
      cardSubtext:    "text-sky-100",
      iconBox:        "bg-sky-100",
      iconColor:      "text-sky-700",
      panelBg:        "bg-blue-50",
      panelBorder:    "border-blue-200",
      panelAccentBg:  "bg-sky-700",
      panelText:      "text-sky-700",
      warningGradient:"from-sky-600 to-blue-600",
      summaryTitle:   "Temps frais",
      summaryZoneLabel:"Niveau thermique -1",
      riskLabel:      "Risque faible",
      riskMessage:    "Conditions fraîches",
    },
    mild: {
      pageGradient:   "from-green-50 to-slate-50",
      cardBg:         "bg-green-600",
      cardSubtext:    "text-green-100",
      iconBox:        "bg-green-100",
      iconColor:      "text-green-700",
      panelBg:        "bg-green-50",
      panelBorder:    "border-green-200",
      panelAccentBg:  "bg-green-600",
      panelText:      "text-green-800",
      warningGradient:"from-green-600 to-green-500",
      summaryTitle:   "Situation stable",
      summaryZoneLabel:"Niveau thermique 0",
      riskLabel:      "Risque faible",
      riskMessage:    "Conditions normales",
    },
    warm: {
      pageGradient:   "from-amber-50 to-slate-50",
      cardBg:         "bg-amber-600",
      cardSubtext:    "text-amber-100",
      iconBox:        "bg-amber-100",
      iconColor:      "text-amber-700",
      panelBg:        "bg-amber-50",
      panelBorder:    "border-amber-200",
      panelAccentBg:  "bg-amber-600",
      panelText:      "text-amber-800",
      warningGradient:"from-amber-600 to-orange-500",
      summaryTitle:   "Vigilance thermique",
      summaryZoneLabel:"Niveau thermique 1",
      riskLabel:      "Risque modéré",
      riskMessage:    "Hydratez-vous régulièrement",
    },
    hot: {
      pageGradient:   "from-orange-50 to-slate-50",
      cardBg:         "bg-orange-600",
      cardSubtext:    "text-orange-100",
      iconBox:        "bg-orange-100",
      iconColor:      "text-orange-700",
      panelBg:        "bg-orange-50",
      panelBorder:    "border-orange-200",
      panelAccentBg:  "bg-orange-600",
      panelText:      "text-orange-800",
      warningGradient:"from-orange-600 to-red-500",
      summaryTitle:   "Forte chaleur",
      summaryZoneLabel:"Niveau thermique 2",
      riskLabel:      "Risque élevé",
      riskMessage:    "Limitez les efforts en extérieur",
    },
    extreme: {
      pageGradient:   "from-red-50 to-slate-50",
      cardBg:         "bg-red-700",
      cardSubtext:    "text-red-100",
      iconBox:        "bg-red-100",
      iconColor:      "text-red-700",
      panelBg:        "bg-red-50",
      panelBorder:    "border-red-200",
      panelAccentBg:  "bg-red-700",
      panelText:      "text-red-800",
      warningGradient:"from-red-700 to-orange-600",
      summaryTitle:   "Canicule exceptionnelle",
      summaryZoneLabel:"Niveau thermique 3",
      riskLabel:      "Risque critique",
      riskMessage:    "Restez dans un endroit frais",
    },
  };

  return CONFIG[key] ?? CONFIG.mild;
}

/**
 * Returns 3 prioritised action items for the given thermal level.
 */
export function getImmediateActions(level) {
  const ACTIONS = {
    freezing: [
      { number: "1", title: "Trouvez un endroit chaud",        description: "Intérieur chauffé, refuge" },
      { number: "2", title: "Portez des vêtements chauds",     description: "Couches épaisses, bonnet, gants, écharpe" },
      { number: "3", title: "Limitez le temps en extérieur",   description: "Réduisez l'exposition au froid intense" },
    ],
    cool: [
      { number: "1", title: "Portez une veste",                description: "Protection légère contre le froid modéré" },
      { number: "2", title: "Restez protégé du vent",          description: "Cherchez les zones abritées" },
      { number: "3", title: "Réchauffez-vous régulièrement",   description: "Boissons chaudes, mouvements, soleil" },
    ],
    mild: [
      { number: "1", title: "Maintenez l'équilibre hydrique",  description: "Buvez régulièrement, même sans soif" },
      { number: "2", title: "Utilisez la protection solaire",  description: "Crème solaire, chapeau, vêtements légers" },
      { number: "3", title: "Restez vigilant",                 description: "Écoutez votre corps" },
    ],
    warm: [
      { number: "1", title: "Buvez 500 ml d'eau par heure",   description: "Même sans soif" },
      { number: "2", title: "Cherchez l'ombre régulièrement", description: "Évitez l'exposition directe au soleil" },
      { number: "3", title: "Limitez l'activité physique",     description: "Reportez les efforts importants" },
    ],
    hot: [
      { number: "1", title: "Buvez 1 L d'eau par heure",      description: "Même sans soif" },
      { number: "2", title: "Rejoignez un endroit frais",      description: "Refuge, climatisation, piscine, ombre" },
      { number: "3", title: "Évitez tout effort physique",     description: "Reportez les activités" },
    ],
    extreme: [
      { number: "1", title: "Buvez 1,5 L d'eau par heure",    description: "Hydratation constante" },
      { number: "2", title: "Restez en climatisation",         description: "Ne sortez pas sans nécessité absolue" },
      { number: "3", title: "Appelez le 15 si malaise",        description: "Vertiges, nausées, maux de tête intenses" },
    ],
  };

  return ACTIONS[level] ?? ACTIONS.mild;
}

/**
 * Returns contextual tips text used by TipsScreen.
 * Extracted here to avoid duplication between TipsScreen and thermal.js.
 */
export function getThermalTipsContext(level) {
  const BY_LEVEL = {
    freezing: {
      hydration:   "Hydratez-vous même sans sensation de soif",
      sunExposure: "Profitez des heures les plus douces de la journée",
      effort:      "Évitez les efforts intenses prolongés en extérieur",
    },
    cool: {
      hydration:   "Buvez régulièrement, même par temps frais",
      sunExposure: "Privilégiez les périodes ensoleillées et abritées",
      effort:      "Échauffez-vous avant toute activité extérieure",
    },
    mild: {
      hydration:   "Buvez au moins 1,5 L d'eau répartis sur la journée",
      sunExposure: "Limitez l'exposition prolongée en plein soleil",
      effort:      "Privilégiez des efforts modérés aux heures confortables",
    },
    warm: {
      hydration:   "Buvez de l'eau régulièrement sans attendre la soif",
      sunExposure: "Évitez le soleil direct entre 12 h et 17 h",
      effort:      "Réduisez les efforts physiques aux heures chaudes",
    },
    hot: {
      hydration:   "Buvez au moins 2 L d'eau répartis sur la journée",
      sunExposure: "Évitez l'exposition au soleil entre 11 h et 18 h",
      effort:      "Reportez les activités physiques au matin ou au soir",
    },
    extreme: {
      hydration:   "Buvez 1 verre d'eau toutes les 15 à 20 minutes",
      sunExposure: "Évitez toute exposition directe entre 10 h et 20 h",
      effort:      "Suspendez toute activité physique en extérieur",
    },
  };

  return BY_LEVEL[level] ?? BY_LEVEL.mild;
}
