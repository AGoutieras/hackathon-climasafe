
import { Home, Map, AlertTriangle, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function BottomNav() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/carte', icon: Map, label: 'Carte' },
    { path: '/alerte', icon: AlertTriangle, label: 'Alertes' },
    { path: '/conseils', icon: BookOpen, label: 'Conseils' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg max-w-md mx-auto">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-600 hover:text-blue-500'
              }`}
            >
              <Icon size={22} />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
