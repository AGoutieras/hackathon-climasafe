
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav.jsx';

export function Layout() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
