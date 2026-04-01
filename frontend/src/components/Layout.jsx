import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav.jsx';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 w-full max-w-6xl mx-auto">
      <main className="flex-1 overflow-y-auto pb-20 md:pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
