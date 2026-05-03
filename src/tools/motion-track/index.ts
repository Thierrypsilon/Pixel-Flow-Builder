import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const motionTrack: ToolDefinition = {
  id: "motion-track",
  path: "/motion-track",
  title: "Motion Track",
  description:
    "Echtzeit Objekt- und Bewegungsverfolgung mit konfigurierbaren Overlays, Filtern und Verbindungslinien.",
  category: "visual",
  gradient: "from-emerald-500 to-teal-500",
  tags: ["Video", "Kamera"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
