import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/app.css";
import "./styles/extra.css";
import { App } from "./App";
import { AppProvider } from "./state";
import { AutoStore } from "./store/autoStore";

// เปิดใน artifact ของ claude.ai → เก็บในบัญชีผู้เปิด, ที่อื่น → IndexedDB
const store = new AutoStore();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider store={store}>
      <App />
    </AppProvider>
  </StrictMode>,
);
