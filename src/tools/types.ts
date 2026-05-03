import type { ComponentType, LazyExoticComponent } from "react";

export type ToolCategory =
  | "visual"
  | "retro"
  | "audio"
  | "physics"
  | "ascii"
  | "webgl";

export type PreviewDrawFn = (
  ctx: CanvasRenderingContext2D,
  t: number,
  w: number,
  h: number
) => void;

export interface ToolDefinition {
  id: string;
  path: string;
  title: string;
  description: string;
  category: ToolCategory;
  page: LazyExoticComponent<ComponentType>;
  preview: PreviewDrawFn;
  gradient: string;
  tags?: string[];
  popular?: boolean;
  expectedConsoleErrors?: RegExp[];
}
