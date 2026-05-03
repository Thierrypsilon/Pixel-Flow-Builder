import { useEffect, useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToolLayout } from "@/components/tool-layout";
import { Play, Pause, RefreshCw, Settings2, ChevronRight, ChevronLeft, Eraser, Pencil } from "lucide-react";

type Rule = "life" | "brian" | "seeds" | "daynight" | "highlife";

const RULES: { id: Rule; name: string; desc: string }[] = [
  { id: "life", name: "Game of Life", desc: "B3/S23 — Klassischer Conway" },
  { id: "highlife", name: "HighLife", desc: "B36/S23 — Mit Replikatoren" },
  { id: "daynight", name: "Day & Night", desc: "B3678/S34678" },
  { id: "brian", name: "Brian's Brain", desc: "3 Zustände: Tot, Lebend, Sterbend" },
  { id: "seeds", name: "Seeds", desc: "B2/S0 — Explosives Wachstum" },
];

const COLORS: { name: string; alive: string; dying: string; bg: string }[] = [
  { name: "Grün", alive: "0,220,80", dying: "0,80,30", bg: "0,15,5" },
  { name: "Cyan", alive: "0,220,255", dying: "0,80,120", bg: "0,5,15" },
  { name: "Violet", alive: "160,80,255", dying: "60,0,120", bg: "10,0,20" },
  { name: "Feuer", alive: "255,140,0", dying: "180,20,0", bg: "15,5,0" },
  { name: "Weiß", alive: "255,255,255", dying: "120,120,120", bg: "5,5,5" },
];

function step(grid: Uint8Array, next: Uint8Array, cols: number, rows: number, rule: Rule) {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const alive = grid[y * cols + x];
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + cols) % cols, ny = (y + dy + rows) % rows;
        if (grid[ny * cols + nx] === 1) n++;
      }
      if (rule === "life") {
        next[y * cols + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      } else if (rule === "highlife") {
        next[y * cols + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 || n === 6 ? 1 : 0);
      } else if (rule === "daynight") {
        next[y * cols + x] = alive ? ([3, 4, 6, 7, 8].includes(n) ? 1 : 0) : ([3, 6, 7, 8].includes(n) ? 1 : 0);
      } else if (rule === "brian") {
        if (alive === 2) next[y * cols + x] = 0;
        else if (alive === 1) next[y * cols + x] = 2;
        else next[y * cols + x] = n === 2 ? 1 : 0;
      } else if (rule === "seeds") {
        next[y * cols + x] = alive ? 0 : (n === 2 ? 1 : 0);
      }
    }
  }
}

export default function CellularAutomata() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const gridRef = useRef<Uint8Array>(new Uint8Array(0));
  const nextRef = useRef<Uint8Array>(new Uint8Array(0));
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const lastStepRef = useRef(0);
  const drawingRef = useRef(false);
  const drawModeRef = useRef<"draw" | "erase">("draw");

  const [rule, setRule] = useState<Rule>("life");
  const [colorIdx, setColorIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [speed, setSpeed] = useState(10);
  const [cellSize, setCellSize] = useState(5);
  const [drawMode, setDrawMode] = useState<"draw" | "erase">("draw");
  const [generation, setGeneration] = useState(0);
  const genRef = useRef(0);

  const stateRef = useRef({ rule, colorIdx, playing, speed, cellSize });
  useEffect(() => { stateRef.current = { rule, colorIdx, playing, speed, cellSize }; },
    [rule, colorIdx, playing, speed, cellSize]);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  const initGrid = useCallback((randomize = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cs = stateRef.current.cellSize;
    const cols = Math.floor(canvas.width / cs);
    const rows = Math.floor(canvas.height / cs);
    colsRef.current = cols; rowsRef.current = rows;
    gridRef.current = new Uint8Array(cols * rows);
    nextRef.current = new Uint8Array(cols * rows);
    if (randomize) {
      for (let i = 0; i < cols * rows; i++) gridRef.current[i] = Math.random() > 0.7 ? 1 : 0;
    }
    genRef.current = 0;
    setGeneration(0);
  }, []);

  useEffect(() => { initGrid(true); }, [cellSize]);

  const render = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { cols, rows, grid, cs } = { cols: colsRef.current, rows: rowsRef.current, grid: gridRef.current, cs: s.cellSize };
    const col = COLORS[s.colorIdx];

    ctx.fillStyle = `rgb(${col.bg})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = grid[y * cols + x];
        if (v === 1) ctx.fillStyle = `rgb(${col.alive})`;
        else if (v === 2) ctx.fillStyle = `rgb(${col.dying})`;
        else continue;
        ctx.fillRect(x * cs, y * cs, cs - 1, cs - 1);
      }
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      const s = stateRef.current;
      const interval = 1000 / s.speed;
      if (s.playing && time - lastStepRef.current >= interval) {
        step(gridRef.current, nextRef.current, colsRef.current, rowsRef.current, s.rule);
        const tmp = gridRef.current; gridRef.current = nextRef.current; nextRef.current = tmp;
        lastStepRef.current = time;
        genRef.current++;
        if (genRef.current % 5 === 0) setGeneration(genRef.current);
      }
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    rafRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [render]);

  const handleCanvasMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = Math.floor((e.clientX - rect.left) * scaleX / stateRef.current.cellSize);
    const cy = Math.floor((e.clientY - rect.top) * scaleY / stateRef.current.cellSize);
    const cols = colsRef.current, rows = rowsRef.current;
    const brush = 2;
    for (let dy = -brush; dy <= brush; dy++) {
      for (let dx = -brush; dx <= brush; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
          gridRef.current[ny * cols + nx] = drawModeRef.current === "draw" ? 1 : 0;
        }
      }
    }
  }, []);

  const W = 640, H = 480;

  return (
    <ToolLayout
      title="Cellular Automata"
      description="Conway's Game of Life & Varianten"
      headerRight={
        <>
          <span className="text-xs text-zinc-500 font-mono">Gen. {generation}</span>
          <Button size="sm" variant="ghost" data-testid="button-play-pause" onClick={() => setPlaying(p => !p)} className="text-zinc-300">
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-reset" onClick={() => initGrid(true)} className="text-zinc-300">
            <RefreshCw className="w-4 h-4 mr-1" />Reset
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-toggle-panel" onClick={() => setPanelOpen(p => !p)} className="text-zinc-300">
            <Settings2 className="w-4 h-4 mr-1" />
            {panelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </Button>
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6 gap-4">
        <div className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-zinc-800">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            data-testid="canvas-output"
            className="block max-w-full cursor-crosshair"
            onMouseDown={e => { drawingRef.current = true; handleCanvasMouse(e); }}
            onMouseMove={handleCanvasMouse}
            onMouseUp={() => { drawingRef.current = false; }}
            onMouseLeave={() => { drawingRef.current = false; }}
          />
        </div>
        <p className="text-xs text-zinc-600">Klicke oder ziehe auf dem Canvas, um Zellen zu zeichnen</p>

        <div className="flex gap-2">
          <button
            data-testid="button-draw"
            onClick={() => setDrawMode("draw")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${drawMode === "draw" ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
          >
            <Pencil className="w-3.5 h-3.5" />Zeichnen
          </button>
          <button
            data-testid="button-erase"
            onClick={() => setDrawMode("erase")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${drawMode === "erase" ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
          >
            <Eraser className="w-3.5 h-3.5" />Löschen
          </button>
          <button
            data-testid="button-clear"
            onClick={() => initGrid(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-all"
          >
            Leeren
          </button>
        </div>
      </div>

      {panelOpen && (
        <aside className="w-72 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto">
          <div className="p-5 space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Regel</h3>
              <div className="space-y-1.5">
                {RULES.map(r => (
                  <button key={r.id} data-testid={`button-rule-${r.id}`} onClick={() => { setRule(r.id); initGrid(true); }}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all ${rule === r.id ? "bg-emerald-700/80 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    <span className="text-sm font-medium block">{r.name}</span>
                    <span className="text-xs opacity-70">{r.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Farbe</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {COLORS.map((c, i) => (
                  <button key={i} data-testid={`button-color-${i}`} onClick={() => setColorIdx(i)}
                    className={`py-2 px-2 rounded-md text-xs font-medium transition-all text-center ${colorIdx === i ? "ring-2 ring-emerald-500 bg-zinc-800" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    style={{ color: `rgb(${c.alive})` }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Einstellungen</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400"><span>Geschwindigkeit</span><span className="font-mono text-zinc-300">{speed} fps</span></div>
                <Slider data-testid="slider-speed" value={[speed]} min={1} max={60} step={1} onValueChange={([v]) => setSpeed(v)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400"><span>Zellgröße</span><span className="font-mono text-zinc-300">{cellSize}px</span></div>
                <Slider data-testid="slider-cell-size" value={[cellSize]} min={2} max={12} step={1} onValueChange={([v]) => setCellSize(v)} />
              </div>
            </section>
          </div>
        </aside>
      )}
    </ToolLayout>
  );
}
