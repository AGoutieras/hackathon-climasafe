import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav.jsx";

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-slate-50 w-full max-w-6xl mx-auto">
      <main className="flex-1 min-h-0 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
