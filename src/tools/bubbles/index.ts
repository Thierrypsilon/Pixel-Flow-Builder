import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const bubbles: ToolDefinition = {
  id: "bubbles",
  path: "/bubbles",
  title: "Bubbles",
  description:
    "Interaktive Physik-Simulation mit bunten, glänzenden Blasen — Schwerkraft, Kollision und Zusammenstöße.",
  category: "physics",
  gradient: "from-sky-400 to-cyan-600",
  tags: ["Physik", "Interaktiv"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
