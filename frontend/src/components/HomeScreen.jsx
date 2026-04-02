import { useEffect, useState } from "react";
import { ThermometerSun, MapPin, TrendingUp, Droplets } from "lucide-react";
import { Link } from "react-router-dom";
import { RiskIndicator } from "./RiskIndicator.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { api } from "../lib/api.js";
import { deriveThermalLevel, getThermalUi } from "../lib/thermal.js";
import logoClimaSafe from "../assets/LOGO_CLIMASAFE.png";

const BORDEAUX_CENTER = { longitude: -0.5792, latitude: 44.8378 };

function getFallbackGuidance(level, temperature) {
  if (level === "extreme") {
    return {
      alert: `Température critique: ${Math.round(temperature)}°C, limitez toute exposition`,
      tips: [
        "Restez dans un lieu frais et aéré",
        "Hydratez-vous fréquemment, même sans soif",
        "Évitez toute activité physique en extérieur",
      ],
    };
  }

  if (level === "hot" || level === "high") {
    return {
      alert: `Forte chaleur locale: ${Math.round(temperature)}°C, restez vigilant`,
      tips: [
        "Buvez de l'eau toutes les 20 à 30 minutes",
        "Cherchez l'ombre pendant les heures chaudes",
        "Privilégiez des déplacements courts",
      ],
    };
  }

  if (level === "warm" || level === "moderate") {
    return {
      alert: temperature == null ? "Analyse locale en cours" : `Vigilance chaleur: ${Math.round(temperature)}°C`,
      tips: [
        "Restez hydraté tout au long de la journée",
        "Évitez une exposition prolongée au soleil",
        "Privilégiez les zones ombragées",
      ],
    };
  }

  if (level === "cool") {
    return {
      alert: temperature == null ? "Temps frais" : `Temps frais: ${Math.round(temperature)}°C`,
      tips: [
        "Prévoyez une couche supplémentaire",
        "Restez actif pour maintenir la chaleur corporelle",
        "Hydratez-vous aussi par temps frais",
      ],
    };
  }

  if (level === "freezing") {
    return {
      alert: temperature == null ? "Froid intense" : `Froid intense: ${Math.round(temperature)}°C`,
      tips: [
        "Limitez l'exposition au froid",
        "Couvrez les extrémités (mains, tête, pieds)",
        "Privilégiez des pauses en intérieur chauffé",
      ],
    };
  }

  return {
    alert: temperature == null ? "Conditions stables" : `Température tempérée: ${Math.round(temperature)}°C`,
    tips: [
      "Gardez une hydratation régulière",
      "Privilégiez les endroits ventilés",
      "Surveillez l'évolution dans la journée",
    ],
  };
}

export function HomeScreen() {
  const [currentPos, setCurrentPos] = useState(BORDEAUX_CENTER);
  const [gpsError, setGpsError] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState("");
  const [riskData, setRiskData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
    try {
      setLoading(true);

        const [riskResponse, alertsResponse, tipsResponse] = await Promise.all([
          api.getRisks(currentPos.latitude, currentPos.longitude),
          api.getAlerts(currentPos.latitude, currentPos.longitude),
          api.getTips(),
        ]);

        if (!cancelled) {
          setRiskData(riskResponse);
          setAlerts(Array.isArray(alertsResponse) ? alertsResponse : []);
          setTips(Array.isArray(tipsResponse) ? tipsResponse : []);
        }
      } catch (error) {
        console.error("Erreur chargement accueil :", error);

        if (!cancelled) {
          setRiskData(null);
          setAlerts([]);
          setTips([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHomeData();

    return () => {
      cancelled = true;
    };
  }, [currentPos]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError(true);
      setGpsStatusMessage("Géolocalisation non prise en charge par votre navigateur.");
      return;
    }

    function handlePosition(position) {
      setGpsError(false);
      setGpsStatusMessage("");
      setCurrentPos((prev) => {
        const next = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };

        // Ignore micro-variations to avoid unnecessary API reloads.
        const latDiff = Math.abs(next.latitude - prev.latitude);
        const lonDiff = Math.abs(next.longitude - prev.longitude);
        return latDiff < 0.0001 && lonDiff < 0.0001 ? prev : next;
      });
    }

    function handlePositionError(error) {
      const fallbackMessage = {
        1: "Accès GPS refusé. Vérifiez les permissions du navigateur.",
        2: "Position indisponible pour le moment. Réessai en mode moins précis.",
        3: "Le GPS met trop de temps à répondre.",
      };

      console.error("Erreur GPS :", error);
      setGpsError(true);
      setGpsStatusMessage(fallbackMessage[error.code] || "Erreur GPS inconnue.");

      // Keep the last known valid position instead of forcing a jump to Bordeaux.
      if (error.code === 2 || error.code === 3) {
        navigator.geolocation.getCurrentPosition(
          handlePosition,
          () => {},
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        );
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      handlePosition,
      handlePositionError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const riskScore = riskData?.score ?? 0;
  const currentTemp =
    riskData?.temperature != null ? Math.round(riskData.temperature) : "--";
  const currentHumidity =
    riskData?.humidity != null ? Math.round(riskData.humidity) : "--";
  const apparentTemp =
    riskData?.apparent_temperature != null
      ? Math.round(riskData.apparent_temperature)
      : "--";
  const temperatureValue = typeof riskData?.temperature === "number" ? riskData.temperature : null;
  const thermalLevel = deriveThermalLevel(temperatureValue, riskScore);
  const tempProfile = getThermalUi(thermalLevel);
  const fallbackGuidance = getFallbackGuidance(thermalLevel, temperatureValue);

  const nearestRefuge = riskData?.nearestRefuge ?? null;
  const alertBanner = alerts[0] ?? null;
  const isAlertBannerLoading = !alertBanner;

  const alertBannerContainerClass = isAlertBannerLoading
    ? "bg-amber-100 border border-amber-300 text-amber-900"
    : `${tempProfile.cardBg} text-white`;

  const alertBannerSubtextClass = isAlertBannerLoading
    ? "text-amber-800"
    : tempProfile.cardSubtext;

  const locationLabel = gpsError
    ? gpsStatusMessage || "Localisation temporairement indisponible"
    : "Position détectée en direct";

  const quickTips = tips.flatMap((section) => section.tips || []).slice(0, 3);
  const displayedTips = quickTips.length > 0 ? quickTips : fallbackGuidance.tips;

  return (
    <div className={`min-h-full bg-gradient-to-b ${tempProfile.pageGradient} p-4 sm:p-6`}>
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={logoClimaSafe}
            alt="Logo ClimaSafe"
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
          />
          <h1 className="text-3xl sm:text-4xl text-slate-900">ClimaSafe</h1>
        </div>
        <p className="text-slate-600 text-base sm:text-lg">Votre assistant canicule</p>
      </div>

      <div className={`${alertBannerContainerClass} p-4 rounded-2xl mb-6 shadow-lg`}>
        <div className="flex items-center gap-3">
          <ThermometerSun size={28} />
          <div className="flex-1">
            <p className="font-semibold text-lg">
              {alertBanner?.title ?? "Chargement des alertes..."}
            </p>
            <p className={`${alertBannerSubtextClass} text-sm`}>
              {alertBanner?.message ?? fallbackGuidance.alert}
            </p>
          </div>
        </div>
      </div>

      <RiskIndicator level={thermalLevel} score={riskScore} />

      <Card className="p-4 sm:p-5 mb-6 shadow-sm border-slate-200">
        <h2 className="text-xl mb-1 text-slate-900">Conditions actuelles</h2>
        <p className="text-sm text-slate-500 mb-4">{locationLabel}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${tempProfile.iconBox} rounded-xl flex items-center justify-center`}>
              <ThermometerSun className={tempProfile.iconColor} size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">
                {loading ? "..." : `${currentTemp}°C`}
              </p>
              <p className="text-sm text-slate-500">Température</p>
              <p className="text-xs text-slate-400">
                Ressenti : {loading ? "..." : `${apparentTemp}°C`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Droplets className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">
                {loading ? "..." : `${currentHumidity}%`}
              </p>
              <p className="text-sm text-slate-500">Humidité</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5 mb-6 bg-blue-50 border-blue-200 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <MapPin className="text-blue-600" size={24} />
          <div className="flex-1">
            <p className="text-sm text-slate-600">Refuge frais le plus proche</p>
            <p className="text-xl text-slate-900">
              {nearestRefuge?.name ?? "Chargement..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-600 mb-4">
          <TrendingUp size={18} />
          <p className="text-sm">
            {nearestRefuge
              ? `${nearestRefuge.distance} mètres • ${nearestRefuge.walkTime} min à pied`
              : "Distance indisponible"}
          </p>
        </div>
        <Link to="/carte">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 sm:h-14 text-base sm:text-lg rounded-xl shadow-md">
            Trouver un refuge
          </Button>
        </Link>
      </Card>

      <Card className="p-4 sm:p-5 shadow-sm border-slate-200">
        <h2 className="text-xl mb-3 text-slate-900">Conseils rapides</h2>
        <ul className="space-y-2 text-slate-700">
          {displayedTips.map((tip, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
            <span>{tip}</span>
          </li>
        ))}
        </ul>
        <Link to="/conseils">
          <Button
            variant="outline"
            className="w-full mt-4 h-12 text-base border-slate-300 rounded-xl"
          >
            Voir tous les conseils
          </Button>
        </Link>
      </Card>
    </div>
  );
}
