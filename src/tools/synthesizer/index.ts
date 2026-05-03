import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const synthesizer: ToolDefinition = {
  id: "synthesizer",
  path: "/synthesizer",
  title: "Synthesizer",
  description:
    "Virtuelles Piano mit Web Audio API — Wellenformen, ADSR-Hüllkurve, Reverb und QWERTY-Tastatur-Steuerung.",
  category: "audio",
  gradient: "from-violet-500 to-purple-700",
  tags: ["Musik", "Piano"],
  page: lazy(() => import("./page")),
  preview,
};
