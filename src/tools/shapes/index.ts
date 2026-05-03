import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const shapes: ToolDefinition = {
  id: "shapes",
  path: "/shapes",
  title: "Shapes",
  description:
    "Spirographen, Lissajous-Figuren, Rosenkurven und Fourier-Epizykloiden mit vollständig konfigurierbaren Parametern.",
  category: "visual",
  gradient: "from-cyan-500 to-blue-500",
  tags: ["Canvas"],
  page: lazy(() => import("./page")),
  preview,
};
