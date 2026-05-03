import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const datamosh: ToolDefinition = {
  id: "datamosh",
  path: "/datamosh",
  title: "Datamosh",
  description:
    "Video-Glitch und Datamoshing — Block-Verschiebung, Pixel-Sorting, RGB-Shift und Frame-Akkumulation.",
  category: "webgl",
  gradient: "from-red-500 to-orange-600",
  tags: ["Glitch", "Video"],
  page: lazy(() => import("./page")),
  preview,
};
