import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const pixelcrash: ToolDefinition = {
  id: "pixelcrash",
  path: "/pixelcrash",
  title: "Pixel Crash",
  description:
    "Echtzeit-Datamoshing: Farben schmelzen, Frames verbluten, Pixel treiben — Export als WebM-Video.",
  category: "webgl",
  gradient: "from-rose-700 to-pink-900",
  tags: ["Glitch", "Video", "WebM"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
