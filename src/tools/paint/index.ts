import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const paint: ToolDefinition = {
  id: "paint",
  path: "/paint",
  title: "Paint",
  description:
    "MS Paint Clone — Zeichenwerkzeuge, Farbeimer, Formen und eine klassische 28-Farben-Palette.",
  category: "retro",
  gradient: "from-white to-zinc-300",
  tags: ["Retro", "Zeichnen"],
  page: lazy(() => import("./page")),
  preview,
};
