import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initTheme } from "./hooks/useTheme";
import "./index.css";

// Apply saved light/dark preference before React first paints so there's no
// flash of the wrong colour scheme on reload.
initTheme();

createRoot(document.getElementById("root")!).render(<App />);
