export function deriveThermalLevel(temperature, score) {
  const safeTemp = typeof temperature === "number" ? temperature : null;
  const safeScore = typeof score === "number" ? score : null;

  const orderedLevels = ["freezing", "cool", "mild", "warm", "hot", "extreme"];

  const clampIndex = (index) => Math.max(0, Math.min(orderedLevels.length - 1, index));

  const tempToIndex = (value) => {
    if (value <= 0) return 0;
    if (value <= 15) return 1;
    if (value <= 24) return 2;
    if (value <= 30) return 3;
    if (value <= 35) return 4;
    return 5;
  };

  const scoreToIndex = (value) => {
    if (value >= 85) return 5;
    if (value >= 70) return 4;
    if (value >= 50) return 3;
    if (value >= 30) return 2;
    if (value >= 15) return 1;
    return 0;
  };

  if (safeTemp == null && safeScore == null) {
    return "mild";
  }

  if (safeTemp == null) {
    return orderedLevels[scoreToIndex(safeScore)];
  }

  let index = tempToIndex(safeTemp);

  // Keep temperature dominant but allow the score to nudge one band up or down.
  if (safeScore != null) {
    const scoreIndex = scoreToIndex(safeScore);
    if (scoreIndex >= index + 2) {
      index += 1;
    } else if (scoreIndex <= index - 2) {
      index -= 1;
    }
  }

  return orderedLevels[clampIndex(index)];
}

export function getThermalUi(level) {
  const config = {
    freezing: {
      pageGradient: "from-cyan-50 to-slate-50",
      cardBg: "bg-cyan-700",
      cardSubtext: "text-cyan-100",
      iconBox: "bg-cyan-100",
      iconColor: "text-cyan-700",
      panelBg: "bg-cyan-50",
      panelBorder: "border-cyan-300",
      panelAccentBg: "bg-cyan-700",
      panelText: "text-cyan-700",
      summaryTitle: "Froid intense",
      summaryZoneLabel: "Niveau thermique -2",
      riskLabel: "Risque froid élevé",
      riskMessage: "Protégez-vous du froid",
    },
    cool: {
      pageGradient: "from-sky-100 to-slate-50",
      cardBg: "bg-sky-700",
      cardSubtext: "text-sky-100",
      iconBox: "bg-sky-100",
      iconColor: "text-sky-700",
      panelBg: "bg-blue-50",
      panelBorder: "border-blue-200",
      panelAccentBg: "bg-sky-700",
      panelText: "text-sky-700",
      summaryTitle: "Temps frais",
      summaryZoneLabel: "Niveau thermique -1",
      riskLabel: "Risque faible",
      riskMessage: "Conditions fraîches",
    },
    mild: {
      pageGradient: "from-green-50 to-slate-50",
      cardBg: "bg-green-600",
      cardSubtext: "text-green-100",
      iconBox: "bg-green-100",
      iconColor: "text-green-700",
      panelBg: "bg-green-50",
      panelBorder: "border-green-200",
      panelAccentBg: "bg-green-600",
      panelText: "text-green-800",
      summaryTitle: "Situation stable",
      summaryZoneLabel: "Niveau thermique 0",
      riskLabel: "Risque faible",
      riskMessage: "Conditions normales",
    },
    warm: {
      pageGradient: "from-amber-50 to-slate-50",
      cardBg: "bg-amber-600",
      cardSubtext: "text-amber-100",
      iconBox: "bg-amber-100",
      iconColor: "text-amber-700",
      panelBg: "bg-amber-50",
      panelBorder: "border-amber-200",
      panelAccentBg: "bg-amber-600",
      panelText: "text-amber-800",
      summaryTitle: "Vigilance thermique",
      summaryZoneLabel: "Niveau thermique 1",
      riskLabel: "Risque modéré",
      riskMessage: "Hydratez-vous régulièrement",
    },
    hot: {
      pageGradient: "from-orange-50 to-slate-50",
      cardBg: "bg-orange-600",
      cardSubtext: "text-orange-100",
      iconBox: "bg-orange-100",
      iconColor: "text-orange-700",
      panelBg: "bg-orange-50",
      panelBorder: "border-orange-200",
      panelAccentBg: "bg-orange-600",
      panelText: "text-orange-800",
      summaryTitle: "Forte chaleur",
      summaryZoneLabel: "Niveau thermique 2",
      riskLabel: "Risque élevé",
      riskMessage: "Limitez les efforts en extérieur",
    },
    extreme: {
      pageGradient: "from-red-50 to-slate-50",
      cardBg: "bg-red-700",
      cardSubtext: "text-red-100",
      iconBox: "bg-red-100",
      iconColor: "text-red-700",
      panelBg: "bg-red-50",
      panelBorder: "border-red-200",
      panelAccentBg: "bg-red-700",
      panelText: "text-red-800",
      summaryTitle: "Canicule exceptionnelle",
      summaryZoneLabel: "Niveau thermique 3",
      riskLabel: "Risque critique",
      riskMessage: "Restez dans un endroit frais",
    },
    // Aliases kept for backward compatibility in existing callers.
    low: null,
    moderate: null,
    high: null,
  };

  config.low = config.mild;
  config.moderate = config.warm;
  config.high = config.hot;

  return config[level] ?? config.mild;
}