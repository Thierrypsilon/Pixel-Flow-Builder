import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const visualizer: ToolDefinition = {
  id: "visualizer",
  path: "/visualizer",
  title: "Visualizer",
  description:
    "Audio-Visualisierung im Winamp-Stil — Spektrum, Welle, Kreis und Partikel-Modus mit Farbthemen.",
  category: "audio",
  gradient: "from-pink-500 to-rose-700",
  tags: ["Musik", "Visualizer"],
  page: lazy(() => import("./page")),
  preview,
};
