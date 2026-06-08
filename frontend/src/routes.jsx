import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";

const HomeScreen = lazy(() => import("./components/HomeScreen.jsx").then((module) => ({ default: module.HomeScreen })));
const MapScreen = lazy(() => import("./components/MapScreen.jsx").then((module) => ({ default: module.MapScreen })));
const AlertScreen = lazy(() => import("./components/AlertScreen.jsx").then((module) => ({ default: module.AlertScreen })));
const TipsScreen = lazy(() => import("./components/TipsScreen.jsx").then((module) => ({ default: module.TipsScreen })));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true,         element: <HomeScreen /> },
      { path: "carte",       element: <MapScreen /> },
      { path: "alerte",      element: <AlertScreen /> },
      { path: "conseils",    element: <TipsScreen /> },
    ],
  },
]);
