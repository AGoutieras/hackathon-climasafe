import { useEffect, useMemo, useState } from "react";
import {
  Droplets, 
  Sun, 
  Home, 
  Users, 
  Shirt, 
  Activity, 
  Moon,
  Utensils,
  Phone,
  Wind
} from "lucide-react";
import { Card } from "./ui/card.jsx";
import { api } from "../lib/api.js";
import { deriveThermalLevel, getThermalUi } from "../lib/thermal.js";

const BORDEAUX_CENTER = { longitude: -0.5792, latitude: 44.8378 };

function getTipsThermalProfile(level) {
  const thermalUi = getThermalUi(level);

  const byLevel = {
    freezing: {
      warningGradient: "from-cyan-700 to-sky-700",
      title: "Froid intense",
      message:
        "Les températures sont basses. Protégez-vous du froid et maintenez une bonne hydratation.",
      hydration: "Hydratez-vous même sans sensation de soif",
      sunExposure: "Profitez des heures les plus douces de la journée",
      effort: "Évitez les efforts intenses prolongés en extérieur",
    },
    cool: {
      warningGradient: "from-sky-600 to-blue-600",
      title: "Temps frais",
      message:
        "Conditions fraîches: adaptez vos sorties et gardez de bons réflexes de prévention.",
      hydration: "Buvez régulièrement, même par temps frais",
      sunExposure: "Privilégiez les périodes ensoleillées et abritées",
      effort: "Échauffez-vous avant toute activité extérieure",
    },
    mild: {
      warningGradient: "from-green-600 to-green-500",
      title: "Situation thermique stable",
      message:
        "Conditions globalement stables. Conservez les bons réflexes d'hydratation au quotidien.",
      hydration: "Buvez au moins 1,5L d'eau répartis sur la journée",
      sunExposure: "Limitez l'exposition prolongée en plein soleil",
      effort: "Privilégiez des efforts modérés aux heures confortables",
    },
    warm: {
      warningGradient: "from-amber-600 to-orange-500",
      title: "Vigilance chaleur",
      message:
        "La chaleur monte localement. Anticipez les pics et réduisez l'exposition directe.",
      hydration: "Buvez de l'eau régulièrement sans attendre la soif",
      sunExposure: "Évitez le soleil direct entre 12h et 17h",
      effort: "Réduisez les efforts physiques aux heures chaudes",
    },
    hot: {
      warningGradient: "from-orange-600 to-red-500",
      title: "Forte chaleur",
      message:
        "Risque thermique élevé: hydratez-vous fréquemment et limitez vos déplacements en journée.",
      hydration: "Buvez au moins 2L d'eau répartis sur la journée",
      sunExposure: "Évitez l'exposition au soleil entre 11h et 18h",
      effort: "Reportez les activités physiques au matin ou au soir",
    },
    extreme: {
      warningGradient: "from-red-700 to-orange-600",
      title: "Canicule exceptionnelle",
      message:
        "Température critique: limitez fortement les sorties et privilégiez les lieux frais.",
      hydration: "Buvez 1 verre d'eau toutes les 15 à 20 minutes",
      sunExposure: "Évitez toute exposition directe entre 10h et 20h",
      effort: "Suspendez toute activité physique en extérieur",
    },
  };

  return {
    ...thermalUi,
    ...(byLevel[level] ?? byLevel.mild),
  };
}

function buildTipsData(profile) {
  return [
    {
      id: 1,
      category: "Hydratation",
      icon: Droplets,
      iconBg: "bg-blue-500",
      tips: [
        profile.hydration,
        "Évitez l'alcool et les boissons sucrées",
        "Privilégiez l'eau fraîche mais pas glacée",
        "Emportez toujours une bouteille d'eau avec vous",
      ],
    },
    {
      id: 2,
      category: "Protection solaire",
      icon: Sun,
      iconBg: "bg-orange-500",
      tips: [
        profile.sunExposure,
        "Portez un chapeau à larges bords",
        "Utilisez de la crème solaire SPF 50+",
        "Recherchez l'ombre autant que possible",
      ],
    },
    {
      id: 3,
      category: "À la maison",
      icon: Home,
      iconBg: "bg-green-500",
      tips: [
        "Fermez volets et fenêtres pendant la journée",
        "Aérez tôt le matin et tard le soir",
        "Utilisez un ventilateur ou climatisation",
        "Passez du temps dans les pièces les plus fraîches",
      ],
    },
    {
      id: 4,
      category: "Vêtements",
      icon: Shirt,
      iconBg: "bg-purple-500",
      tips: [
        "Portez des vêtements légers et amples",
        "Privilégiez les couleurs claires",
        "Choisissez des tissus naturels (coton, lin)",
        "Mouillez votre chapeau ou casquette",
      ],
    },
    {
      id: 5,
      category: "Activité physique",
      icon: Activity,
      iconBg: "bg-red-500",
      tips: [
        profile.effort,
        "Reportez les activités sportives",
        "Si nécessaire, sortez tôt le matin",
        "Faites des pauses fréquentes à l'ombre",
      ],
    },
    {
      id: 6,
      category: "Alimentation",
      icon: Utensils,
      iconBg: "bg-yellow-500",
      tips: [
        "Mangez des fruits et légumes frais",
        "Privilégiez des repas légers et froids",
        "Évitez les plats trop gras ou sucrés",
        "Consommez des aliments riches en eau (concombre, melon)",
      ],
    },
    {
      id: 7,
      category: "Rafraîchissement",
      icon: Wind,
      iconBg: "bg-cyan-500",
      tips: [
        "Prenez des douches fraîches régulières",
        "Mouillez-vous le visage et les bras",
        "Utilisez un brumisateur d'eau",
        "Placez un linge humide sur votre nuque",
      ],
    },
    {
      id: 8,
      category: "La nuit",
      icon: Moon,
      iconBg: "bg-indigo-500",
      tips: [
        "Utilisez un drap léger en coton",
        "Mouillez légèrement vos draps",
        "Gardez une bouteille d'eau près du lit",
        "Ouvrez les fenêtres pour créer un courant d'air",
      ],
    },
    {
      id: 9,
      category: "Solidarité",
      icon: Users,
      iconBg: "bg-pink-500",
      tips: [
        "Prenez des nouvelles de vos proches âgés",
        "Ne laissez jamais un enfant seul dans une voiture",
        "Aidez les personnes fragiles à rester au frais",
        "Signalez toute personne en détresse",
      ],
    },
    {
      id: 10,
      category: "Urgences",
      icon: Phone,
      iconBg: "bg-slate-700",
      tips: [
        "Composez le 15 en cas de malaise",
        "Signes d'alerte: maux de tête, vertiges, nausées",
        "Crampes, confusion, perte de connaissance: urgence",
        "Installez la personne au frais en attendant les secours",
      ],
    },
  ];
}

export function TipsScreen() {
  const [currentPos, setCurrentPos] = useState(BORDEAUX_CENTER);
  const [riskData, setRiskData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRiskData() {
      try {
        const response = await api.getRisks(currentPos.latitude, currentPos.longitude);
        if (!cancelled) {
          setRiskData(response ?? null);
        }
      } catch (error) {
        console.error("Erreur chargement conseils :", error);
        if (!cancelled) {
          setRiskData(null);
        }
      }
    }

    loadRiskData();

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

  const currentTemp = typeof riskData?.temperature === "number" ? riskData.temperature : null;
  const thermalLevel = deriveThermalLevel(currentTemp, riskData?.score);
  const tipsProfile = getTipsThermalProfile(thermalLevel);
  const tipsData = useMemo(() => buildTipsData(tipsProfile), [tipsProfile]);
  const localTempLabel =
    currentTemp != null ? `${Math.round(currentTemp)}°C` : "température en cours d'analyse";

  return (
    <div className={`min-h-full bg-gradient-to-b ${tipsProfile.pageGradient} p-4 sm:p-6`}>
      {/* Header */}
      <div className="pt-4 pb-6">
        <h1 className="text-3xl sm:text-4xl mb-2 text-slate-900">NOS CONSEILS 💡</h1>
        <p className="text-slate-600 text-base sm:text-lg">
          Protégez-vous de la chaleur ({localTempLabel})
        </p>
      </div>

      {/* Warning Card */}
      <Card className={`p-4 sm:p-5 mb-6 bg-gradient-to-r ${tipsProfile.warningGradient} text-white border-0 shadow-lg`}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Sun size={24} />
          </div>
          <div>
            <h2 className="text-xl mb-2">{tipsProfile.title}</h2>
            <p className="text-sm text-white/90">
              {tipsProfile.message}
            </p>
          </div>
        </div>
      </Card>

      {/* Tips Categories */}
      <div className="space-y-4 pb-6">
        {tipsData.map((category) => {
          const Icon = category.icon;
          
          return (
            <Card key={category.id} className="p-4 sm:p-5 shadow-sm border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${category.iconBg} rounded-xl flex items-center justify-center text-white`}>
                  <Icon size={24} />
                </div>
                <h2 className="text-lg sm:text-xl text-slate-900">{category.category}</h2>
              </div>
              
              <ul className="space-y-2.5">
                {category.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs">✓</span>
                    </div>
                    <span className="text-slate-700 text-sm leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* Resources */}
      <Card className="p-5 mb-6 bg-blue-50 border-blue-200 shadow-sm">
        <h2 className="text-xl mb-3 text-slate-900">Ressources utiles</h2>
        <div className="space-y-2 text-sm">
          <a href="tel:15" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-lg transition-colors">
            <Phone size={16} />
            <span>15 - SAMU (urgences médicales)</span>
          </a>
          <a href="tel:18" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-lg transition-colors">
            <Phone size={16} />
            <span>18 - Pompiers</span>
          </a>
          <a href="tel:0800066666" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-lg transition-colors">
            <Phone size={16} />
            <span>0800 06 66 66 - Canicule Info Service</span>
          </a>
        </div>
      </Card>
    </div>
  );
}
