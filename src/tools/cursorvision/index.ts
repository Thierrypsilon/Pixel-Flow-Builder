import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const cursorvision: ToolDefinition = {
  id: "cursorvision",
  path: "/cursorvision",
  title: "CursorVision",
  description:
    "Video und Kamera als Win98-Icon-Mosaik — Cursor, Sanduhr, Mine, Ordner und mehr als Pixel.",
  category: "webgl",
  gradient: "from-teal-700 to-cyan-900",
  tags: ["Win98", "Mosaik", "Retro"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
