import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameView } from "@/components/game-view";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameView />
  </StrictMode>,
);
