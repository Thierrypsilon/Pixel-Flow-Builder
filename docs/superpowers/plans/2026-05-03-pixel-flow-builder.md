# Pixel-Flow-Builder Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing 21-tool Replit „Creative Tools" export into the GitHub repo `Pixel-Flow-Builder` as a slim Vite + React + Tailwind static site, refactored to a Tool-Registry pattern, deployed via GitHub Pages with Playwright smoketests in CI.

**Architecture:** Single Vite-based SPA. Each of the 21 tools is a self-contained module under `src/tools/<id>/` (page + preview-fn + ToolDefinition). A central `src/tools/registry.ts` aggregates them. `App.tsx` and `home-page.tsx` read from the registry — adding a new tool means dropping a folder and one import. Pages are lazy-loaded for small initial bundle.

**Tech Stack:** React 18, TypeScript, Vite, Wouter (routing), TailwindCSS + shadcn/ui (slim, 16 components), Playwright (smoketest), GitHub Actions (deploy).

---

## Path Constants

These two paths recur throughout. Use them literally — no shell expansion of `~`.

- `REPO` = `C:\Users\Thierry Meyer\Claude\projects\Pixel-Flow-Builder`
- `REPLIT_SRC` = `C:\Users\Thierry Meyer\Documents\GitHub\Pixel-Flow-Builder\Pixel-Flow-Builder\Pixel-Flow-Builder`

All `cd` and absolute paths below refer to one of those.

## Reference Documents

- **Spec (authoritative):** `REPO/docs/superpowers/specs/2026-05-03-pixel-flow-builder-design.md`. Read it first if any decision in this plan seems unclear.
- **Verification results:** Spec Section 15. Already done — final dependency list in Task 1.1 reflects them.

## Conventions

- Run all `cd` and shell commands from `REPO` unless noted otherwise.
- After each phase: run `npm run typecheck` and commit. Build/preview only run in Phase 5.
- Commit message style: conventional commits (`feat:`, `chore:`, `docs:`). One commit per task unless explicitly bundled.
- All file copies preserve content byte-for-byte unless explicitly modified.
- Tool-page imports already use `@/`-alias which maps to `src/` in the new setup → tool pages copy 1:1, no rewrite.

---

## Phase 1: Skeleton (configs + entry files)

Goal: Empty Vite + React + Tailwind shell that builds and renders a placeholder.

### Task 1.1: Create `package.json`

**Files:**
- Create: `REPO/package.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "pixel-flow-builder",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test:smoke": "playwright test"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.453.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.2.5",
    "wouter": "^3.3.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@tailwindcss/typography": "^0.5.15",
    "@types/node": "20.19.27",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "typescript": "5.6.3",
    "vite": "^7.3.0"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: scaffold package.json with slim deps"
```

### Task 1.2: Create `tsconfig.json`

**Files:**
- Create: `REPO/tsconfig.json`

- [ ] **Step 1: Write `tsconfig.json`**

```json
{
  "include": ["src/**/*", "tests/**/*", "vite.config.ts", "playwright.config.ts"],
  "exclude": ["node_modules", "dist"],
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node", "vite/client"]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add tsconfig with @/ alias to src"
```

### Task 1.3: Create `vite.config.ts`

**Files:**
- Create: `REPO/vite.config.ts`

- [ ] **Step 1: Write `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/Pixel-Flow-Builder/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add vite config with GitHub Pages base path"
```

### Task 1.4: Create `tailwind.config.ts`

**Files:**
- Create: `REPO/tailwind.config.ts`
- Source: `REPLIT_SRC/tailwind.config.ts`

- [ ] **Step 1: Copy source verbatim, then change the `content` glob**

Read `REPLIT_SRC/tailwind.config.ts` and write it to `REPO/tailwind.config.ts` with **one** modification — the `content` field:

```ts
// in REPO/tailwind.config.ts
content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
```

(was: `["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"]`)

Everything else (theme, plugins) is preserved unchanged.

- [ ] **Step 2: Commit**

```bash
git add tailwind.config.ts
git commit -m "chore: add tailwind config (content paths adapted to root layout)"
```

### Task 1.5: Create `postcss.config.js`

**Files:**
- Create: `REPO/postcss.config.js`

- [ ] **Step 1: Write `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add postcss.config.js
git commit -m "chore: add postcss config"
```

### Task 1.6: Create `components.json` (shadcn config)

**Files:**
- Create: `REPO/components.json`

- [ ] **Step 1: Write `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components.json
git commit -m "chore: add shadcn components.json with @/ aliases"
```

### Task 1.7: Update `.gitignore`

**Files:**
- Modify: `REPO/.gitignore`

- [ ] **Step 1: Read current `.gitignore`**

Read `REPO/.gitignore`. Whatever exists is fine; we just add to it.

- [ ] **Step 2: Append the following lines**

```
node_modules/
dist/
.DS_Store
.env
.env.local
.vite/
playwright-report/
test-results/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: extend gitignore for vite/playwright artifacts"
```

### Task 1.8: Create `index.html`

**Files:**
- Create: `REPO/index.html`

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <link rel="icon" type="image/png" href="/Pixel-Flow-Builder/favicon.png" />
    <title>Pixel-Flow-Builder</title>
    <meta name="description" content="21 Canvas Creative Tools" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Fira+Code:wght@300..700&family=Geist+Mono:wght@100..900&family=Geist:wght@100..900&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400..700;1,400..700&family=Merriweather:ital,opsz,wght@0,18..144,300..900;1,18..144,300..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Open+Sans:ital,wght@0,300..800;1,300..800&family=Outfit:wght@100..900&family=Oxanium:wght@200..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100..900;1,100..900&family=Source+Code+Pro:ital,wght@0,200..900;1,200..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

The favicon path uses the GH-Pages base prefix so it resolves both locally (Vite dev injects the base) and on Pages.

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "chore: add index.html with title, description, font preload"
```

### Task 1.9: Copy favicon

**Files:**
- Create: `REPO/public/favicon.png`
- Source: `REPLIT_SRC/client/public/favicon.png`

- [ ] **Step 1: Ensure `REPO/public/` exists, then copy**

```bash
mkdir -p public
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/public/favicon.png" public/favicon.png
```

- [ ] **Step 2: Commit**

```bash
git add public/favicon.png
git commit -m "chore: import favicon from replit export"
```

### Task 1.10: Copy `src/index.css`

**Files:**
- Create: `REPO/src/index.css`
- Source: `REPLIT_SRC/client/src/index.css`

- [ ] **Step 1: Copy verbatim**

```bash
mkdir -p src
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/index.css" src/index.css
```

- [ ] **Step 2: Commit**

```bash
git add src/index.css
git commit -m "chore: import index.css (Tailwind base + theme vars) from replit"
```

### Task 1.11: Create `src/main.tsx` with Wouter base

**Files:**
- Create: `REPO/src/main.tsx`

- [ ] **Step 1: Write `src/main.tsx`**

```tsx
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <Router base="/Pixel-Flow-Builder">
    <App />
  </Router>
);
```

`Router base` only kicks in for matched paths; it lets the same `/pixel-flow` path string work both at `localhost:5173/Pixel-Flow-Builder/pixel-flow` (after Vite serves with the configured `base`) and at `thierrypsilon.github.io/Pixel-Flow-Builder/pixel-flow`.

- [ ] **Step 2: Commit**

```bash
git add src/main.tsx
git commit -m "feat: add main.tsx with Wouter base for GitHub Pages"
```

### Task 1.12: Install dependencies and verify the skeleton compiles

- [ ] **Step 1: Install**

```bash
npm install
```

Expected: no peer-dep errors (warnings ok). `package-lock.json` is created.

- [ ] **Step 2: Add `App.tsx` placeholder so `dev` doesn't error**

Create `REPO/src/App.tsx`:

```tsx
export default function App() {
  return (
    <div className="grid place-items-center h-dvh font-sans text-foreground bg-background">
      <p>Pixel-Flow-Builder skeleton</p>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS, no output other than completion.

- [ ] **Step 4: Run dev briefly to check Vite starts**

```bash
npm run dev
```

Open `http://localhost:5173/Pixel-Flow-Builder/` in the browser. Expected: placeholder page with text „Pixel-Flow-Builder skeleton". Stop the dev server (Ctrl+C).

- [ ] **Step 5: Commit lockfile + placeholder App**

```bash
git add package-lock.json src/App.tsx
git commit -m "chore: install deps, add placeholder App, verify skeleton compiles"
```

---

## Phase 2: Lib + Hooks + shadcn UI components

Goal: All shared utilities and the 16 actually-used shadcn components in place.

### Task 2.1: Create `src/lib/utils.ts`

**Files:**
- Create: `REPO/src/lib/utils.ts`

- [ ] **Step 1: Write `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add cn() utility for tailwind class merging"
```

### Task 2.2: Copy hooks (`use-mobile`, `use-toast`)

**Files:**
- Create: `REPO/src/hooks/use-mobile.tsx`
- Create: `REPO/src/hooks/use-toast.ts`
- Source: `REPLIT_SRC/client/src/hooks/use-mobile.tsx` and `use-toast.ts`

- [ ] **Step 1: Copy both verbatim**

```bash
mkdir -p src/hooks
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/hooks/use-mobile.tsx" src/hooks/use-mobile.tsx
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/hooks/use-toast.ts" src/hooks/use-toast.ts
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS. (These hooks reference `@/components/ui/toast` which doesn't exist yet — but TS only flags imports inside _used_ files. They'll be wired up in Task 2.3 / via `toaster.tsx`. If typecheck fails on missing imports, leave the failure — Task 2.3 will fix it.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/
git commit -m "feat: copy use-mobile and use-toast hooks from replit"
```

### Task 2.3: Copy 16 shadcn UI components

**Files (all create):**
- `REPO/src/components/ui/badge.tsx`
- `REPO/src/components/ui/button.tsx`
- `REPO/src/components/ui/card.tsx`
- `REPO/src/components/ui/dialog.tsx`
- `REPO/src/components/ui/input.tsx`
- `REPO/src/components/ui/label.tsx`
- `REPO/src/components/ui/separator.tsx`
- `REPO/src/components/ui/sheet.tsx`
- `REPO/src/components/ui/sidebar.tsx`
- `REPO/src/components/ui/skeleton.tsx`
- `REPO/src/components/ui/slider.tsx`
- `REPO/src/components/ui/switch.tsx`
- `REPO/src/components/ui/toast.tsx`
- `REPO/src/components/ui/toaster.tsx`
- `REPO/src/components/ui/toggle.tsx`
- `REPO/src/components/ui/tooltip.tsx`

Source: each at `REPLIT_SRC/client/src/components/ui/<name>.tsx`.

- [ ] **Step 1: Bulk-copy all 16**

```bash
mkdir -p src/components/ui
SRC="/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/components/ui"
for f in badge button card dialog input label separator sheet sidebar skeleton slider switch toast toaster toggle tooltip; do
  cp "$SRC/$f.tsx" "src/components/ui/$f.tsx"
done
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat: copy 16 shadcn ui components used by tools"
```

---

## Phase 3: Registry infrastructure + layout

Goal: Empty registry, layout components, schlanker App.tsx that renders an empty home grid.

### Task 3.1: Create `src/tools/types.ts`

**Files:**
- Create: `REPO/src/tools/types.ts`

- [ ] **Step 1: Write `src/tools/types.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/types.ts
git commit -m "feat: add ToolDefinition + PreviewDrawFn types"
```

### Task 3.2: Create empty `src/tools/registry.ts`

**Files:**
- Create: `REPO/src/tools/registry.ts`

- [ ] **Step 1: Write `src/tools/registry.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/registry.ts
git commit -m "feat: add empty registry, ready to be populated per tool"
```

### Task 3.3: Copy `tool-layout.tsx`

**Files:**
- Create: `REPO/src/components/tool-layout.tsx`
- Source: `REPLIT_SRC/client/src/components/tool-layout.tsx`

- [ ] **Step 1: Copy verbatim**

```bash
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/components/tool-layout.tsx" src/components/tool-layout.tsx
```

The `Link` from `wouter`, `Button` from `@/components/ui/button`, and lucide icons resolve identically in the new repo.

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/tool-layout.tsx
git commit -m "feat: copy tool-layout shared component"
```

### Task 3.4: Copy `home-sidebar.tsx`

**Files:**
- Create: `REPO/src/components/home-sidebar.tsx`
- Source: `REPLIT_SRC/client/src/components/home-sidebar.tsx`

- [ ] **Step 1: Copy verbatim**

```bash
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/components/home-sidebar.tsx" src/components/home-sidebar.tsx
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/home-sidebar.tsx
git commit -m "feat: copy home-sidebar component"
```

### Task 3.5: Create `src/components/home/tool-card.tsx`

This is the central canvas-rendering component for the home grid. It's extracted from Replit-`home.tsx:851–932` (the `ToolCard` function), generalized to take a `ToolDefinition` instead of the inline `Tool` interface.

**Files:**
- Create: `REPO/src/components/home/tool-card.tsx`
- Reference: `REPLIT_SRC/client/src/pages/home.tsx:851–932`

- [ ] **Step 1: Read the original `ToolCard`**

Open `REPLIT_SRC/client/src/pages/home.tsx` and read lines 851–932 to capture the original implementation: animated `<canvas>` ref + animation-frame loop calling `tool.draw(ctx, t, w, h)`, gradient overlay, title/description, tag badges, „Pop"-marker, hover-state, link to `tool.path`.

- [ ] **Step 2: Write `tool-card.tsx`**

Translate that implementation 1:1 into a new file at `REPO/src/components/home/tool-card.tsx`. The only structural change vs. the original:

- Import `ToolDefinition` from `@/tools/types` and use it as the `tool` prop type instead of the file-local `Tool` interface.
- Where the original calls `tool.draw(ctx, t, w, h)`, call `tool.preview(ctx, t, w, h)` — same signature, only the field name changed.
- Use `data-testid={`card-tool-${tool.id}`}` on the outer `<Link>` or wrapper element (the convention from `replit.md`).

Skeleton:

```tsx
import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import type { ToolDefinition } from "@/tools/types";

interface ToolCardProps {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: ToolCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();

    const loop = (now: number) => {
      const t = now - start;
      const { width, height } = canvas;
      tool.preview(ctx, t, width, height);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tool]);

  return (
    <Link
      href={tool.path}
      data-testid={`card-tool-${tool.id}`}
      className="group …"
    >
      {/* gradient overlay using `tool.gradient` */}
      {/* canvas, title, description, tags, popular marker */}
      {/* port the JSX from replit home.tsx:851–932 here */}
    </Link>
  );
}
```

The ellipses are placeholders for **the exact JSX/Tailwind classes from the original** — the executor must read the original and reproduce the structure, classes, and overlay markup. This task explicitly does not redesign the card; the goal is parity.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/tool-card.tsx
git commit -m "feat: extract ToolCard from old home.tsx into reusable component"
```

### Task 3.6: Create `src/components/home/home-page.tsx`

**Files:**
- Create: `REPO/src/components/home/home-page.tsx`
- Reference: `REPLIT_SRC/client/src/pages/home.tsx:933–end` (the `Home` component)

- [ ] **Step 1: Read the original `Home`**

Open `REPLIT_SRC/client/src/pages/home.tsx` from line 933 to the end of the file to see the layout (sidebar + grid + footer + „Inspiriert von ksawerykomputery.com/tools" link).

- [ ] **Step 2: Write `home-page.tsx`**

Reproduce that layout, but iterate `TOOLS` from the registry instead of the file-local `tools` array. Replace the heading „Creative Tools" with `Pixel-Flow-Builder` and the German text accordingly. Keep the „Inspiriert von …" attribution.

```tsx
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HomeSidebar } from "@/components/home-sidebar";
import { ToolCard } from "@/components/home/tool-card";
import { TOOLS } from "@/tools/registry";

export default function HomePage() {
  return (
    <SidebarProvider>
      <HomeSidebar />
      <main className="flex-1 overflow-auto">
        <SidebarTrigger />
        <header className="px-8 pt-12">
          <h1 className="text-4xl font-bold tracking-tight">
            Pixel-Flow-Builder
          </h1>
          <p className="text-muted-foreground mt-2">
            21 Canvas Creative Tools
          </p>
        </header>
        <section className="grid gap-6 p-8 md:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </section>
        <footer className="px-8 py-12 text-sm text-muted-foreground">
          <a
            href="https://ksawerykomputery.com/tools/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Inspiriert von ksawerykomputery.com/tools
          </a>
        </footer>
      </main>
    </SidebarProvider>
  );
}
```

The exact JSX above is a baseline; if the original `Home` has additional structure (specific spacing, sidebar-trigger placement, hero gradient, etc.) the executor reproduces it, with the same heading-text substitution.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/home-page.tsx
git commit -m "feat: home page rendered from tool registry, branded as Pixel-Flow-Builder"
```

### Task 3.7: Copy `not-found.tsx`

**Files:**
- Create: `REPO/src/pages/not-found.tsx`
- Source: `REPLIT_SRC/client/src/pages/not-found.tsx`

- [ ] **Step 1: Copy verbatim**

```bash
mkdir -p src/pages
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/pages/not-found.tsx" src/pages/not-found.tsx
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/not-found.tsx
git commit -m "feat: copy not-found page from replit"
```

### Task 3.8: Replace placeholder `src/App.tsx` with registry-driven version

**Files:**
- Modify: `REPO/src/App.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `REPO/src/App.tsx`:

```tsx
import { Suspense } from "react";
import { Switch, Route } from "wouter";
import HomePage from "@/components/home/home-page";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";
import { TOOLS } from "@/tools/registry";

export default function App() {
  return (
    <>
      <Suspense
        fallback={
          <div className="grid place-items-center h-dvh text-foreground bg-background">
            …
          </div>
        }
      >
        <Switch>
          <Route path="/" component={HomePage} />
          {TOOLS.map((t) => (
            <Route key={t.id} path={t.path} component={t.page} />
          ))}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <Toaster />
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run dev briefly, verify the empty home renders**

```bash
npm run dev
```

Open `http://localhost:5173/Pixel-Flow-Builder/` — expected: heading „Pixel-Flow-Builder", tagline „21 Canvas Creative Tools", **empty grid** (no cards yet, because registry is empty), footer attribution, sidebar visible. No errors in console. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: registry-driven App with Suspense + Toaster"
```

---

## Phase 4: Migrate the 21 tools

Goal: Each tool exists as a self-contained module under `src/tools/<id>/` and is registered in `src/tools/registry.ts`. Home page populates 21 cards.

### Tool Migration Procedure (read once, then apply per tool)

For each tool listed in 4.1–4.21, perform these 5 steps (replacing `<id>` with the tool id and `<RANGE>` with the tool's line range in `REPLIT_SRC/client/src/pages/home.tsx`):

#### Procedure step P1: Copy the page file verbatim

```bash
mkdir -p "src/tools/<id>"
cp "/c/Users/Thierry Meyer/Documents/GitHub/Pixel-Flow-Builder/Pixel-Flow-Builder/Pixel-Flow-Builder/client/src/pages/<id>.tsx" "src/tools/<id>/page.tsx"
```

No content modification. Imports use `@/`-alias which already resolves correctly.

#### Procedure step P2: Extract the preview into `preview.ts`

Open `REPLIT_SRC/client/src/pages/home.tsx` at the lines `<RANGE>`. The tool entry has shape:

```ts
{
  id: "<id>",
  title: "...",
  description: "...",
  path: "/<id>",
  tags: [...],
  gradient: "...",
  popular?: ...,
  draw: (ctx, t, w, h) => {
    // BODY — this is the preview
  },
},
```

Extract **only the `draw` function body** and write `REPO/src/tools/<id>/preview.ts`:

```ts
import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (ctx, t, w, h) => {
  // BODY — copied 1:1 from `draw` in home.tsx <RANGE>
};

export default drawPreview;
```

If the body references helper functions or constants that are defined inside the `draw` arrow at the top of its scope, keep them inside `drawPreview`. If anything is referenced from outside the arrow scope (uncommon — but check), copy that too into `preview.ts`.

#### Procedure step P3: Create `index.ts` with the ToolDefinition

Capture the metadata from the same entry — `title`, `description`, `path`, `tags`, `gradient`, `popular` — and pick a `category` from this mapping (also documented in the spec):

| ID | Category |
|---|---|
| pixel-flow, gradient-map, cellular-automata, shapes, text-effects, dithering, motion-track | `visual` |
| win95, defrag, screensaver, paint | `retro` |
| bytebeat, synthesizer, visualizer | `audio` |
| bubbles, radar | `physics` |
| ascii | `ascii` |
| shader, datamosh, pixelcrash, cursorvision | `webgl` |

Write `REPO/src/tools/<id>/index.ts` (use camelCase for the export):

```ts
import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const <camelId>: ToolDefinition = {
  id: "<id>",
  path: "/<id>",
  title: "<title from home.tsx>",
  description: "<description from home.tsx>",
  category: "<category from table>",
  gradient: "<gradient from home.tsx>",
  tags: [/* tags from home.tsx */],
  popular: /* popular from home.tsx if present, else omit */,
  page: lazy(() => import("./page")),
  preview,
};
```

Where `<camelId>` is the kebab-case id converted to camelCase: `pixel-flow` → `pixelFlow`, `gradient-map` → `gradientMap`, etc.

#### Procedure step P4: Register in the central registry

Open `REPO/src/tools/registry.ts`. Add the import at the top (alphabetical by id) and append the export to the `TOOLS` array (insertion order = home-page display order; **use the same order as the original `tools` array in Replit-`home.tsx` lines 22+** so the home grid order stays identical to the original).

```ts
import { <camelId> } from "./<id>";
// …
export const TOOLS: readonly ToolDefinition[] = [
  // … previously added tools in Replit display order
  <camelId>,
] as const;
```

#### Procedure step P5: Verify, run, commit

```bash
npm run typecheck
```

Expected: PASS.

```bash
npm run dev
```

Navigate to `http://localhost:5173/Pixel-Flow-Builder/<id>` — expected: page loads, no console errors, „Back to tools" button works. Navigate back to `/` — expected: card for this tool visible in grid, animated preview running. Stop dev server.

```bash
git add "src/tools/<id>/" src/tools/registry.ts
git commit -m "feat(tools): migrate <id>"
```

---

### Task 4.1: Migrate `motion-track`

**Apply the Tool Migration Procedure with these substitutions:**
- `<id>` = `motion-track`
- `<camelId>` = `motionTrack`
- `<RANGE>` = lines 24–82 of `REPLIT_SRC/client/src/pages/home.tsx`
- Category: `visual`

- [ ] P1 (copy page) — P2 (extract preview) — P3 (index.ts) — P4 (register) — P5 (verify + commit)

### Task 4.2: Migrate `pixel-flow`

- `<id>` = `pixel-flow`, `<camelId>` = `pixelFlow`, range 83–115, category `visual`
- [ ] P1–P5

### Task 4.3: Migrate `gradient-map`

- `<id>` = `gradient-map`, `<camelId>` = `gradientMap`, range 116–138, category `visual`
- [ ] P1–P5

### Task 4.4: Migrate `shapes`

- `<id>` = `shapes`, `<camelId>` = `shapes`, range 139–162, category `visual`
- [ ] P1–P5

### Task 4.5: Migrate `cellular-automata`

- `<id>` = `cellular-automata`, `<camelId>` = `cellularAutomata`, range 163–202, category `visual`
- [ ] P1–P5

### Task 4.6: Migrate `text-effects`

- `<id>` = `text-effects`, `<camelId>` = `textEffects`, range 203–239, category `visual`
- [ ] P1–P5

### Task 4.7: Migrate `dithering`

- `<id>` = `dithering`, `<camelId>` = `dithering`, range 240–258, category `visual`
- [ ] P1–P5

### Task 4.8: Migrate `win95`

- `<id>` = `win95`, `<camelId>` = `win95`, range 259–325, category `retro`
- [ ] P1–P5

### Task 4.9: Migrate `defrag`

- `<id>` = `defrag`, `<camelId>` = `defrag`, range 326–373, category `retro`
- [ ] P1–P5

### Task 4.10: Migrate `screensaver`

- `<id>` = `screensaver`, `<camelId>` = `screensaver`, range 374–400, category `retro`
- [ ] P1–P5

### Task 4.11: Migrate `paint`

- `<id>` = `paint`, `<camelId>` = `paint`, range 401–442, category `retro`
- [ ] P1–P5

### Task 4.12: Migrate `bytebeat`

- `<id>` = `bytebeat`, `<camelId>` = `bytebeat`, range 443–485, category `audio`
- [ ] P1–P5

### Task 4.13: Migrate `synthesizer`

- `<id>` = `synthesizer`, `<camelId>` = `synthesizer`, range 486–535, category `audio`
- [ ] P1–P5

### Task 4.14: Migrate `visualizer`

- `<id>` = `visualizer`, `<camelId>` = `visualizer`, range 536–561, category `audio`
- [ ] P1–P5

### Task 4.15: Migrate `bubbles`

- `<id>` = `bubbles`, `<camelId>` = `bubbles`, range 562–598, category `physics`
- [ ] P1–P5

### Task 4.16: Migrate `radar`

- `<id>` = `radar`, `<camelId>` = `radar`, range 599–643, category `physics`
- [ ] P1–P5

### Task 4.17: Migrate `shader`

- `<id>` = `shader`, `<camelId>` = `shader`, range 644–671, category `webgl`
- [ ] P1–P5

### Task 4.18: Migrate `ascii`

- `<id>` = `ascii`, `<camelId>` = `ascii`, range 672–714, category `ascii`
- [ ] P1–P5

### Task 4.19: Migrate `datamosh`

- `<id>` = `datamosh`, `<camelId>` = `datamosh`, range 715–748, category `webgl`
- [ ] P1–P5

### Task 4.20: Migrate `pixelcrash`

- `<id>` = `pixelcrash`, `<camelId>` = `pixelcrash`, range 749–798, category `webgl`
- [ ] P1–P5

### Task 4.21: Migrate `cursorvision`

- `<id>` = `cursorvision`, `<camelId>` = `cursorvision`, range 799–848, category `webgl`
- [ ] P1–P5

---

## Phase 5: Build & local verification

Goal: Production build succeeds, local preview shows everything working.

### Task 5.1: Production build

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: typecheck passes, vite outputs to `dist/`, no errors. Warnings about chunk size are acceptable for now.

- [ ] **Step 2: Inspect build output**

```bash
ls dist/
ls dist/assets/ | head
```

Expected: `dist/index.html`, `dist/favicon.png`, `dist/assets/` containing `index-*.js`, `index-*.css`, and 21 chunk files (one per lazy-loaded tool page).

- [ ] **Step 3: Commit if any incidental changes**

If only `dist/` was created (which is gitignored), no commit needed. If something else changed, commit it.

### Task 5.2: Preview build locally

- [ ] **Step 1: Serve the build**

```bash
npm run preview
```

- [ ] **Step 2: Manually visit each tool**

Open `http://localhost:4173/Pixel-Flow-Builder/`. Click through each of the 21 cards. For each:
- Page loads
- „Back to tools" button is visible and returns to home
- No console errors (for headless-only features like camera/microphone, „permission denied" warnings are expected — those are not failures here)

- [ ] **Step 3: Stop preview**

Ctrl+C in the terminal. No commit needed — this is verification only.

### Task 5.3: Direct-URL refresh test (SPA fallback simulation)

- [ ] **Step 1: With preview still running, open a sub-route directly**

In a fresh browser tab: `http://localhost:4173/Pixel-Flow-Builder/pixel-flow`. Expected: page loads correctly (Vite preview serves `index.html` for unknown paths automatically; in production we add `404.html` in Phase 8).

- [ ] **Step 2: Refresh the page**

Hit reload. Expected: same page reloads cleanly, no 404.

- [ ] **Step 3: Stop preview**

Ctrl+C.

---

## Phase 6: Tests

Goal: Playwright smoketest covering all 21 routes, runnable locally and in CI.

### Task 6.1: Create `playwright.config.ts`

**Files:**
- Create: `REPO/playwright.config.ts`

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173/Pixel-Flow-Builder",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://localhost:4173/Pixel-Flow-Builder/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: playwright config (chromium, vite preview as webServer)"
```

### Task 6.2: Create `tests/smoke.spec.ts`

**Files:**
- Create: `REPO/tests/smoke.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import { TOOLS } from "../src/tools/registry";

for (const tool of TOOLS) {
  test(`${tool.id} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (tool.expectedConsoleErrors?.some((rx) => rx.test(text))) return;
      errors.push(`console: ${text}`);
    });

    await page.goto(tool.path);
    await expect(
      page.locator('[data-testid="button-back-to-tools"]')
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    expect(
      errors,
      `Errors on ${tool.path}:\n${errors.join("\n")}`
    ).toEqual([]);
  });
}

test("home renders all tool cards", async ({ page }) => {
  await page.goto("/");
  for (const tool of TOOLS) {
    await expect(
      page.locator(`[data-testid="card-tool-${tool.id}"]`)
    ).toBeVisible();
  }
});
```

- [ ] **Step 2: Install Playwright browser**

```bash
npx playwright install --with-deps chromium
```

(`--with-deps` is harmless on Windows; on Linux CI it installs system deps.)

- [ ] **Step 3: Run the test**

```bash
npm run test:smoke
```

Expected: 22 tests pass (21 tool routes + 1 home grid). If a tool fails because of a legit console-error that's expected (e.g. camera permission denied in headless), add a `expectedConsoleErrors: [/Permission denied/]` field in that tool's `index.ts` and re-run.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke.spec.ts
git commit -m "test: smoketest covers all 21 tool routes + home grid"
```

### Task 6.3: Add tests directory to gitignore exclusion (already excluded artifacts)

No action needed — `playwright-report/` and `test-results/` were added in Task 1.7. Verify:

- [ ] **Step 1: Confirm artifacts are ignored**

```bash
git status
```

Expected: no `playwright-report/` or `test-results/` listed as untracked. If they are, add them to `.gitignore` and commit.

---

## Phase 7: Documentation

Goal: README and CLAUDE.md in place.

### Task 7.1: Write `README.md`

**Files:**
- Modify: `REPO/README.md` (currently a 2-line stub)

- [ ] **Step 1: Replace contents**

```markdown
# Pixel-Flow-Builder

> 21 Canvas Creative Tools — interactive browser-based experiments with Canvas 2D, Web Audio, and WebGL.

**Live:** https://thierrypsilon.github.io/Pixel-Flow-Builder/

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/Pixel-Flow-Builder/

## Production Build

```bash
npm run build
npm run preview
```

## Tests

```bash
npm run test:smoke
```

## Tools

| Category | Tools |
|---|---|
| Visual | pixel-flow, gradient-map, cellular-automata, shapes, text-effects, dithering, motion-track |
| Retro | win95, defrag, screensaver, paint |
| Audio | bytebeat, synthesizer, visualizer |
| Physics | bubbles, radar |
| ASCII | ascii |
| WebGL | shader, datamosh, pixelcrash, cursorvision |

## Add a new tool

1. Create `src/tools/<id>/` with `page.tsx`, `preview.ts`, and `index.ts`
2. Add the tool's import + entry to `src/tools/registry.ts`
3. Done — route, sidebar entry, and home card appear automatically

## Stack

React 18 · TypeScript · Vite · Wouter · TailwindCSS · shadcn/ui · Playwright

## Credit

Tool collection inspired by [ksawerykomputery.com/tools](https://ksawerykomputery.com/tools/) and [windows93.net](https://windows93.net).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with usage, tool list, add-new-tool guide"
```

### Task 7.2: Write `CLAUDE.md`

**Files:**
- Create: `REPO/CLAUDE.md`

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# Pixel-Flow-Builder — Claude Code instructions

## Project Type

Frontend-only React SPA, deployed as static site to GitHub Pages. No backend, no DB, no auth.

## Tool-Registry Convention

All tools live under `src/tools/<id>/` with three files:

- `page.tsx` — the React component for the tool's full route (lazy-loaded)
- `preview.ts` — pure draw function `(ctx, t, w, h) => void` for the home-grid card
- `index.ts` — exports a `ToolDefinition` (camelCase named export)

The central `src/tools/registry.ts` imports each tool's definition and assembles the `TOOLS` array. Routes, sidebar entries, and home cards are derived from this array — never duplicate registrations.

## Add a new tool

1. Create `src/tools/<id>/` with the three files above
2. Add the import + entry to `src/tools/registry.ts` (preserve display order)
3. Done — route, sidebar, home card appear automatically

## Test coverage exception

The 80% test coverage rule from `~/.claude/CLAUDE.md` does **not** apply to this project. Imperative Canvas/WebGL/Web-Audio render loops are not meaningfully unit-testable. Coverage is provided by Playwright route smoketests in `tests/smoke.spec.ts` (page loads, layout renders, no console errors). Do not add unit tests per tool unless solving a specific regression.

## Deployment

- Push to `main` triggers `.github/workflows/deploy.yml`
- Build output is `dist/`, base path is `/Pixel-Flow-Builder/`
- SPA fallback: `dist/404.html` is a copy of `dist/index.html` (postbuild step in CI)
- GitHub-Pages source must be set to „GitHub Actions" in the repo settings (one-time manual step)

## Out of scope

No backend, no database, no auth, no analytics, no PWA, no i18n, no custom domain (yet).
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with tool-registry convention and coverage exception"
```

---

## Phase 8: CI & Deploy

Goal: Push to `main` builds, tests, and deploys to GitHub Pages automatically.

### Task 8.1: Create `.github/workflows/deploy.yml`

**Files:**
- Create: `REPO/.github/workflows/deploy.yml`

- [ ] **Step 1: Ensure directory exists**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:smoke
      - run: cp dist/index.html dist/404.html
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions workflow for typecheck, build, smoketest, deploy"
```

### Task 8.2: Push everything to GitHub

- [ ] **Step 1: Verify branch is up to date**

```bash
git status
git log --oneline -10
```

Expected: working tree clean. Many commits ahead of `origin/main`.

- [ ] **Step 2: Push**

```bash
git push origin main
```

Expected: push succeeds. The Actions workflow starts automatically.

- [ ] **Step 3: Watch the workflow**

```bash
gh run watch
```

(Or: open the GitHub repo → Actions tab → click the running workflow.)

If `gh` CLI isn't authenticated locally, instruct the user to do so OR open the URL in browser. Wait for the build job to either succeed or surface the first error.

If the workflow fails: do not retry blindly. Read the error, fix the underlying issue (commit + push), let it re-run.

### Task 8.3: Manual user step — enable Pages

This is **not** automatable from CLI without a token + REST call we'd rather not script. Surface this clearly to the user.

- [ ] **Step 1: Output the manual instruction**

> **User action required:**
> Open `https://github.com/Thierrypsilon/Pixel-Flow-Builder/settings/pages`.
> Under „Build and deployment" → „Source", select **„GitHub Actions"**.
> Save. The next workflow run (or a re-run from Actions tab) will then publish the site.

- [ ] **Step 2: Wait for confirmation from the user**

Do not proceed to 8.4 until the user confirms.

### Task 8.4: Verify the live deployment

- [ ] **Step 1: Open the live URL**

```
https://thierrypsilon.github.io/Pixel-Flow-Builder/
```

Expected: home page loads, sidebar visible, 21 tool cards rendered with animated previews, no console errors.

- [ ] **Step 2: Sanity-click 3 tools**

Open `pixel-flow`, `win95`, and `cursorvision` (a mix across categories). Each should load, render its UI, and the back-button should return to home.

- [ ] **Step 3: Direct-URL refresh test**

Reload the browser while on `https://thierrypsilon.github.io/Pixel-Flow-Builder/pixel-flow`. Expected: page reloads correctly (the `404.html` fallback wired in CI handles this).

- [ ] **Step 4: Report success to user**

Report: live URL, the commit SHA that's deployed, brief summary of what was migrated.

---

## End of Plan

After Task 8.4 the migration is complete. The Replit export at `REPLIT_SRC` can stay where it is — nothing in the new repo references it anymore.
