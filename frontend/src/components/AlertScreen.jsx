import { useEffect, useState } from "react";
import { AlertTriangle, ThermometerSun, Clock, Bell, CheckCircle } from "lucide-react";
import { Card } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { api } from "../lib/api.js";
import { deriveThermalLevel, getThermalUi, getImmediateActions } from "../lib/thermal.js";
import { useGeoPosition } from "../lib/useGeoPosition.js";

function alertConfig(type) {
  const CONFIGS = {
    high:   { bgColor: "bg-red-50",   borderColor: "border-red-200",   iconBg: "bg-red-500",   icon: AlertTriangle },
    medium: { bgColor: "bg-amber-50", borderColor: "border-amber-200", iconBg: "bg-amber-600", icon: ThermometerSun },
  };
  return CONFIGS[type] ?? { bgColor: "bg-green-50", borderColor: "border-green-200", iconBg: "bg-green-500", icon: CheckCircle };
}

export function AlertScreen() {
  const { position } = useGeoPosition();
  const [alerts,   setAlerts]   = useState([]);
  const [riskData, setRiskData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [alertsRes, risk] = await Promise.all([
          api.getAlerts(position.latitude, position.longitude),
          api.getRisks(position.latitude, position.longitude),
        ]);
        if (!cancelled) {
          setAlerts(Array.isArray(alertsRes) ? alertsRes : []);
          setRiskData(risk ?? null);
        }
      } catch (err) {
        console.error("Erreur chargement alertes :", err);
        if (!cancelled) { setAlerts([]); setRiskData(null); }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [position]);

  // ── Derived values ─────────────────────────────────────────────────────
  const tempRaw     = typeof riskData?.temperature === "number" ? riskData.temperature : null;
  const apparent    = typeof riskData?.apparent_temperature === "number"
    ? Math.round(riskData.apparent_temperature)
    : tempRaw != null ? Math.round(tempRaw) : null;
  const forecastPeak = apparent != null
    ? Math.max(apparent, (tempRaw != null ? Math.round(tempRaw) : apparent) + 1)
    : null;

  const level   = deriveThermalLevel(tempRaw, riskData?.score);
  const ui      = getThermalUi(level);
  const actions = getImmediateActions(level);

  const activeAlerts  = alerts.filter((a) => a.isActive);
  const hasActive     = activeAlerts.length > 0;
  const summaryAlert  = activeAlerts[0] ?? null;

  const warningLabel   = riskData?.score != null ? `Indice ${riskData.score}/100` : ui.summaryZoneLabel;
  const summaryCardCls = hasActive ? `${ui.cardBg} text-white` : "bg-slate-800 text-white";
  const summarySubCls  = hasActive ? ui.cardSubtext : "text-slate-200";

  const alertStateConfig = {
    active:    { label: "En cours",      pill: "bg-red-100 text-red-800" },
    monitoring:{ label: "Surveillance",  pill: "bg-amber-100 text-amber-900" },
    resolved:  { label: "Terminée",      pill: "bg-slate-900 text-white" },
  };

  const actionColors = {
    freezing: { bg: "bg-cyan-50",   icon: "bg-cyan-500",   text: "text-cyan-900" },
    cool:     { bg: "bg-sky-50",    icon: "bg-sky-500",    text: "text-sky-900" },
    mild:     { bg: "bg-green-50",  icon: "bg-green-500",  text: "text-green-900" },
    warm:     { bg: "bg-amber-50",  icon: "bg-amber-500",  text: "text-amber-900" },
    hot:      { bg: "bg-orange-50", icon: "bg-orange-500", text: "text-orange-900" },
    extreme:  { bg: "bg-red-50",    icon: "bg-red-600",    text: "text-red-900" },
  }[level] ?? { bg: "bg-blue-50", icon: "bg-blue-500", text: "text-blue-900" };

  const displayAlerts = alerts.length > 0 ? alerts : [{
    id:       "fallback",
    type:     "medium",
    title:    "Analyse des alertes en cours",
    message:  "Connexion aux données locales en temps réel.",
    time:     "Temps réel",
    isActive: true,
  }];

  const timelineAlerts = [...displayAlerts].sort((left, right) => Number(right.isActive) - Number(left.isActive));

  return (
    <div className={`min-h-full bg-gradient-to-b ${ui.pageGradient} p-4 sm:p-6`}>

      {/* Header */}
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-12 h-12 ${ui.panelAccentBg} rounded-full flex items-center justify-center`}>
            <Bell className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl text-slate-900">Sois préparé ⚠️</h1>
            <p className="text-slate-600">
              {activeAlerts.length} alerte{activeAlerts.length !== 1 ? "s" : ""} active{activeAlerts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <div className={`p-4 sm:p-6 mb-6 rounded-xl shadow-xl ${summaryCardCls}`}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
            {hasActive ? <AlertTriangle size={28} /> : <CheckCircle size={28} />}
          </div>
          <div className="flex-1">
            <p className={`text-sm ${summarySubCls} mb-1`}>{hasActive ? "Alerte en cours" : "Statut actuel"}</p>
            <h2 className="text-xl sm:text-2xl mb-2">{hasActive ? ui.summaryTitle : "Aucune alerte en cours"}</h2>
            <p className={`${summarySubCls} text-sm`}>{warningLabel} • Zone {riskData?.zone ?? "Bordeaux Métropole"}</p>
          </div>
        </div>

        <p className={`${summarySubCls} text-sm mb-4`}>
          {hasActive
            ? summaryAlert?.message
            : "Les conditions actuelles sont stables. Continuez à surveiller la météo locale."}
        </p>

        <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className={`text-sm ${summarySubCls} mb-1`}>Température actuelle</p>
              <p className="text-2xl sm:text-3xl">{tempRaw != null ? `${Math.round(tempRaw)}°C` : "--"}</p>
            </div>
            <div>
              <p className={`text-sm ${summarySubCls} mb-1`}>Pic attendu</p>
              <p className="text-2xl sm:text-3xl">{forecastPeak != null ? `${forecastPeak}°C` : "--"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Immediate actions */}
      <Card className="p-5 mb-6 shadow-sm border-slate-200">
        <h2 className="text-xl mb-4 text-slate-900">Actions immédiates</h2>
        <ul className="space-y-3">
          {actions.map((action) => (
            <li key={action.number} className={`flex items-start gap-3 p-3 ${actionColors.bg} rounded-xl`}>
              <div className={`w-8 h-8 ${actionColors.icon} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <span className="text-white text-sm">{action.number}</span>
              </div>
              <div>
                <p className={actionColors.text}>{action.title}</p>
                <p className="text-sm text-slate-600 mt-1">{action.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Alerts history */}
      <Card className="p-5 mb-6 shadow-sm border-slate-200">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl text-slate-900">Historique des alertes</h2>
            <p className="text-sm text-slate-500 mt-1">Vue synthétique des alertes locales et de leur état actuel.</p>
          </div>
          <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            {timelineAlerts.length} événement{timelineAlerts.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="space-y-3">
          {timelineAlerts.map((alert, index) => {
            const cfg  = alertConfig(alert.type);
            const Icon = cfg.icon;
            const status = alert.isActive
              ? alertStateConfig.active
              : (index === 0 ? alertStateConfig.monitoring : alertStateConfig.resolved);
            const isResolved = !alert.isActive && index > 0;
            const cardStateClass = isResolved
              ? "bg-slate-100 border-slate-300 shadow-sm ring-1 ring-slate-200"
              : `${cfg.bgColor} ${cfg.borderColor} ${alert.isActive ? "shadow-md" : "opacity-80"}`;

            return (
              <div key={alert.id} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-3 h-3 rounded-full ${isResolved ? "bg-slate-900" : cfg.iconBg} ${alert.isActive ? "animate-pulse" : ""}`} />
                  {index < timelineAlerts.length - 1 && <div className="w-px flex-1 min-h-20 bg-slate-200 mt-2" />}
                </div>

                <Card className={`flex-1 p-4 border ${cardStateClass}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 ${isResolved ? "bg-slate-900" : cfg.iconBg} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <h3 className="text-slate-900">{alert.title}</h3>
                          <p className={`text-xs mt-1 uppercase tracking-wide ${isResolved ? "text-slate-700 font-semibold" : "text-slate-500"}`}>
                            {isResolved ? "Alertes clôturées" : alert.type === "high" ? "Vigilance forte" : alert.type === "medium" ? "Vigilance modérée" : "Situation stable"}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.pill}`}>
                          {status.label}
                        </span>
                      </div>

                      <p className={`text-sm mb-3 ${isResolved ? "text-slate-800" : "text-slate-700"}`}>{alert.message}</p>

                      <div className={`flex flex-wrap items-center gap-3 text-xs ${isResolved ? "text-slate-700" : "text-slate-500"}`}>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock size={12} />
                          {alert.time}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{alert.isActive ? "Nécessite une action immédiate" : isResolved ? "Alertes terminées et archivées" : "À garder en mémoire"}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Emergency */}
      <Card className="p-5 mb-6 bg-slate-900 text-white shadow-lg">
        <h2 className="text-xl mb-3">Urgence médicale ?</h2>
        <p className="text-slate-300 text-sm mb-4">
          Si vous ressentez des malaises, vertiges, nausées ou maux de tête intenses
        </p>
        <Button
          onClick={() => { window.location.href = "tel:15"; }}
          className="w-full bg-white text-slate-900 hover:bg-slate-100 h-14 text-lg rounded-xl"
        >
          Appeler le 15 (SAMU)
        </Button>
      </Card>
    </div>
  );
}
