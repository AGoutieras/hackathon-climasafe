import { useEffect, useState } from "react";
import { AlertTriangle, ThermometerSun, Clock, Bell, CheckCircle } from "lucide-react";
import { Card } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";
import { api } from "../lib/api.js";

const BORDEAUX_CENTER = { longitude: -0.5792, latitude: 44.8378 };

function getAlertTemperatureProfile(temperature) {
  if (temperature == null) {
    return {
      headerBg: "bg-orange-500",
      summaryBg: "bg-orange-500",
      summaryText: "text-orange-100",
      pageGradient: "from-orange-50 to-slate-50",
      title: "Vigilance chaleur",
      zoneLabel: "Niveau local en calcul",
    };
  }

  if (temperature >= 36) {
    return {
      headerBg: "bg-red-600",
      summaryBg: "bg-red-600",
      summaryText: "text-red-100",
      pageGradient: "from-red-50 to-slate-50",
      title: "Canicule exceptionnelle",
      zoneLabel: "Niveau 3 local",
    };
  }

  if (temperature >= 30) {
    return {
      headerBg: "bg-orange-500",
      summaryBg: "bg-orange-500",
      summaryText: "text-orange-100",
      pageGradient: "from-orange-50 to-slate-50",
      title: "Forte chaleur",
      zoneLabel: "Niveau 2 local",
    };
  }

  return {
    headerBg: "bg-amber-500",
    summaryBg: "bg-amber-500",
    summaryText: "text-amber-100",
    pageGradient: "from-amber-50 to-slate-50",
    title: "Vigilance thermique",
    zoneLabel: "Niveau 1 local",
  };
}

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
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
          iconBg: "bg-orange-500",
          textColor: "text-orange-700",
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
  const temperatureProfile = getAlertTemperatureProfile(currentTemp);
  const hydrationPerHour = currentTemp != null && currentTemp >= 38 ? "1,5L" : "1L";
  const warningLabel = riskData?.score != null ? `Indice ${riskData.score}/100` : temperatureProfile.zoneLabel;
  const summaryTitle = hasActiveAlerts ? temperatureProfile.title : "Aucune alerte en cours";
  const summaryKicker = hasActiveAlerts ? "Alerte en cours" : "Statut actuel";
  const summaryMessage = hasActiveAlerts
    ? summaryAlert?.message
    : "Les conditions actuelles sont stables. Continuez à surveiller la météo locale.";

  return (
    <div className={`min-h-full bg-gradient-to-b ${temperatureProfile.pageGradient} p-4 sm:p-6`}>
      {/* Header */}
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-12 h-12 ${temperatureProfile.headerBg} rounded-full flex items-center justify-center`}>
            <Bell className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl text-slate-900">Alertes</h1>
            <p className="text-slate-600">{activeAlerts.length} alerte{activeAlerts.length > 1 ? "s" : ""} active{activeAlerts.length > 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Current Alert Summary */}
      <Card className={`p-4 sm:p-6 mb-6 ${temperatureProfile.summaryBg} text-white border-0 shadow-xl`}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
            {hasActiveAlerts ? <AlertTriangle size={28} /> : <CheckCircle size={28} />}
          </div>
          <div className="flex-1">
            <p className={`text-sm ${temperatureProfile.summaryText} mb-1`}>{summaryKicker}</p>
            <h2 className="text-xl sm:text-2xl mb-2">{summaryTitle}</h2>
            <p className={`${temperatureProfile.summaryText} text-sm`}>
              {warningLabel} • Zone {riskData?.zone ?? "Bordeaux Métropole"}
            </p>
          </div>
        </div>

        <p className={`${temperatureProfile.summaryText} text-sm mb-4`}>{summaryMessage}</p>
        
        <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className={`text-sm ${temperatureProfile.summaryText} mb-1`}>Température actuelle</p>
              <p className="text-2xl sm:text-3xl">{currentTemp != null ? `${currentTemp}°C` : "--"}</p>
            </div>
            <div>
              <p className={`text-sm ${temperatureProfile.summaryText} mb-1`}>Pic attendu</p>
              <p className="text-2xl sm:text-3xl">{forecastPeak != null ? `${forecastPeak}°C` : "--"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Immediate Actions */}
      <Card className="p-5 mb-6 shadow-sm border-slate-200">
        <h2 className="text-xl mb-4 text-slate-900">Actions immédiates</h2>
        <ul className="space-y-3">
          <li className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">1</span>
            </div>
            <div>
              <p className="text-slate-900">Buvez au moins {hydrationPerHour} d'eau par heure</p>
              <p className="text-sm text-slate-600 mt-1">Même sans soif</p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">2</span>
            </div>
            <div>
              <p className="text-slate-900">Trouvez un endroit frais</p>
              <p className="text-sm text-slate-600 mt-1">Refuge, climatisation, ombre</p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">3</span>
            </div>
            <div>
              <p className="text-slate-900">Évitez tout effort physique</p>
              <p className="text-sm text-slate-600 mt-1">Reportez les activités</p>
            </div>
          </li>
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
