import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const defrag: ToolDefinition = {
  id: "defrag",
  path: "/defrag",
  title: "Defrag",
  description:
    "Festplatten-Defragmentierung im echten Win95-Stil — buntes Block-Grid animiert sich neu.",
  category: "retro",
  gradient: "from-indigo-600 to-blue-700",
  tags: ["Retro", "Win95"],
  page: lazy(() => import("./page")),
  preview,
};
