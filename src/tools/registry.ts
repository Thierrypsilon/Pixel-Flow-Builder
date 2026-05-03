import type { ToolCategory, ToolDefinition } from "./types";

import { motionTrack } from "./motion-track";
import { pixelFlow } from "./pixel-flow";
import { gradientMap } from "./gradient-map";
import { shapes } from "./shapes";
import { cellularAutomata } from "./cellular-automata";
import { textEffects } from "./text-effects";
import { dithering } from "./dithering";
import { win95 } from "./win95";
import { defrag } from "./defrag";
import { screensaver } from "./screensaver";
import { paint } from "./paint";
import { bytebeat } from "./bytebeat";
import { synthesizer } from "./synthesizer";
import { visualizer } from "./visualizer";
import { bubbles } from "./bubbles";
import { radar } from "./radar";
import { shader } from "./shader";
import { ascii } from "./ascii";
import { datamosh } from "./datamosh";
import { pixelcrash } from "./pixelcrash";
import { cursorvision } from "./cursorvision";

// Display order matches the original Replit home grid (do not re-sort).
export const TOOLS: readonly ToolDefinition[] = [
  motionTrack,
  pixelFlow,
  gradientMap,
  shapes,
  cellularAutomata,
  textEffects,
  dithering,
  win95,
  defrag,
  screensaver,
  paint,
  bytebeat,
  synthesizer,
  visualizer,
  bubbles,
  radar,
  shader,
  ascii,
  datamosh,
  pixelcrash,
  cursorvision,
] as const;

export const TOOLS_BY_CATEGORY: Record<ToolCategory, ToolDefinition[]> =
  TOOLS.reduce(
    (acc, t) => {
      (acc[t.category] ||= []).push(t);
      return acc;
    },
    {
      visual: [],
      retro: [],
      audio: [],
      physics: [],
      ascii: [],
      webgl: [],
    } as Record<ToolCategory, ToolDefinition[]>
  );
