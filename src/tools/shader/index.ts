import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const shader: ToolDefinition = {
  id: "shader",
  path: "/shader",
  title: "Shader Player",
  description:
    "Echtzeit GLSL Fragment-Shader im Browser via WebGL — Plasma, Mandelbrot, Voronoi, Feuer, Tunnel, Acid.",
  category: "webgl",
  gradient: "from-fuchsia-600 to-purple-800",
  tags: ["WebGL", "Generativ"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
