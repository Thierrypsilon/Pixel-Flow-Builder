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

## tsconfig deviations from `~/.claude/rules/typescript`

`noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are intentionally disabled. The 21 imported tool pages from the Replit export use a looser convention (unused locals from copy-paste, unused params in callback signatures). `strict: true` and other safety flags remain enabled.

## Preview functions and SSR-safety

`preview.ts` files run in two contexts:
1. The browser, when home-page cards animate
2. Node, when Playwright's spec loader imports `src/tools/registry`

Don't call `document.createElement` (or any browser-only API) in the IIFE-closure at module load. Defer it to the first invocation of the returned draw function, like:

```ts
const drawPreview: PreviewDrawFn = (() => {
  let sc: HTMLCanvasElement | null = null;
  return (ctx, t, w, h) => {
    if (!sc) sc = document.createElement("canvas");
    // ... use sc
  };
})();
```

## Deployment

- Push to `main` triggers `.github/workflows/deploy.yml`
- Build output is `dist/`, base path is `/Pixel-Flow-Builder/`
- SPA fallback: `dist/404.html` is a copy of `dist/index.html` (postbuild step in CI)
- One-time manual step: enable Pages at `Settings → Pages → Source = "GitHub Actions"`. The workflow uses `actions/configure-pages@v4` with `enablement: true`, but the default `GITHUB_TOKEN` lacks the scope to actually flip the switch (the action returns "Resource not accessible by integration"). Once a human enables Pages, every subsequent workflow run is fully automatic.

## Bikecenter Meyer print/social materials — wording rules

The `door-sign/`, `vacation-sign/`, `service-tip/` and `social-closed/` folders
hold Pillow scripts that generate customer-facing signs, handout cards and
social-media graphics for the bike business (unrelated to the React SPA).

All customer-facing copy — on signs, cards and in social-media post text —
must follow these rules:

**Primary language is German.** Sankt Vith is in the German-speaking Community
of Belgium. French is an equal second language on every customer-facing piece,
set below/smaller than the German line. Never German-only, never French-first.

**Required wording for the business itself:**

| Use | Avoid | Why |
| --- | --- | --- |
| „das Geschäft", „die Werkstatt" | „der Laden" | sounds unprofessional |
| „das Geschäft", „die Werkstatt" | „der Shop" | anglicism, not proper German |

French equivalents: „le magasin", „l'atelier".

Keep the register professional but warm — this is a customer-facing small
business, not internal chat. Ask before inventing a reason for a closure; state
only facts the owner has given.

## Out of scope

No backend, no database, no auth, no analytics, no PWA, no i18n, no custom domain (yet).
