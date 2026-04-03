import { Suspense } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes.jsx";

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center text-slate-500">Chargement…</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
