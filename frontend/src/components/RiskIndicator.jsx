
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from './ui/card.jsx';
import { getThermalUi } from '../lib/thermal.js';

export function RiskIndicator({ level, score }) {
  const normalizedLevel = level === 'medium' ? 'moderate' : level;
  const thermalUi = getThermalUi(normalizedLevel);

  const iconByLevel = {
    freezing: AlertTriangle,
    cool: AlertCircle,
    mild: CheckCircle,
    warm: AlertCircle,
    hot: AlertTriangle,
    extreme: AlertTriangle,
    low: CheckCircle,
    moderate: AlertCircle,
    high: AlertTriangle,
  };

  const currentConfig = {
    color: thermalUi.panelAccentBg,
    textColor: thermalUi.panelText,
    bgColor: thermalUi.panelBg,
    borderColor: thermalUi.panelBorder,
    icon: iconByLevel[normalizedLevel] || AlertCircle,
    label: thermalUi.riskLabel,
    message: thermalUi.riskMessage,
  };

  const Icon = currentConfig.icon;

  return (
    <Card className={`p-6 mb-6 ${currentConfig.bgColor} ${currentConfig.borderColor} border-2 shadow-lg`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 ${currentConfig.color} rounded-full flex items-center justify-center`}>
          <Icon className="text-white" size={28} />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-600 mb-1">Niveau de risque</p>
          <p className={`text-2xl ${currentConfig.textColor}`}>{currentConfig.label}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-600">Indice de risque</span>
          <span className={`text-xl ${currentConfig.textColor}`}>{score}/100</span>
        </div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div className={`h-full ${currentConfig.color} transition-all duration-500 rounded-full`} style={{ width: `${score}%` }} />
        </div>
      </div>

      <p className="text-slate-600 text-sm">{currentConfig.message}</p>
    </Card>
  );
}
