import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const gradientMap: ToolDefinition = {
  id: "gradient-map",
  path: "/gradient-map",
  title: "Gradient Map",
  description:
    "Wende Farbverlaufskarten (Hitze, Regenbogen, Ozean, etc.) live auf Kamera oder Demo-Video an.",
  category: "visual",
  gradient: "from-rose-500 to-orange-400",
  tags: ["Canvas", "Kamera"],
  page: lazy(() => import("./page")),
  preview,
};
