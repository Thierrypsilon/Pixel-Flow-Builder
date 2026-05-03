import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const ascii: ToolDefinition = {
  id: "ascii",
  path: "/ascii",
  title: "ASCII Kit",
  description:
    "Bilder, Kamera oder animierte Demo in Echtzeit zu ASCII-Kunst konvertieren — 8 Zeichensätze, Farbmodi, Kantenerkennung, Export.",
  category: "ascii",
  gradient: "from-lime-600 to-green-800",
  tags: ["ASCII", "Konverter"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
