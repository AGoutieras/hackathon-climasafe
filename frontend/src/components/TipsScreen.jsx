import { useEffect, useMemo, useState } from "react";
import { Droplets, Sun, Home, Users, Shirt, Activity, Moon, Utensils, Phone, Wind } from "lucide-react";
import { Card } from "./ui/card.jsx";
import { api } from "../lib/api.js";
import { deriveThermalLevel, getThermalUi, getThermalTipsContext } from "../lib/thermal.js";
import { useGeoPosition } from "../lib/useGeoPosition.js";

function buildTipsData(ctx) {
  return [
    {
      id: 1, category: "Hydratation", icon: Droplets, iconBg: "bg-blue-500",
      tips: [ctx.hydration, "Évitez l'alcool et les boissons sucrées", "Privilégiez l'eau fraîche mais pas glacée", "Emportez toujours une bouteille avec vous"],
    },
    {
      id: 2, category: "Protection solaire", icon: Sun, iconBg: "bg-orange-500",
      tips: [ctx.sunExposure, "Portez un chapeau à larges bords", "Utilisez de la crème solaire SPF 50+", "Recherchez l'ombre autant que possible"],
    },
    {
      id: 3, category: "À la maison", icon: Home, iconBg: "bg-green-500",
      tips: ["Fermez volets et fenêtres pendant la journée", "Aérez tôt le matin et tard le soir", "Utilisez un ventilateur ou climatisation", "Passez du temps dans les pièces les plus fraîches"],
    },
    {
      id: 4, category: "Vêtements", icon: Shirt, iconBg: "bg-purple-500",
      tips: ["Portez des vêtements légers et amples", "Privilégiez les couleurs claires", "Choisissez des tissus naturels (coton, lin)", "Mouillez votre chapeau ou casquette"],
    },
    {
      id: 5, category: "Activité physique", icon: Activity, iconBg: "bg-red-500",
      tips: [ctx.effort, "Reportez les activités sportives", "Si nécessaire, sortez tôt le matin", "Faites des pauses fréquentes à l'ombre"],
    },
    {
      id: 6, category: "Alimentation", icon: Utensils, iconBg: "bg-yellow-500",
      tips: ["Mangez des fruits et légumes frais", "Privilégiez des repas légers et froids", "Évitez les plats trop gras ou sucrés", "Consommez des aliments riches en eau (concombre, melon)"],
    },
    {
      id: 7, category: "Rafraîchissement", icon: Wind, iconBg: "bg-cyan-500",
      tips: ["Prenez des douches fraîches régulières", "Mouillez-vous le visage et les bras", "Utilisez un brumisateur d'eau", "Placez un linge humide sur votre nuque"],
    },
    {
      id: 8, category: "La nuit", icon: Moon, iconBg: "bg-indigo-500",
      tips: ["Utilisez un drap léger en coton", "Mouillez légèrement vos draps", "Gardez une bouteille d'eau près du lit", "Ouvrez les fenêtres pour créer un courant d'air"],
    },
    {
      id: 9, category: "Solidarité", icon: Users, iconBg: "bg-pink-500",
      tips: ["Prenez des nouvelles de vos proches âgés", "Ne laissez jamais un enfant seul dans une voiture", "Aidez les personnes fragiles à rester au frais", "Signalez toute personne en détresse"],
    },
    {
      id: 10, category: "Urgences", icon: Phone, iconBg: "bg-slate-700",
      tips: ["Composez le 15 en cas de malaise", "Signes d'alerte : maux de tête, vertiges, nausées", "Crampes, confusion, perte de connaissance : urgence", "Installez la personne au frais en attendant les secours"],
    },
  ];
}

export function TipsScreen() {
  const { position } = useGeoPosition();
  const [riskData, setRiskData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.getRisks(position.latitude, position.longitude)
      .then((res) => { if (!cancelled) setRiskData(res ?? null); })
      .catch((err) => { console.error("Erreur chargement conseils :", err); });

    return () => { cancelled = true; };
  }, [position]);

  const tempRaw = typeof riskData?.temperature === "number" ? riskData.temperature : null;
  const level   = deriveThermalLevel(tempRaw, riskData?.score);
  const ui      = getThermalUi(level);
  const ctx     = getThermalTipsContext(level);
  const tips    = useMemo(() => buildTipsData(ctx), [ctx]);

  const tempLabel = tempRaw != null ? `${Math.round(tempRaw)}°C` : "température en cours d'analyse";

  return (
    <div className={`min-h-full bg-gradient-to-b ${ui.pageGradient} p-4 sm:p-6`}>

      {/* Header */}
      <div className="pt-4 pb-6">
        <h1 className="text-3xl sm:text-4xl mb-2 text-slate-900">Nos conseils 💡</h1>
        <p className="text-slate-600 text-base sm:text-lg">Protégez-vous de la chaleur ({tempLabel})</p>
      </div>

      {/* Warning card */}
      <Card className={`p-4 sm:p-5 mb-6 bg-gradient-to-r ${ui.warningGradient} text-white border-0 shadow-lg`}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Sun size={24} />
          </div>
          <div>
            <h2 className="text-xl mb-2">{ui.summaryTitle}</h2>
            <p className="text-sm text-white/90">{ui.riskMessage}</p>
          </div>
        </div>
      </Card>

      {/* Tips categories */}
      <div className="space-y-4 pb-6">
        {tips.map(({ id, category, icon: Icon, iconBg, tips: items }) => (
          <Card key={id} className="p-4 sm:p-5 shadow-sm border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBg} rounded-xl flex items-center justify-center text-white`}>
                <Icon size={24} />
              </div>
              <h2 className="text-lg sm:text-xl text-slate-900">{category}</h2>
            </div>
            <ul className="space-y-2.5">
              {items.map((tip, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-xs">✓</span>
                  </div>
                  <span className="text-slate-700 text-sm leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Resources */}
      <Card className="p-5 mb-6 bg-blue-50 border-blue-200 shadow-sm">
        <h2 className="text-xl mb-3 text-slate-900">Ressources utiles</h2>
        <div className="space-y-2 text-sm">
          {[
            { href: "tel:15",         label: "15 - SAMU (urgences médicales)" },
            { href: "tel:18",         label: "18 - Pompiers" },
            { href: "tel:0800066666", label: "0800 06 66 66 - Canicule Info Service" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Phone size={16} />
              <span>{label}</span>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
