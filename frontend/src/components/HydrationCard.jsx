import { useEffect, useState } from "react";
import { Card } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";

export function HydrationCard({ hydration }) {
  const needMl = hydration?.needMl ?? 3800;
  const needL = hydration?.needL ?? Math.round((needMl / 1000) * 10) / 10;

  const todayKey = `climasafe_hydration_${new Date().toISOString().slice(0, 10)}`;

  const [consumedMl, setConsumedMl] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(todayKey);
      if (raw) setConsumedMl(parseInt(raw, 10) || 0);
    } catch (e) {
      setConsumedMl(0);
    }
  }, [todayKey]);

  useEffect(() => {
    try {
      localStorage.setItem(todayKey, String(consumedMl));
    } catch (e) {
      // ignore
    }
  }, [consumedMl, todayKey]);

  function addMl(amount) {
    setConsumedMl((s) => Math.max(0, s + amount));
  }

  function reset() {
    setConsumedMl(0);
  }

  const rawPct = needMl > 0 ? Math.round((consumedMl / needMl) * 100) : 0;
  const pct = Math.min(100, rawPct);
  let barColor = "blue";
  // 0-100%: gradient of blue (lighter -> darker as pct increases)
  if (rawPct < 100) {
    const lightness = Math.max(30, 70 - rawPct * 0.3); // 70% -> 40%
    barColor = `hsl(210, 100%, ${lightness}%)`;
  } else if (rawPct < 120) {
    // reached goal: green
    barColor = `hsl(140, 70%, 40%)`;
  } else {
    // exceeded too much: red
    barColor = `hsl(0, 80%, 50%)`;
  }

  return (
    <Card className="p-4 sm:p-5 mb-6 shadow-sm border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-slate-900">Hydratation</h2>
        <p className="text-sm text-slate-500">Objectif quotidien</p>
      </div>

      <div>
        <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-4 rounded-full transition-all duration-300`}
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>

        <div className="mt-2 text-sm text-slate-700">
          {((consumedMl || 0) / 1000).toFixed(1)} / {needL.toFixed(1)} L
        </div>

        <div className="mt-3 flex gap-2">
          <Button onClick={() => addMl(250)}>+250 ml</Button>
          <Button onClick={() => addMl(500)}>+500 ml</Button>
          <Button variant="outline" onClick={reset}>Réinitialiser</Button>
        </div>
      </div>
    </Card>
  );
}

export default HydrationCard;
