import { useEffect, useState } from "react";
import { AlertTriangle, ThermometerSun, Clock, Bell, CheckCircle } from "lucide-react";
import { Card } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { api } from "../lib/api.js";
import { deriveThermalLevel, getThermalUi, getImmediateActions } from "../lib/thermal.js";

const BORDEAUX_CENTER = { longitude: -0.5792, latitude: 44.8378 };

export function AlertScreen() {
  const [currentPos, setCurrentPos] = useState(BORDEAUX_CENTER);
  const [alerts, setAlerts] = useState([]);
  const [riskData, setRiskData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAlertData() {
      try {
        const [alertsResponse, risksResponse] = await Promise.all([
          api.getAlerts(currentPos.latitude, currentPos.longitude),
          api.getRisks(currentPos.latitude, currentPos.longitude),
        ]);

        if (!cancelled) {
          setAlerts(Array.isArray(alertsResponse) ? alertsResponse : []);
          setRiskData(risksResponse ?? null);
        }
      } catch (error) {
        console.error("Erreur chargement alertes :", error);
        if (!cancelled) {
          setAlerts([]);
          setRiskData(null);
        }
      }
    }

    loadAlertData();

    return () => {
      cancelled = true;
    };
  }, [currentPos]);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPos({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        });
      },
      () => {
        setCurrentPos(BORDEAUX_CENTER);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const getAlertConfig = (type) => {
    switch (type) {
      case "high":
        return {
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          iconBg: "bg-red-500",
          textColor: "text-red-700",
          icon: AlertTriangle,
        };
      case "medium":
        return {
          bgColor: "bg-amber-50",
          borderColor: "border-amber-200",
          iconBg: "bg-amber-600",
          textColor: "text-amber-800",
          icon: ThermometerSun,
        };
      default:
        return {
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          iconBg: "bg-green-500",
          textColor: "text-green-700",
          icon: CheckCircle,
        };
    }
  };

  const activeAlerts = alerts.filter(a => a.isActive);
  const hasActiveAlerts = activeAlerts.length > 0;
  const summaryAlert = hasActiveAlerts ? activeAlerts[0] : null;
  const currentTemp = typeof riskData?.temperature === "number" ? Math.round(riskData.temperature) : null;
  const apparentTemp = typeof riskData?.apparent_temperature === "number"
    ? Math.round(riskData.apparent_temperature)
    : currentTemp;
  const forecastPeak =
    apparentTemp != null
      ? Math.max(apparentTemp, (currentTemp ?? apparentTemp) + 1)
      : null;
  const thermalLevel = deriveThermalLevel(currentTemp, riskData?.score);
  const thermalUi = getThermalUi(thermalLevel);
  const immediateActions = getImmediateActions(thermalLevel);
  const hydrationPerHour = currentTemp != null && currentTemp >= 38 ? "1,5L" : "1L";
  const warningLabel = riskData?.score != null ? `Indice ${riskData.score}/100` : thermalUi.summaryZoneLabel;
  const summaryTitle = hasActiveAlerts ? thermalUi.summaryTitle : "Aucune alerte en cours";
  const summaryKicker = hasActiveAlerts ? "Alerte en cours" : "Statut actuel";
  const summaryMessage = hasActiveAlerts
    ? summaryAlert?.message
    : "Les conditions actuelles sont stables. Continuez à surveiller la météo locale.";
  const summaryCardClass = hasActiveAlerts
    ? `${thermalUi.cardBg} text-white`
    : "bg-slate-800 text-white";
  const summaryTextClass = hasActiveAlerts ? thermalUi.cardSubtext : "text-slate-200";

  // Determine action item colors based on thermal level
  const getActionColors = () => {
    switch (thermalLevel) {
      case "freezing":
        return { bg: "bg-cyan-50", icon: "bg-cyan-500", text: "text-cyan-900" };
      case "cool":
        return { bg: "bg-sky-50", icon: "bg-sky-500", text: "text-sky-900" };
      case "mild":
        return { bg: "bg-green-50", icon: "bg-green-500", text: "text-green-900" };
      case "warm":
        return { bg: "bg-amber-50", icon: "bg-amber-500", text: "text-amber-900" };
      case "hot":
        return { bg: "bg-orange-50", icon: "bg-orange-500", text: "text-orange-900" };
      case "extreme":
        return { bg: "bg-red-50", icon: "bg-red-600", text: "text-red-900" };
      default:
        return { bg: "bg-blue-50", icon: "bg-blue-500", text: "text-blue-900" };
    }
  };
  const actionColors = getActionColors();

  return (
    <div className={`min-h-full bg-gradient-to-b ${thermalUi.pageGradient} p-4 sm:p-6`}>
      {/* Header */}
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-12 h-12 ${thermalUi.panelAccentBg} rounded-full flex items-center justify-center`}>
            <Bell className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl text-slate-900">Alertes</h1>
            <p className="text-slate-600">{activeAlerts.length} alerte{activeAlerts.length > 1 ? "s" : ""} active{activeAlerts.length > 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Current Alert Summary */}
      <div className={`p-4 sm:p-6 mb-6 rounded-xl shadow-xl ${summaryCardClass}`}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
            {hasActiveAlerts ? <AlertTriangle size={28} /> : <CheckCircle size={28} />}
          </div>
          <div className="flex-1">
            <p className={`text-sm ${summaryTextClass} mb-1`}>{summaryKicker}</p>
            <h2 className="text-xl sm:text-2xl mb-2">{summaryTitle}</h2>
            <p className={`${summaryTextClass} text-sm`}>
              {warningLabel} • Zone {riskData?.zone ?? "Bordeaux Métropole"}
            </p>
          </div>
        </div>

        <p className={`${summaryTextClass} text-sm mb-4`}>{summaryMessage}</p>
        
        <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className={`text-sm ${summaryTextClass} mb-1`}>Température actuelle</p>
              <p className="text-2xl sm:text-3xl">{currentTemp != null ? `${currentTemp}°C` : "--"}</p>
            </div>
            <div>
              <p className={`text-sm ${summaryTextClass} mb-1`}>Pic attendu</p>
              <p className="text-2xl sm:text-3xl">{forecastPeak != null ? `${forecastPeak}°C` : "--"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Immediate Actions */}
      <Card className="p-5 mb-6 shadow-sm border-slate-200">
        <h2 className="text-xl mb-4 text-slate-900">Actions immédiates</h2>
        <ul className="space-y-3">
          {immediateActions.map((action) => (
            <li key={action.number} className={`flex items-start gap-3 p-3 ${actionColors.bg} rounded-xl`}>
              <div className={`w-8 h-8 ${actionColors.icon} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <span className="text-white text-sm">{action.number}</span>
              </div>
              <div>
                <p className={`${actionColors.text}`}>{action.title}</p>
                <p className="text-sm text-slate-600 mt-1">{action.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* All Alerts */}
      <div className="mb-4">
        <h2 className="text-xl mb-4 text-slate-900">Historique des alertes</h2>
      </div>

      <div className="space-y-3 pb-6">
        {(alerts.length > 0 ? alerts : [{ id: "fallback", type: "medium", title: "Analyse des alertes en cours", message: "Connexion aux données locales en temps réel.", time: "Temps réel", isActive: true }]).map((alert) => {
          const config = getAlertConfig(alert.type);
          const Icon = config.icon;
          
          return (
            <Card
              key={alert.id}
              className={`p-4 ${config.bgColor} ${config.borderColor} border ${
                alert.isActive ? "shadow-md" : "opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`text-slate-900 ${alert.isActive ? "" : "line-through"}`}>
                      {alert.title}
                    </h3>
                    {alert.isActive && (
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{alert.message}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={12} />
                    <span>{alert.time}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Emergency Contact */}
      <Card className="p-5 mb-6 bg-slate-900 text-white shadow-lg">
        <h2 className="text-xl mb-3">Urgence médicale ?</h2>
        <p className="text-slate-300 text-sm mb-4">
          Si vous ressentez des malaises, vertiges, nausées ou maux de tête intenses
        </p>
        <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 h-14 text-lg rounded-xl">
          Appeler le 15 (SAMU)
        </Button>
      </Card>
    </div>
  );
}
