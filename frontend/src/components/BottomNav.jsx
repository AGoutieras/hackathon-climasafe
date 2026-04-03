import { Home, Map, AlertTriangle, BookOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/",        icon: Home,          label: "Accueil" },
  { path: "/carte",   icon: Map,           label: "Carte" },
  { path: "/alerte",  icon: AlertTriangle, label: "Alertes" },
  { path: "/conseils",icon: BookOpen,      label: "Conseils" },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full max-w-6xl mx-auto bg-white border-t border-slate-200 shadow-lg md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:w-[calc(100%-2rem)] md:rounded-2xl md:border">
      <div className="grid grid-cols-4 h-16 md:h-[4.5rem]">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
              pathname === path ? "text-blue-600" : "text-slate-600 hover:text-blue-500"
            }`}
          >
            <Icon size={22} />
            <span className="text-xs">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
