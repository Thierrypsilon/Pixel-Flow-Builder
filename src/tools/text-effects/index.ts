import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const textEffects: ToolDefinition = {
  id: "text-effects",
  path: "/text-effects",
  title: "Text Effects",
  description:
    "Animierte Pixel-Texteffekte — Zusammensetzen, Explosion, Welle, Matrix-Regen und Glitch-Modus.",
  category: "visual",
  gradient: "from-amber-500 to-yellow-400",
  tags: ["Canvas"],
  page: lazy(() => import("./page")),
  preview,
};
