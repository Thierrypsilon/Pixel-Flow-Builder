import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const screensaver: ToolDefinition = {
  id: "screensaver",
  path: "/screensaver",
  title: "Screensaver",
  description:
    "5 klassische Windows-Bildschirmschoner: Starfield, Matrix, 3D Pipes, Bouncing Logo, Labyrinth.",
  category: "retro",
  gradient: "from-black to-zinc-700",
  tags: ["Retro", "Animation"],
  page: lazy(() => import("./page")),
  preview,
};
