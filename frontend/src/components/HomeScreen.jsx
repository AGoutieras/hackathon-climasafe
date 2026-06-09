import { useEffect, useState } from "react";
import { ThermometerSun, MapPin, TrendingUp, Droplets, User, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { RiskIndicator } from "./RiskIndicator.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { api } from "../lib/api.js";
import { DEFAULT_CITY } from "../lib/constants.js";
import {
  deriveThermalLevel,
  getThermalUi,
  getImmediateActions,
} from "../lib/thermal.js";
import { useGeoPosition } from "../lib/useGeoPosition.js";
import logoClimaSafe from "../assets/LOGO_CLIMASAFE.png";

export function HomeScreen() {
  const { position, gpsError, gpsStatusMessage } = useGeoPosition();
  const [riskData, setRiskData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("climasafe_profile");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [profileOpen, setProfileOpen] = useState(false);

  function updateProfile(patch) {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem("climasafe_profile", JSON.stringify(next));
      } catch {
        /* localStorage indisponible : on garde juste en mémoire */
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [risk, alertsRes, tipsRes] = await Promise.all([
          api.getRisks(position.latitude, position.longitude, DEFAULT_CITY.key, profile),
          api.getAlerts(
            position.latitude,
            position.longitude,
            DEFAULT_CITY.key,
          ),
          api.getTips(),
        ]);
        if (!cancelled) {
          setRiskData((riskData) => risk);
          setAlerts(Array.isArray(alertsRes) ? alertsRes : []);
          setTips(Array.isArray(tipsRes) ? tipsRes : []);
        }
      } catch (err) {
        console.error("Erreur chargement accueil :", err);
        if (!cancelled) {
          setRiskData(null);
          setAlerts([]);
          setTips([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [position, profile]);

  // ── Derived values ────────────────────────────────────────────────────
  const personalized = riskData?.personalized ?? null;
  const score = personalized?.userRisk ?? riskData?.score ?? 0;
  const weatherScore = riskData?.score ?? 0;
  const hasProfile = Object.keys(profile).length > 0;
  // Facteurs actifs : on traduit les multiplicateurs en explications lisibles
  const factorLabels = {
    age: "Âge",
    health: "État de santé",
    activity: "Activité physique",
    housing: "Logement",
  };
  const activeFactors = personalized?.factors
    ? Object.entries(personalized.factors)
        .map(([key, value]) => ({
          key,
          label: factorLabels[key] ?? key,
          percent: Math.round((value - 1) * 100),
        }))
        .filter((f) => f.percent !== 0)
        .sort((a, b) => b.percent - a.percent)
    : [];
  const tempRaw =
    typeof riskData?.temperature === "number" ? riskData.temperature : null;
  const level = deriveThermalLevel(tempRaw, score);
  const ui = getThermalUi(level);
  const actions = getImmediateActions(level); // fallback tips from thermal lib

  const displayTemp = tempRaw != null ? `${Math.round(tempRaw)}°C` : "--";
  const displayApparent =
    riskData?.apparent_temperature != null
      ? `${Math.round(riskData.apparent_temperature)}°C`
      : "--";
  const displayHumidity =
    riskData?.humidity != null ? `${Math.round(riskData.humidity)}%` : "--";

  const alertBanner = alerts[0] ?? null;
  const nearestRefuge = riskData?.nearestRefuge ?? null;

  // Quick tips: prefer backend tips, fall back to action descriptions
  const quickTips = tips.flatMap((s) => s.tips ?? []).slice(0, 3);
  const displayedTips =
    quickTips.length > 0
      ? quickTips
      : actions.map((a) => `${a.title} — ${a.description}`);

  const alertCardClass = alertBanner
    ? `${ui.cardBg} text-white`
    : "bg-amber-100 border border-amber-300 text-amber-900";
  const alertSubClass = alertBanner ? ui.cardSubtext : "text-amber-800";
  const locationLabel = gpsError
    ? gpsStatusMessage || "Localisation temporairement indisponible"
    : "Position détectée en direct";

  return (
    <div
      className={`min-h-full bg-gradient-to-b ${ui.pageGradient} p-4 sm:p-6`}
    >
      {/* Header */}
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <img
            src={logoClimaSafe}
            alt="Logo ClimaSafe"
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
          />
          <h1 className="text-2xl sm:text-4xl text-slate-900">ClimaSafe</h1>
        </div>
        <p className="text-slate-600 text-sm sm:text-lg">
          Avec ClimaSafe, restez safe.
        </p>
      </div>

      {/* Alert banner */}
      <div className={`${alertCardClass} p-4 rounded-2xl mb-6 shadow-lg`}>
        <div className="flex items-center gap-3">
          <ThermometerSun size={28} />
          <div className="flex-1">
            <p className="font-semibold text-lg">
              {alertBanner?.title ?? "Chargement des alertes…"}
            </p>
            <p className={`${alertSubClass} text-sm`}>
              {alertBanner?.message ?? ui.riskMessage}
            </p>
          </div>
        </div>
      </div>

      {/* Risk indicator */}
      <RiskIndicator level={level} score={score} />

      {/* Profil personnalisé */}
      <Card className="p-4 sm:p-5 mb-6 shadow-sm border-slate-200">
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="w-full flex items-center gap-3"
        >
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <User className="text-slate-600" size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-base text-slate-900">Mon profil de risque</p>
            <p className="text-xs text-slate-500">
              {hasProfile
                ? `Risque météo ${weatherScore} ajusté à ${score}/100 selon votre profil`
                : "Personnalisez votre indice de risque"}
            </p>
          </div>
          <ChevronDown
            className={`text-slate-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
            size={20}
          />
        </button>

        {profileOpen && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <div>
              <label className="text-sm text-slate-600">Âge</label>
              <input
                type="number"
                min="0"
                max="120"
                value={profile.age ?? ""}
                onChange={(e) =>
                  updateProfile({
                    age: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                placeholder="ex. 82"
                className="w-full mt-1 h-11 px-3 rounded-xl border border-slate-300"
              />
            </div>

            <div>
              <label className="text-sm text-slate-600">Activité physique</label>
              <select
                value={profile.activity ?? "light"}
                onChange={(e) => updateProfile({ activity: e.target.value })}
                className="w-full mt-1 h-11 px-3 rounded-xl border border-slate-300 bg-white"
              >
                <option value="rest">Au repos</option>
                <option value="light">Légère</option>
                <option value="moderate">Modérée</option>
                <option value="intense">Intense</option>
              </select>
            </div>

            <div className="space-y-2">
              {[
                { key: "heart_disease", label: "Maladie cardiaque" },
                { key: "diabetes", label: "Diabète" },
                { key: "pregnant", label: "Grossesse" },
                { key: "overheated_housing", label: "Logement qui surchauffe" },
                { key: "air_conditioned", label: "Logement climatisé" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={profile[item.key] ?? false}
                    onChange={(e) =>
                      updateProfile({ [item.key]: e.target.checked })
                    }
                    className="w-5 h-5 rounded"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {hasProfile && activeFactors.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600 mb-2">
              Votre risque est ajusté par&nbsp;:
            </p>
            <ul className="space-y-1.5">
              {activeFactors.map((f) => (
                <li
                  key={f.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className={
                        f.percent > 0 ? "text-red-500" : "text-green-600"
                      }
                    >
                      {f.percent > 0 ? "▲" : "▼"}
                    </span>
                    {f.label}
                  </span>
                  <span
                    className={
                      f.percent > 0
                        ? "font-medium text-red-600"
                        : "font-medium text-green-600"
                    }
                  >
                    {f.percent > 0 ? "+" : ""}
                    {f.percent}&nbsp;%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Current conditions */}
      <Card className="p-4 sm:p-5 mb-6 shadow-sm border-slate-200">
        <h2 className="text-xl mb-1 text-slate-900">Conditions actuelles</h2>
        <p className="text-sm text-slate-500 mb-4">{locationLabel}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 ${ui.iconBox} rounded-xl flex items-center justify-center`}
            >
              <ThermometerSun className={ui.iconColor} size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">
                {loading ? "…" : displayTemp}
              </p>
              <p className="text-sm text-slate-500">Température</p>
              <p className="text-xs text-slate-400">
                Ressenti : {loading ? "…" : displayApparent}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Droplets className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">
                {loading ? "…" : displayHumidity}
              </p>
              <p className="text-sm text-slate-500">Humidité</p>
            </div>
       