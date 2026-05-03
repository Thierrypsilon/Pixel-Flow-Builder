import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const bytebeat: ToolDefinition = {
  id: "bytebeat",
  path: "/bytebeat",
  title: "ByteBeat",
  description:
    "Prozeduraler Klang durch mathematische Formeln — klassische Bytebeat-Algorithmen mit Oszilloskop und Spektrum.",
  category: "audio",
  gradient: "from-green-500 to-emerald-700",
  tags: ["Musik", "Audio"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
