import { useEffect, useState } from "react";
import { ThermometerSun, MapPin, TrendingUp, Droplets } from "lucide-react";
import { Link } from "react-router-dom";
import { RiskIndicator } from "./RiskIndicator.jsx";
import { HydrationCard } from "./HydrationCard.jsx";
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
  const [profile, setProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // load saved profile from localStorage (include weight)
    try {
      const raw = localStorage.getItem("climasafe_profile");
      if (raw) setProfile(JSON.parse(raw));
      else
        setProfile({ age: null, weight: null, heart_disease: false, diabetes: false, pregnant: false, activity: "low", ac: false, overheated_home: false });
    } catch (e) {
      setProfile({ age: null, weight: null, heart_disease: false, diabetes: false, pregnant: false, activity: "low", ac: false, overheated_home: false });
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [risk, alertsRes, tipsRes] = await Promise.all([
          api.getRisks(position.latitude, position.longitude, DEFAULT_CITY.key, profile || {}),
          api.getAlerts(position.latitude, position.longitude, DEFAULT_CITY.key),
          api.getTips(),
        ]);
        if (!cancelled) {
          setRiskData((_) => risk);
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
  }, [position]);

  useEffect(() => {
    // refetch when profile changes
    if (!position) return;
    let cancelled = false;
    async function reload() {
      try {
        const risk = await api.getRisks(position.latitude, position.longitude, DEFAULT_CITY.key, profile || {});
        if (!cancelled) setRiskData(risk);
      } catch (e) {
        console.error(e);
      }
    }
    reload();
    return () => {
      cancelled = true;
    };
  }, [profile, position]);

  // ── Derived values ────────────────────────────────────────────────────
  const score = riskData?.score ?? 0;
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

  // hydration fallback: compute locally if backend didn't provide hydration
  function _computeLocalHydration(weight, temp, activity) {
    let w = weight;
    if (w == null || isNaN(w) || w <= 0) w = 70.0;
    const baseMl = Math.round(35.0 * w);
    const t = typeof temp === "number" ? temp : 25.0;
    const heatBonus = t > 25 ? Math.round((t - 25.0) * 100.0) : 0;
    const act = (activity || "").toLowerCase();
    const multipliers = { low: 1.0, light: 1.0, moderate: 1.15, high: 1.3, very_high: 1.3 };
    const mult = multipliers[act] ?? 1.0;
    const totalMl = Math.round((baseMl + heatBonus) * mult);
    return { weightKg: Number(w.toFixed(1)), temperature: Number(t.toFixed(1)), needMl: totalMl, needL: Number((totalMl / 1000).toFixed(1)), baseMl, heatBonusMl: heatBonus };
  }

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
          Votre assistant canicule
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

      {/* Current conditions */}
      {/* Profile card */}
      <Card className="p-4 sm:p-5 mb-6 shadow-sm border-slate-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Votre profil</h2>
            <p className="text-sm text-slate-500">Personnalise les alertes et l'indice thermique</p>
          </div>
          {profile && !editingProfile && (
            <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
              Modifier
            </Button>
          )}
        </div>

        {profile && !editingProfile && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Âge</p>
                <p className="text-2xl font-semibold text-slate-900">{profile.age ?? "—"}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">Activité</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {profile.activity === "low" ? "Faible" : profile.activity === "moderate" ? "Modérée" : profile.activity === "high" ? "Élevée" : "Très élevée"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">Facteurs de risque</p>
                <div className="flex flex-wrap gap-2">
                  {profile.heart_disease && <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">Maladie cardiaque</span>}
                  {profile.diabetes && <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700">Diabète</span>}
                  {profile.pregnant && <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-700">Grossesse</span>}
                  {!profile.heart_disease && !profile.diabetes && !profile.pregnant && (
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">Aucun facteur de risque</span>
                  )}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">Logement</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {profile.overheated_home ? "Surchauffé" : profile.ac ? "Climatisé" : "Non renseigné"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.ac && <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">Climatisation</span>}
                  {profile.overheated_home && <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-700">Logement surchauffé</span>}
                  {!profile.ac && !profile.overheated_home && (
                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">Aucun état signalé</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {profile && editingProfile && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Âge</span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  type="number"
                  placeholder="Âge"
                  value={profile.age ?? ""}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value ? parseInt(e.target.value) : null })}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Poids (kg)</span>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  type="number"
                  step="0.1"
                  placeholder="Poids"
                  value={profile.weight ?? ""}
                  onChange={(e) => setProfile({ ...profile, weight: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Activité</span>
                <select
                  value={profile.activity}
                  onChange={(e) => setProfile({ ...profile, activity: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="low">Activité faible</option>
                  <option value="moderate">Activité modérée</option>
                  <option value="high">Activité élevée</option>
                  <option value="very_high">Activité très élevée</option>
                </select>
              </label>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-3">Facteurs de risque</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={profile.heart_disease}
                      onChange={(e) => setProfile({ ...profile, heart_disease: e.target.checked })}
                    />
                    Maladie cardiaque
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={profile.diabetes}
                      onChange={(e) => setProfile({ ...profile, diabetes: e.target.checked })}
                    />
                    Diabète
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={profile.pregnant}
                      onChange={(e) => setProfile({ ...profile, pregnant: e.target.checked })}
                    />
                    Grossesse
                  </label>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800 mb-3">Logement</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={profile.ac}
                      onChange={(e) => setProfile({ ...profile, ac: e.target.checked })}
                    />
                    Climatisation
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={profile.overheated_home}
                      onChange={(e) => setProfile({ ...profile, overheated_home: e.target.checked })}
                    />
                    Logement surchauffé
                  </label>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => { localStorage.setItem('climasafe_profile', JSON.stringify(profile)); setEditingProfile(false); }}>
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => { try { const raw = localStorage.getItem('climasafe_profile'); if (raw) setProfile(JSON.parse(raw)); } catch (e) {} setEditingProfile(false); }}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </Card>
      {riskData && (
        <HydrationCard hydration={riskData.hydration ?? _computeLocalHydration(profile?.weight, riskData.temperature, profile?.activity)} />
      )}
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
          </div>
        </div>
      </Card>

      {/* Nearest refuge */}
      <Card className="p-4 sm:p-5 mb-6 bg-blue-50 border-blue-200 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <MapPin className="text-blue-600" size={24} />
          <div className="flex-1">
            <p className="text-sm text-slate-600">
              Refuge frais le plus proche
            </p>
            <p className="text-xl text-slate-900">
              {nearestRefuge?.name ?? "Chargement…"}
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

      {/* Quick tips */}
      <Card className="p-4 sm:p-5 shadow-sm border-slate-200">
        <h2 className="text-xl mb-3 text-slate-900">Conseils rapides</h2>
        <ul className="space-y-2 text-slate-700">
          {displayedTips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
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
