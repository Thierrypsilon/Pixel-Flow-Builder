import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const cellularAutomata: ToolDefinition = {
  id: "cellular-automata",
  path: "/cellular-automata",
  title: "Cellular Automata",
  description:
    "Conway's Game of Life, HighLife, Day & Night, Brian's Brain — interaktiv auf dem Canvas zeichnen.",
  category: "visual",
  gradient: "from-emerald-600 to-green-700",
  tags: ["Canvas"],
  page: lazy(() => import("./page")),
  preview,
};
