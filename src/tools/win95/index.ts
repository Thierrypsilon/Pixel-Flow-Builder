import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const win95: ToolDefinition = {
  id: "win95",
  path: "/win95",
  title: "Win95 Windows",
  description:
    "Webcam oder Demo-Video in klassischen Windows 95-Fenstern mit 3D-Bevel, Titelleiste und Taskleiste.",
  category: "retro",
  gradient: "from-blue-700 to-sky-500",
  tags: ["Kamera", "Retro"],
  page: lazy(() => import("./page")),
  preview,
};
