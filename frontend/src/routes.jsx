import { createBrowserRouter } from "react-router-dom";
import { Layout }      from "./components/Layout.jsx";
import { HomeScreen }  from "./components/HomeScreen.jsx";
import { MapScreen }   from "./components/MapScreen.jsx";
import { AlertScreen } from "./components/AlertScreen.jsx";
import { TipsScreen }  from "./components/TipsScreen.jsx";

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
