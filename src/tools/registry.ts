import type { ToolCategory, ToolDefinition } from "./types";

// Tool definitions are added in Phase 4 (one task per tool).
export const TOOLS: readonly ToolDefinition[] = [] as const;

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
