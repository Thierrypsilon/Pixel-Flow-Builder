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
