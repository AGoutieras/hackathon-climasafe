import { ThermometerSun, MapPin, TrendingUp, Droplets } from "lucide-react";
import { Link } from "react-router-dom";
import { RiskIndicator } from "./RiskIndicator.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

export function HomeScreen() {
  const riskLevel = "high"; // Could be "low", "medium", or "high"
  const riskScore = 82;
  const currentTemp = 38;
  const nearestRefuge = "Jardin Public";
  const distance = 450;

  return (
    <div className="min-h-full bg-gradient-to-b from-orange-50 to-slate-50 p-4">
      {/* Header */}
      <div className="pt-4 pb-6">
        <h1 className="text-3xl mb-2 text-slate-900">ClimaSafe</h1>
        <p className="text-slate-600 text-lg">Votre assistant canicule</p>
      </div>

      {/* Alert Banner */}
      <div className="bg-red-500 text-white p-4 rounded-2xl mb-6 shadow-lg">
        <div className="flex items-center gap-3">
          <ThermometerSun size={28} />
          <div className="flex-1">
            <p className="font-semibold text-lg">Alerte chaleur élevée</p>
            <p className="text-red-100 text-sm">Évitez l'exposition au soleil</p>
          </div>
        </div>
      </div>

      {/* Risk Indicator */}
      <RiskIndicator level={riskLevel} score={riskScore} />

      {/* Current Conditions */}
      <Card className="p-5 mb-6 shadow-sm border-slate-200">
        <h2 className="text-xl mb-4 text-slate-900">Conditions actuelles</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <ThermometerSun className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">{currentTemp}°C</p>
              <p className="text-sm text-slate-500">Température</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Droplets className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl text-slate-900">25%</p>
              <p className="text-sm text-slate-500">Humidité</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Nearest Refuge */}
      <Card className="p-5 mb-6 bg-blue-50 border-blue-200 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <MapPin className="text-blue-600" size={24} />
          <div className="flex-1">
            <p className="text-sm text-slate-600">Refuge le plus proche</p>
            <p className="text-xl text-slate-900">{nearestRefuge}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-600 mb-4">
          <TrendingUp size={18} />
          <p className="text-sm">{distance} mètres • 6 min à pied</p>
        </div>
        <Link to="/carte">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg rounded-xl shadow-md">
            Trouver un refuge
          </Button>
        </Link>
      </Card>

      {/* Quick Tips */}
      <Card className="p-5 shadow-sm border-slate-200">
        <h2 className="text-xl mb-3 text-slate-900">Conseils rapides</h2>
        <ul className="space-y-2 text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
            <span>Buvez de l'eau régulièrement</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
            <span>Évitez les efforts physiques</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-1">•</span>
            <span>Restez à l'ombre ou au frais</span>
          </li>
        </ul>
        <Link to="/conseils">
          <Button variant="outline" className="w-full mt-4 h-12 text-base border-slate-300 rounded-xl">
            Voir tous les conseils
          </Button>
        </Link>
      </Card>
    </div>
  );
}
