import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const pixelFlow: ToolDefinition = {
  id: "pixel-flow",
  path: "/pixel-flow",
  title: "Pixel Flow",
  description:
    "Echtzeit-Kamera-Pixelkunst mit mehreren Dithering-Algorithmen, Farbmodi und Pixelformen.",
  category: "visual",
  gradient: "from-violet-500 to-fuchsia-500",
  tags: ["Canvas", "Kamera"],
  page: lazy(() => import("./page")),
  preview,
};
