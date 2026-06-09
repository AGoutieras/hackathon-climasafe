import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";
import { api } from "../lib/api.js";

const formatTime = (iso) => {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}h${minutes}`;
};

const STATUS_STYLES = {
  ok: "bg-emerald-50 text-emerald-700",
  soon: "bg-orange-50 text-orange-700",
  alert: "bg-red-50 text-red-700 animate-pulse",
};

const STATUS_LABELS = {
  ok: "Tout va bien",
  soon: "À confirmer bientôt",
  alert: "ALERTE — proche prévenu",
};

export function MonitoringScreen() {
  const [monitorings, setMonitorings] = useState([]);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [intervalHours, setIntervalHours] = useState(2);
  const [loading, setLoading] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  const alertItem = useMemo(
    () => monitorings.find((item) => item.status === "alert"),
    [monitorings]
  );

  const loadMonitorings = async () => {
    try {
      setLoading(true);
      const list = await api.getMonitoring();
      setMonitorings(list);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitorings();
    const interval = setInterval(loadMonitorings, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setLoading(true);
      await api.createMonitoring(name.trim(), age ? Number(age) : undefined, intervalHours);
      setName("");
      setAge("");
      setDemoActive(intervalHours < 1);
      await loadMonitorings();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async (id) => {
    try {
      await api.checkInMonitoring(id);
      await loadMonitorings();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteMonitoring(id);
      await loadMonitorings();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 px-4 pt-6 pb-24 sm:px-6">
      <div className="flex items-center gap-3 text-slate-900">
        <ShieldCheck size={30} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold">Surveillance</h1>
          <p className="text-sm text-slate-500">Suivi d’une personne vulnérable pendant une canicule.</p>
        </div>
      </div>

      {alertItem && (
        <div className="rounded-3xl border border-red-300 bg-red-50 p-4 text-red-800 shadow-sm">
          <p className="font-semibold">⚠ {alertItem.name} n'a pas confirmé.</p>
          <p>Son proche a été alerté.</p>
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">Nouvelle surveillance</p>
            <p className="text-sm text-slate-500">Crée un suivi et simule le comportement d'alerte.</p>
          </div>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            Démarrer la surveillance
          </Button>
        </div>

        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-700">
            <span>Nom de la personne</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Mamie Jeanne"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span>Âge</span>
            <input
              type="number"
              min="0"
              value={age}
              onChange={(event) => setAge(event.target.value)}
              placeholder="82"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span>Intervalle</span>
            <select
              value={intervalHours}
              onChange={(event) => {
                setIntervalHours(Number(event.target.value));
                setDemoActive(Number(event.target.value) < 1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value={2}>Toutes les 2h</option>
              <option value={4}>Toutes les 4h</option>
              <option value={6}>Toutes les 6h</option>
              <option value={0.03}>Démo : 2 min</option>
            </select>
          </label>
        </div>

        <p className="text-sm text-slate-500 pt-2">{demoActive ? "Mode démo activé — montre rapidement le passage vers ALERTE." : "Le signal d'alerte se déclenche si la confirmation n'est pas reçue avant la fin de l'intervalle."}</p>
      </Card>

      <div className="space-y-4">
        {monitorings.length === 0 ? (
          <Card className="p-6 text-slate-600">Aucune surveillance active pour le moment.</Card>
        ) : (
          monitorings.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                    {item.age != null && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.age} ans</span>}
                  </div>
                  <p className="text-sm text-slate-500">Dernière confirmation : {formatTime(item.last_check_in)}</p>
                  <p className="text-sm text-slate-500">Prochaine confirmation avant : {formatTime(item.nextCheckInIso)}</p>
                </div>

                <div className="flex flex-col gap-3 sm:items-end">
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLES[item.status]}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className="text-xs text-slate-400">{item.status === "alert" ? `${Math.abs(item.minutesRemaining)} min de retard` : `${item.minutesRemaining} min restantes`}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  onClick={() => handleCheckin(item.id)}
                  variant={item.status === "alert" ? "destructive" : "default"}
                >
                  Je vais bien ✓
                </Button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <X size={14} /> Supprimer
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
