import { AlertTriangle, ThermometerSun, Clock, Bell, CheckCircle } from "lucide-react";
import { Card } from "./ui/card.jsx";
import { Button } from "./ui/button.jsx";

export function AlertScreen() {
  const alerts = [
    {
      id: 1,
      type: "high",
      title: "Alerte canicule niveau 3",
      message: "Températures exceptionnelles attendues. Évitez toute exposition au soleil entre 12h et 17h. Hydratez-vous régulièrement.",
      time: "Il y a 15 minutes",
      isActive: true,
    },
    {
      id: 2,
      type: "high",
      title: "Pic de chaleur à 15h",
      message: "Température maximale prévue de 39°C cet après-midi. Restez au frais autant que possible.",
      time: "Il y a 1 heure",
      isActive: true,
    },
    {
      id: 3,
      type: "medium",
      title: "Nuit tropicale prévue",
      message: "La température ne descendra pas sous 24°C cette nuit. Aérez votre logement tôt le matin.",
      time: "Il y a 3 heures",
      isActive: true,
    },
    {
      id: 4,
      type: "low",
      title: "Amélioration demain",
      message: "Températures en baisse prévues pour demain avec 32°C maximum.",
      time: "Hier",
      isActive: false,
    },
  ];

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

  return (
    <div className="min-h-full bg-gradient-to-b from-red-50 to-slate-50 p-4">
      {/* Header */}
      <div className="pt-4 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
            <Bell className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl text-slate-900">Alertes</h1>
            <p className="text-slate-600">{activeAlerts.length} alertes actives</p>
          </div>
        </div>
      </div>

      {/* Current Alert Summary */}
      <Card className="p-6 mb-6 bg-red-500 text-white border-0 shadow-xl">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
            <AlertTriangle size={28} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-red-100 mb-1">Alerte en cours</p>
            <h2 className="text-2xl mb-2">Canicule exceptionnelle</h2>
            <p className="text-red-100 text-sm">
              Niveau 3 • Zone Bordeaux Métropole
            </p>
          </div>
        </div>
        
        <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-red-100 mb-1">Température actuelle</p>
              <p className="text-3xl">38°C</p>
            </div>
            <div>
              <p className="text-sm text-red-100 mb-1">Pic attendu</p>
              <p className="text-3xl">39°C</p>
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
              <p className="text-slate-900">Buvez au moins 1,5L d'eau par heure</p>
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
        {alerts.map((alert) => {
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
