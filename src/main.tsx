import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/app.css";
import "./styles/extra.css";
import { App } from "./App";
import { AppProvider } from "./state";
import { DexieTripStore } from "./store/dexieStore";

const store = new DexieTripStore();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider store={store}>
      <App />
    </AppProvider>
  </StrictMode>,
);
