import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const dithering: ToolDefinition = {
  id: "dithering",
  path: "/dithering",
  title: "Dithering",
  description:
    "Bayer 2×2/4×4/8×8, Floyd-Steinberg, Atkinson und Random-Dithering mit farbigen Paletten.",
  category: "visual",
  gradient: "from-slate-500 to-zinc-600",
  tags: ["Canvas", "Kamera"],
  page: lazy(() => import("./page")),
  preview,
};
