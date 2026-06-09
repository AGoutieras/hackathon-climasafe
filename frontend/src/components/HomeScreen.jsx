import { useEffect, useState } from "react";
import { ThermometerSun, MapPin, TrendingUp, Droplets } from "lucide-react";
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
  const [profile, setProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // load saved profile from localStorage
    try {
      const raw = localStorage.getItem("climasafe_profile");
      if (raw) setProfile(JSON.parse(raw));
      else
        setProfile({ age: null, heart_disease: false, diabetes: false, pregnant: false, activity: "low", ac: false, overheated_home: false });
    } catch (e) {
      setProfile({ age: null, heart_disease: false, diabetes: false, pregnant: false, activity: "low", ac: false, overheated_home: false });
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [risk, alertsRes, tipsRes] = await Promise.all([
          api.getRisks(position.latitude, position.longitude, DEFAULT_CITY.key, profile || {}),
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
        <h2 className="text-xl mb-1 text-slate-900">Votre profil</h2>
        <p className="text-sm text-slate-500 mb-3">Utilisé pour personnaliser l'indice</p>
        {profile && !editingProfile && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-700">
              <div>Âge: {profile.age ?? "—"}</div>
              <div>Conditions: {profile.heart_disease || profile.diabetes || profile.pregnant ? "Oui" : "Non"}</div>
              <div>Logement: {profile.overheated_home ? "Surchauffé" : profile.ac ? "Climatisé" : "—"}</div>
            </div>
            <div>
              <button onClick={() => setEditingProfile(true)} className="text-blue-600 underline">Modifier</button>
            </div>
          </div>
        )}
        {profile && editingProfile && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="w-24 p-1 border rounded" type="number" placeholder="Âge" value={profile.age ?? ""} onChange={(e)=> setProfile({...profile, age: e.target.value ? parseInt(e.target.value) : null})} />
              <select value={profile.activity} onChange={(e)=> setProfile({...profile, activity: e.target.value})} className="p-1 border rounded">
                <option value="low">Activité faible</option>
                <option value="moderate">Activité modérée</option>
                <option value="high">Activité élevée</option>
                <option value="very_high">Activité très élevée</option>
              </select>
            </div>
            <div className="flex gap-3 text-sm">
              <label><input type="checkbox" checked={profile.heart_disease} onChange={(e)=> setProfile({...profile, heart_disease: e.target.checked})} /> Maladie cardiaque</label>
              <label><input type="checkbox" checked={profile.diabetes} onChange={(e)=> setProfile({...profile, diabetes: e.target.checked})} /> Diabète</label>
              <label><input type="checkbox" checked={profile.pregnant} onChange={(e)=> setProfile({...profile, pregnant: e.target.checked})} /> Grossesse</label>
            </div>
            <div className="flex gap-3 text-sm">
              <label><input type="checkbox" checked={profile.ac} onChange={(e)=> setProfile({...profile, ac: e.target.checked})} /> Climatisation</label>
              <label><input type="checkbox" checked={profile.overheated_home} onChange={(e)=> setProfile({...profile, overheated_home: e.target.checked})} /> Logement surchauffé</label>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ localStorage.setItem('climasafe_profile', JSON.stringify(profile)); setEditingProfile(false); }} className="bg-blue-600 text-white px-3 py-1 rounded">Enregistrer</button>
              <button onClick={()=>{ try{ const raw = localStorage.getItem('climasafe_profile'); if(raw) setProfile(JSON.parse(raw)); } catch(e){} setEditingProfile(false); }} className="px-3 py-1 rounded border">Annuler</button>
            </div>
          </div>
        )}
      </Card>
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
