# Pixel-Flow-Builder — Design Spec

**Datum:** 2026-05-03
**Status:** Approved (Brainstorming-Phase abgeschlossen)
**Repo:** `https://github.com/Thierrypsilon/Pixel-Flow-Builder`
**Lokal:** `C:\Users\Thierry Meyer\Claude\projects\Pixel-Flow-Builder\`
**Replit-Quelle (entpackter Export):** `C:\Users\Thierry Meyer\Documents\GitHub\Pixel-Flow-Builder\Pixel-Flow-Builder\Pixel-Flow-Builder\`

---

## 1. Kontext & Ziel

Bestehender Replit-Export einer Sammlung von **21 browser-basierten Canvas/Audio/WebGL-Tools** (Originalname „Creative Tools") soll in den schon existierenden, aktuell leeren GitHub-Repo `Pixel-Flow-Builder` migriert werden.

Die Migration ist **kein 1:1-Dump**, sondern:
- **Slim**: Replit-Boilerplate (Server, DB, Auth, Replit-Plugins) wird verworfen
- **Refactor**: Tool-Registry-Pattern statt 21 harter Imports in `App.tsx` und `home.tsx`
- **Deploy-ready**: GitHub Pages mit Auto-Deploy via Actions

## 2. Entscheidungen (Brainstorming-Antworten)

| # | Frage | Entscheidung |
|---|---|---|
| 1 | Migrations-Strategie | Slim-Migration — nur tatsächlich genutzten Code übernehmen |
| 2 | Tool-Scope | Alle 21 Tools übernehmen |
| 3 | Hosting | GitHub Pages |
| 4 | Migrations-Ziel | Migrieren + Refactor (modulare Tool-Registry) |
| 5 | Registry-Variante | A — pro Tool ein Definition-File (`src/tools/<id>/index.ts`) |
| 6 | Branding | App-Name = `Pixel-Flow-Builder`, Tagline = `21 Canvas Creative Tools` |

## 3. Stack (final)

React 18 + TypeScript + Vite + Wouter + TailwindCSS + shadcn/ui (slim — nur tatsächlich genutzte Komponenten) + framer-motion + lucide-react + zod.

**Kein** Express, **kein** DB, **kein** Auth, **kein** React-Query, **kein** Replit-Plugin.

## 4. Datei-Layout (Ziel-Repo)

```
Pixel-Flow-Builder/
├── .github/workflows/deploy.yml      ← GH-Actions: typecheck + build + smoketest + deploy
├── public/
│   └── favicon.png
├── src/
│   ├── main.tsx                      ← Entry, mit <Router base="/Pixel-Flow-Builder">
│   ├── App.tsx                       ← schlank: lädt Routes aus Registry
│   ├── index.css                     ← Tailwind + Theme-Vars
│   ├── tools/
│   │   ├── types.ts                  ← ToolDefinition, ToolCategory
│   │   ├── registry.ts               ← Aggregator: TOOLS = [...], TOOLS_BY_CATEGORY
│   │   ├── pixel-flow/
│   │   │   ├── index.ts              ← exportiert ToolDefinition
│   │   │   ├── page.tsx              ← React Component (lazy-loaded)
│   │   │   └── preview.tsx           ← Mini-Canvas-Preview für Home-Card (eager)
│   │   ├── gradient-map/  …          ← analog
│   │   └── …                          ← 21 Tool-Ordner total
│   ├── components/
│   │   ├── tool-layout.tsx           ← Shared Tool-Header mit Back-Button
│   │   ├── home-sidebar.tsx
│   │   ├── home/
│   │   │   ├── home-page.tsx         ← rendert ToolCards aus Registry
│   │   │   └── tool-card.tsx
│   │   └── ui/                       ← nur tatsächlich genutzte shadcn-Komponenten
│   ├── hooks/                        ← nur tatsächlich genutzte hooks
│   ├── lib/
│   │   └── utils.ts                  ← cn() etc.
│   └── pages/
│       └── not-found.tsx
├── tests/
│   └── smoke.spec.ts                 ← Playwright: 21 Route-Smoketests + Home-Card-Test
├── index.html                        ← Repo-Root, kein client/-Wrapper
├── vite.config.ts                    ← base: '/Pixel-Flow-Builder/'
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── playwright.config.ts
├── package.json                      ← Deps stark reduziert, name: pixel-flow-builder
├── .gitignore
├── README.md                         ← Tagline, Live-URL, Local-Dev, Deploy
└── CLAUDE.md                         ← Tool-Registry-Konvention, Add-New-Tool-Guide,
                                       Test-Coverage-Ausnahme dokumentiert
```

## 5. Tool-Registry — Schnittstelle

### `src/tools/types.ts`

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
  t: number,         // animation time in ms
  w: number,         // canvas width
  h: number          // canvas height
) => void;

export interface ToolDefinition {
  id: string;                                       // z.B. "pixel-flow"
  path: string;                                     // z.B. "/pixel-flow"
  title: string;                                    // sichtbarer Name
  description: string;                              // 1-Zeiler für Card
  category: ToolCategory;
  page: LazyExoticComponent<ComponentType>;         // lazy-loaded Page
  preview: PreviewDrawFn;                           // pure draw-fn (1:1 Replit-Übernahme)
  gradient: string;                                 // Tailwind-Gradient für Card, z.B. "from-purple-500 to-fuchsia-500"
  tags?: string[];                                  // optional, z.B. ["Video", "Kamera"]
  popular?: boolean;                                // optional, hebt Card hervor
  expectedConsoleErrors?: RegExp[];                 // optional, vom Smoketest gefiltert
}
```

### `src/tools/pixel-flow/preview.ts` (pure draw-fn, 1:1 aus alter `home.tsx` extrahiert)

```ts
import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (ctx, t, w, h) => {
  // … extracted body of the matching `draw(ctx, t, w, h)` from old home.tsx
};

export default drawPreview;
```

### `src/tools/pixel-flow/index.ts` (Beispiel pro Tool)

```ts
import { lazy } from "react";
import type { ToolDefinition } from "../types";
import preview from "./preview";

export const pixelFlow: ToolDefinition = {
  id: "pixel-flow",
  path: "/pixel-flow",
  title: "Pixel Flow",
  description: "Echtzeit Kamera-Pixelkunst mit Dithering-Effekten",
  category: "visual",
  gradient: "from-purple-500 to-fuchsia-500",
  tags: ["Video", "Kamera"],
  popular: true,
  page: lazy(() => import("./page")),
  preview,
};
```

`src/components/home/tool-card.tsx` ist eine zentrale React-Komponente, die das Canvas-Setup + Animations-Loop macht und in jedem Frame `tool.preview(ctx, t, w, h)` aufruft. Die alte `ToolCard` aus Replit-`home.tsx:851–932` wird 1:1 dorthin extrahiert.

### `src/tools/registry.ts`

```ts
import { pixelFlow } from "./pixel-flow";
import { gradientMap } from "./gradient-map";
// … 19 weitere Imports

import type { ToolCategory, ToolDefinition } from "./types";

export const TOOLS: readonly ToolDefinition[] = [
  pixelFlow, gradientMap, /* … */
] as const;

export const TOOLS_BY_CATEGORY: Record<ToolCategory, ToolDefinition[]> =
  TOOLS.reduce(
    (acc, t) => {
      (acc[t.category] ||= []).push(t);
      return acc;
    },
    {} as Record<ToolCategory, ToolDefinition[]>
  );
```

### `src/App.tsx`

```tsx
import { Suspense } from "react";
import { Switch, Route } from "wouter";
import { TOOLS } from "./tools/registry";
import HomePage from "./components/home/home-page";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <Suspense fallback={<div className="grid place-items-center h-dvh">…</div>}>
      <Switch>
        <Route path="/" component={HomePage} />
        {TOOLS.map((t) => (
          <Route key={t.id} path={t.path} component={t.page} />
        ))}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```

### Add-a-new-tool — 3 Schritte

1. Ordner `src/tools/<id>/` mit `index.ts`, `page.tsx`, `preview.tsx` anlegen
2. Import + Eintrag in `src/tools/registry.ts` ergänzen
3. Fertig — Route, Sidebar, Home-Card erscheinen automatisch

## 6. Tool-Liste (alle 21)

| ID | Titel | Kategorie | Replit-LOC |
|---|---|---|---|
| `pixel-flow` | Pixel Flow | visual | 728 |
| `gradient-map` | Gradient Map | visual | 250 |
| `cellular-automata` | Cellular Automata | visual | 270 |
| `shapes` | Shapes | visual | 256 |
| `text-effects` | Text Effects | visual | 271 |
| `dithering` | Dithering | visual | 307 |
| `motion-track` | Motion Track | visual | 770 |
| `win95` | Win95 Windows | retro | 681 |
| `defrag` | Defrag | retro | 347 |
| `screensaver` | Screensaver | retro | 350 |
| `paint` | Paint | retro | 339 |
| `bytebeat` | ByteBeat | audio | 310 |
| `synthesizer` | Synthesizer | audio | 360 |
| `visualizer` | Visualizer | audio | 338 |
| `bubbles` | Bubbles | physics | 280 |
| `radar` | Radar | physics | 302 |
| `ascii` | ASCII Kit | ascii | 518 |
| `shader` | Shader Player | webgl | 301 |
| `datamosh` | Datamosh | webgl | 319 |
| `pixelcrash` | Pixel Crash | webgl | 511 |
| `cursorvision` | CursorVision | webgl | 623 |

## 7. Migration-Mapping

### 7.1 Wird übernommen (1:1, nur Pfade umgebogen)

| Replit-Quelle | Neuer Pfad |
|---|---|
| `client/src/pages/<id>.tsx` (21 Files) | `src/tools/<id>/page.tsx` |
| `client/src/pages/not-found.tsx` | `src/pages/not-found.tsx` |
| `client/src/components/tool-layout.tsx` | `src/components/tool-layout.tsx` |
| `client/src/components/home-sidebar.tsx` | `src/components/home-sidebar.tsx` |
| `client/src/index.css` | `src/index.css` |
| `client/src/main.tsx` | `src/main.tsx` (mit Router-Base) |
| `client/index.html` | `index.html` (Repo-Root) |
| `client/public/favicon.png` | `public/favicon.png` |
| `client/src/lib/utils.ts` | `src/lib/utils.ts` |
| `client/src/hooks/*` | `src/hooks/*` (nur falls genutzt) |
| `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json`, `components.json` | Repo-Root, Pfade angepasst |

### 7.2 Wird umgebaut

| Replit-Quelle | Neu |
|---|---|
| `client/src/App.tsx` (71 LOC, 21 harte Imports) | `src/App.tsx` — schlank, lädt aus Registry |
| `client/src/pages/home.tsx` (1005 LOC, 21 Inline-Previews) | `src/components/home/home-page.tsx` (klein) + `src/components/home/tool-card.tsx` + `src/tools/<id>/preview.tsx` (21 Stk, je ~30–60 LOC) |
| `vite.config.ts` | Replit-Plugins raus, `base: '/Pixel-Flow-Builder/'`, `root` auf Repo-Root |
| `package.json` | ~30 Deps raus, scripts neu, `name: "pixel-flow-builder"` |

### 7.3 Wird komplett verworfen

- `server/` (5 Files) — Backend ungenutzt
- `shared/schema.ts` — Drizzle-User-Tabelle ungenutzt
- `script/build.ts` — esbuild-Server-Bundle, ersetzt durch reines `vite build`
- `drizzle.config.ts`
- `client/src/lib/queryClient.ts` — react-query nirgends genutzt
- `attached_assets/` (952 KB) — vermutlich nirgends importiert (in 8.1 verifizieren)
- `.replit`, `.local/`, `.agents/`
- `replit.md` — Inhalt wandert in neue `README.md` + `CLAUDE.md`

### 7.4 Deps-Diet

**Raus aus `dependencies`:**
`express`, `express-session`, `connect-pg-simple`, `memorystore`, `passport`, `passport-local`, `pg`, `drizzle-orm`, `drizzle-zod`, `ws`, `@tanstack/react-query`, `nanoid` (sofern nur server-vite-internal genutzt)

**Raus aus `devDependencies`:**
`@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal`, `drizzle-kit`, `esbuild` (Vite bringt mit), `tsx` (kein Server-Run), `@types/express`, `@types/express-session`, `@types/connect-pg-simple`, `@types/passport`, `@types/passport-local`, `@types/ws`

**Raus aus `optionalDependencies`:**
`bufferutil`

**shadcn/ui (47 Komponenten in `client/src/components/ui/`):**
Vor Migration: Import-Scan über alle Pages/Components; nur tatsächlich importierte ui-Files übernehmen. Schätzung: 5–15 von 47 bleiben. Entsprechende `@radix-ui/*`-Deps fliegen mit raus.

**`react-hook-form` + `@hookform/resolvers`:** vor Migration verifizieren ob in irgendeinem Tool genutzt. Wenn nein, raus.

**`framer-motion`:** vor Migration verifizieren ob tatsächlich genutzt (vermutlich für Home-Animationen). Wenn nein, raus.

## 8. Verifikationsschritte vor Migration

Erste Schritte der Implementierung — kein Code wird blind übernommen.

### 8.1 Pflicht-Verifikationen

1. shadcn/ui — welche Komponenten in `client/src/components/ui/` werden tatsächlich aus Pages oder anderen Components importiert?
2. `@radix-ui/*` — welche werden direkt importiert (außerhalb von ui/)?
3. `attached_assets/*` — wird via `@assets`-Alias irgendwo importiert?
4. `framer-motion` — wo importiert?
5. `react-hook-form`, `@hookform/resolvers` — wo importiert?
6. `zod` — wo importiert (außer von toter `shared/schema.ts`)?
7. `next-themes`, `vaul`, `cmdk`, `recharts`, `embla-carousel-react`, `react-day-picker`, `react-icons`, `input-otp`, `react-resizable-panels`, `date-fns` — alle vermutlich nur als shadcn-Indirekt-Deps; bei Nicht-Nutzung kicken
8. `client/src/hooks/use-mobile.tsx`, `use-toast.ts` — wo genutzt?

### 8.2 Bleiben in jedem Fall (Tailwind/shadcn-Basis)

`react`, `react-dom`, `wouter`, `tailwindcss`, `autoprefixer`, `postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css`, `@tailwindcss/typography`, `lucide-react`, `@vitejs/plugin-react`, `vite`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`.

Befunde aus 8.1 entscheiden über finale Deps-Liste. Bei Funden, die das Mapping ändern, vor Implementierung melden.

## 9. Build & Deploy

### 9.1 Vite-Config

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/Pixel-Flow-Builder/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
```

### 9.2 Wouter Router-Base

```tsx
// src/main.tsx
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Router base="/Pixel-Flow-Builder">
    <App />
  </Router>
);
```

Tool-Pfade (`/pixel-flow` etc.) funktionieren lokal (`npm run dev`, kein Base) und auf Pages (mit Base-Prefix) automatisch.

### 9.3 SPA-404-Fallback

Pages serviert nur Statics. Bei Direkt-Aufruf einer Sub-Route (z.B. `/Pixel-Flow-Builder/pixel-flow`) → 404, weil das Verzeichnis nicht existiert. Workaround: `dist/index.html` nach `dist/404.html` kopieren als Postbuild-Step in der GH-Action. Pages serviert die 404 bei Not-Found, React-App startet, Wouter routet korrekt.

### 9.4 GitHub-Actions-Workflow

```yaml
# .github/workflows/deploy.yml
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
        with: { path: ./dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 9.5 `package.json` scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test:smoke": "playwright test"
  }
}
```

### 9.6 Manueller One-Time-Schritt durch User

Nach erstem Push:
GitHub-Repo → **Settings → Pages → Source = „GitHub Actions"** klicken.

Wird **nicht** durch die Implementierung automatisiert (kein Repo-Setting-Zugriff via Code). Steht im Plan als „Manuell durch User".

## 10. Tests — Smoketest-Pyramide

### Tier 1: Type-Check (CI-Pflicht)
`npm run typecheck` → `tsc --noEmit`. Fängt 80% der Migrationsfehler.

### Tier 2: Build-Smoketest (CI-Pflicht)
`npm run build` muss durchlaufen. Vite warnt bei kaputten Imports/Aliases.

### Tier 3: Route-Smoketest mit Playwright

`tests/smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { TOOLS } from "../src/tools/registry";

for (const tool of TOOLS) {
  test(`${tool.id} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (tool.expectedConsoleErrors?.some((rx) => rx.test(text))) return;
      errors.push(text);
    });

    await page.goto(tool.path);
    await expect(
      page.locator('[data-testid="button-back-to-tools"]')
    ).toBeVisible();
    await page.waitForTimeout(1000);
    expect(errors, `Errors on ${tool.path}:\n${errors.join("\n")}`).toEqual([]);
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

### Bewusst NICHT getestet
- Pixel-perfekte Canvas-Outputs (Snapshots würden flaky)
- WebGL-Shader-Korrektheit
- Audio-Output (Web Audio API headless unzuverlässig)
- Kamera/Mikro-Features (brauchen Hardware-Permissions)

### Coverage-Ausnahme
80%-Coverage-Pflicht aus `~/.claude/CLAUDE.md` ist für dieses Projekt **nicht sinnvoll** (imperative Canvas-Renderschleifen). Wird als bewusste Ausnahme in der `CLAUDE.md` des Repos dokumentiert.

## 11. Branding

| Stelle | Wert |
|---|---|
| App-Name (Tab-Title, Sidebar-Headline, Home-H1) | `Pixel-Flow-Builder` |
| Tagline (unter H1, Meta-Description, README-Untertitel) | `21 Canvas Creative Tools` |
| `package.json` `name` | `pixel-flow-builder` |
| README-Titel | `# Pixel-Flow-Builder` mit Tagline-Zeile drunter |
| GitHub-Pages-URL | `https://thierrypsilon.github.io/Pixel-Flow-Builder/` |

## 12. Implementierungs-Reihenfolge (high-level)

Detaillierter Plan kommt aus dem `writing-plans`-Skill. Grobe Phasen:

1. Verifikationsschritte (8.1) durchführen, finale Deps-Liste erstellen
2. Skelett anlegen: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `.gitignore`
3. Registry-Infrastruktur: `src/tools/types.ts`, leere `src/tools/registry.ts`, `src/App.tsx`, `src/components/tool-layout.tsx`, `src/components/home-sidebar.tsx`, `src/components/home/home-page.tsx`, `src/components/home/tool-card.tsx`, `src/pages/not-found.tsx`
4. Genutzte shadcn-Komponenten + lib/utils + hooks übernehmen
5. **Pro Tool** (21x): Ordner anlegen, Page übernehmen (Imports anpassen), Preview aus Replit-`home.tsx` extrahieren, `index.ts` bauen, in Registry registrieren
6. Build + Typecheck lokal grün
7. Playwright-Setup (`playwright.config.ts`, `@playwright/test` als devDep) + Smoketest-File `tests/smoke.spec.ts`
8. README.md + CLAUDE.md
9. GitHub-Actions-Workflow
10. Commit + Push
11. **User-Manual:** Pages-Setting auf „GitHub Actions" stellen
12. Verifizieren dass Live-URL funktioniert

## 13. Out-of-Scope (NICHT machen)

- Backend / DB / Auth / API-Endpunkte
- Pixel-perfect Visual-Regression-Tests
- Custom Domain (kann später nachgereicht werden)
- Code-Verbesserungen an einzelnen Tools (Bugs/UX) jenseits dessen, was die Migration zwingend erfordert
- Übersetzung / i18n
- PWA / Service Worker
- Analytics / Telemetry

## 14. Offene Punkte

Keine. Alle Brainstorming-Fragen beantwortet.

## 15. Verifikationsergebnisse (post-spec, 2026-05-03)

Verifikation aus Sektion 8 wurde vorab durchgeführt — Befunde fließen in den Implementierungsplan ein:

**Tatsächlich genutzte shadcn/ui-Komponenten (16 von 47):**
`badge, button, card, dialog, input, label, separator, sheet, sidebar, skeleton, slider, switch, toast, toaster, toggle, tooltip`

**Tatsächlich genutzte `@radix-ui/*` (9 von 27):**
`react-dialog, react-label, react-separator, react-slider, react-slot, react-switch, react-toast, react-toggle, react-tooltip`

**Genutzte Hooks (beide):** `use-mobile.tsx` (von ui/sidebar), `use-toast.ts` (von ui/toaster)

**Komplett ungenutzt im Client (raus):**
`framer-motion`, `react-hook-form`, `@hookform/resolvers`, `zod` (nur in toter `shared/schema.ts`), `@tanstack/react-query`, `next-themes`, `vaul`, `cmdk`, `recharts`, `embla-carousel-react`, `react-day-picker`, `react-icons`, `input-otp`, `react-resizable-panels`, `date-fns`, `nanoid`, alle 18 nicht-genutzten `@radix-ui/*`, alle Replit-Plugins, alle Backend/DB/Auth-Deps, `@assets`-Alias und `attached_assets/`.

**Tool-Pages benötigen KEINE Import-Anpassungen:** Sie importieren via `@/`-Alias, der im neuen Setup direkt auf `src/` zeigt. Same relative paths.

**Korrektur am Registry-Interface:** `preview` ist eine pure draw-Funktion `(ctx, t, w, h) => void` (siehe Section 5), nicht eine React-Component. Plus zusätzliche Felder `gradient` (required) und `popular` (optional), wie in Replit-`home.tsx`.
