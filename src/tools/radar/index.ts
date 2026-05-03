import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const radar: ToolDefinition = {
  id: "radar",
  path: "/radar",
  title: "Radar",
  description:
    "Retro-Sonar mit phosphoreszierender Anzeige — klassischer Sweep, Blips und Farbthemen.",
  category: "physics",
  gradient: "from-green-900 to-green-600",
  tags: ["Retro", "Visualizer"],
  page: lazy(() => import("./page")),
  preview,
};
