import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, HardDrive } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type CellState = 0 | 1 | 2 | 3 | 4; // free, system, fragmented, defrag'd, moving

interface DefragState {
  grid: CellState[];
  cols: number;
  rows: number;
  running: boolean;
  done: boolean;
  progress: number;
  totalUsed: number;
  defragCount: number;
  status: string;
  moveFrom: number;
  moveTo: number;
  speed: number;
  drive: string;
  tickAcc: number;
}

const COLORS: Record<CellState, string> = {
  0: "#ffffff",   // free
  1: "#99ccff",   // system
  2: "#cc3333",   // fragmented
  3: "#000099",   // defragmented
  4: "#ffff00",   // moving
};
const LEGEND: [string, string][] = [
  ["Frei",          "#ffffff"],
  ["Systemdateien", "#99ccff"],
  ["Fragmentiert",  "#cc3333"],
  ["Optimiert",     "#000099"],
];

// Win95 draw helpers
function raisedBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = "#404040"; ctx.fillRect(x, y+h-1, w, 1); ctx.fillRect(x+w-1, y, 1, h);
  ctx.fillStyle = "#dfdfdf"; ctx.fillRect(x+1, y+1, w-2, 1); ctx.fillRect(x+1, y+1, 1, h-2);
  ctx.fillStyle = "#808080"; ctx.fillRect(x+1, y+h-2, w-2, 1); ctx.fillRect(x+w-2, y+1, 1, h-2);
}
function sunkenBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "#808080"; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y+h-1, w, 1); ctx.fillRect(x+w-1, y, 1, h);
  ctx.fillStyle = "#404040"; ctx.fillRect(x+1, y+1, w-2, 1); ctx.fillRect(x+1, y+1, 1, h-2);
  ctx.fillStyle = "#dfdfdf"; ctx.fillRect(x+1, y+h-2, w-2, 1); ctx.fillRect(x+w-2, y+1, 1, h-2);
}

function initGrid(cols: number, rows: number): CellState[] {
  const total = cols * rows;
  const grid = new Array<CellState>(total).fill(0);
  // Place system files at start (~15%)
  const sys = Math.floor(total * 0.15);
  for (let i = 0; i < sys; i++) grid[i] = 1;
  // Scatter fragmented files (~50% of remaining)
  const fragTarget = Math.floor((total - sys) * 0.5);
  let placed = 0;
  for (let i = sys; i < total && placed < fragTarget; i++) {
    if (Math.random() < 0.62) { grid[i] = 2; placed++; }
  }
  return grid;
}

// Find first fragmented block from left, find first free slot before it
function findMove(grid: CellState[], cols: number, rows: number): [number, number] | null {
  const total = cols * rows;
  let firstFree = -1, firstFrag = -1;
  for (let i = 0; i < total; i++) {
    if (grid[i] === 0 && firstFree < 0) firstFree = i;
    if (grid[i] === 2 && firstFree >= 0 && firstFree < i) { firstFrag = i; break; }
  }
  if (firstFree < 0 || firstFrag < 0) return null;
  return [firstFrag, firstFree];
}

export default function DefragPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<DefragState | null>(null);
  const rafRef = useRef<number>(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Bereit. Klicke auf Start um zu beginnen.");
  const [speed, setSpeed] = useState(5);
  const [blockSize, setBlockSize] = useState(8);
  const [drive, setDrive] = useState("C:");

  const CANVAS_W = 620, CANVAS_H = 460;

  const reset = useCallback(() => {
    if (!stateRef.current) return;
    const cols = Math.floor((CANVAS_W - 40) / blockSize);
    const rows = Math.floor(150 / blockSize);
    const grid = initGrid(cols, rows);
    const totalUsed = grid.filter(c => c !== 0).length;
    stateRef.current = {
      ...stateRef.current,
      grid, cols, rows, running: false, done: false, progress: 0,
      totalUsed, defragCount: 0, status: "Bereit.", moveFrom: -1, moveTo: -1, drive,
    };
    setRunning(false); setDone(false); setProgress(0);
    setStatus("Bereit. Klicke auf Start um zu beginnen.");
  }, [blockSize, drive]);

  // Init
  useEffect(() => {
    const cols = Math.floor((CANVAS_W - 40) / blockSize);
    const rows = Math.floor(150 / blockSize);
    const grid = initGrid(cols, rows);
    const totalUsed = grid.filter(c => c !== 0).length;
    stateRef.current = {
      grid, cols, rows, running: false, done: false, progress: 0,
      totalUsed, defragCount: 0, status: "Bereit.", moveFrom: -1, moveTo: -1,
      speed: 5, drive: "C:", tickAcc: 0,
    };
  }, []);

  useEffect(() => { if (stateRef.current) stateRef.current.speed = speed; }, [speed]);

  // RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const s = stateRef.current;
      if (!s) { rafRef.current = requestAnimationFrame(draw); return; }

      // Simulate
      if (s.running && !s.done) {
        const movesPerFrame = Math.max(1, Math.floor(s.speed * 3));
        for (let m = 0; m < movesPerFrame; m++) {
          const move = findMove(s.grid, s.cols, s.rows);
          if (!move) {
            s.done = true; s.running = false;
            s.status = "Defragmentierung abgeschlossen. 100% vollständig.";
            s.progress = 100;
            setDone(true); setRunning(false); setProgress(100);
            setStatus(s.status);
            break;
          }
          const [from, to] = move;
          s.grid[to] = 3;
          s.grid[from] = 0;
          s.defragCount++;
          s.moveFrom = from; s.moveTo = to;
          const total = s.grid.filter(c => c === 2).length;
          const pct = Math.round((1 - total / s.totalUsed) * 100);
          s.progress = Math.max(s.progress, pct);
          if (s.defragCount % 20 === 0) {
            s.status = `Defragmentierung läuft... ${s.progress}% vollständig`;
            setProgress(s.progress);
            setStatus(s.status);
          }
        }
      }

      // Draw Win95 window
      const W = CANVAS_W, H = CANVAS_H;
      ctx.fillStyle = "#c0c0c0"; ctx.fillRect(0, 0, W, H);
      raisedBorder(ctx, 0, 0, W, H);

      // Title bar
      const g = ctx.createLinearGradient(2, 0, W - 50, 0);
      g.addColorStop(0, "#000080"); g.addColorStop(1, "#1084d0");
      ctx.fillStyle = g; ctx.fillRect(2, 2, W - 4, 18);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px Arial, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`Defragmentierung von Laufwerk ${s.drive}`, 6, 11);
      ctx.fillStyle = "#c0c0c0"; ctx.fillRect(W - 20, 4, 14, 14);
      raisedBorder(ctx, W - 20, 4, 14, 14);
      ctx.fillStyle = "#000"; ctx.font = "bold 9px Arial";
      ctx.textAlign = "center"; ctx.fillText("✕", W - 13, 11);

      // Drive info header
      ctx.fillStyle = "#c0c0c0"; ctx.fillRect(8, 24, W - 16, 28);
      raisedBorder(ctx, 8, 24, W - 16, 28);
      ctx.fillStyle = "#000"; ctx.font = "11px Arial, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`Laufwerk ${s.drive}   Dateisystem: FAT32   Kapazität: 2,1 GB`, 14, 38);

      // Block grid area
      const gridX = 8, gridY = 58, gridW = W - 16, gridH = s.rows * blockSize + 4;
      sunkenBorder(ctx, gridX, gridY, gridW, gridH);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(gridX + 2, gridY + 2, gridW - 4, gridH - 4);

      for (let i = 0; i < s.grid.length; i++) {
        const col = i % s.cols, row = Math.floor(i / s.cols);
        const bx = gridX + 2 + col * blockSize, by = gridY + 2 + row * blockSize;
        const color = (i === s.moveFrom || i === s.moveTo) ? COLORS[4] : COLORS[s.grid[i]];
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, blockSize - 1, blockSize - 1);
      }

      // Legend
      const legY = gridY + gridH + 8;
      ctx.fillStyle = "#000"; ctx.font = "10px Arial"; ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      let lx = gridX;
      for (const [label, color] of LEGEND) {
        ctx.fillStyle = color; ctx.fillRect(lx, legY, 14, 10);
        ctx.strokeStyle = "#808080"; ctx.lineWidth = 0.5;
        ctx.strokeRect(lx, legY, 14, 10);
        ctx.fillStyle = "#000"; ctx.fillText(label, lx + 18, legY + 5);
        lx += ctx.measureText(label).width + 36;
      }

      // Progress bar area
      const pbY = legY + 22;
      ctx.fillStyle = "#000"; ctx.font = "11px Arial"; ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Fortschritt:", gridX, pbY + 8);

      const barX = gridX + 80, barW = W - gridX - 80 - 8, barH = 16;
      sunkenBorder(ctx, barX, pbY, barW, barH);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(barX + 2, pbY + 2, barW - 4, barH - 4);
      const fillW = Math.floor((barW - 4) * s.progress / 100);
      ctx.fillStyle = "#000080"; ctx.fillRect(barX + 2, pbY + 2, fillW, barH - 4);
      ctx.fillStyle = fillW > (barW - 4) / 2 ? "#ffffff" : "#000080";
      ctx.font = "bold 10px Arial"; ctx.textAlign = "center";
      ctx.fillText(`${s.progress}%`, barX + (barW - 4) / 2 + 2, pbY + barH / 2);

      // Status
      const stY = pbY + barH + 8;
      sunkenBorder(ctx, gridX, stY, W - 16, 20);
      ctx.fillStyle = "#c0c0c0"; ctx.fillRect(gridX + 2, stY + 2, W - 20, 16);
      ctx.fillStyle = "#000"; ctx.font = "11px Arial"; ctx.textAlign = "left";
      ctx.textBaseline = "middle"; ctx.fillText(s.status, gridX + 6, stY + 10);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [blockSize]);

  const handleStart = () => {
    if (!stateRef.current || stateRef.current.done) return;
    stateRef.current.running = true;
    stateRef.current.status = "Analysiere Laufwerk " + stateRef.current.drive + "...";
    setRunning(true);
    setStatus("Analysiere...");
  };
  const handlePause = () => {
    if (!stateRef.current) return;
    stateRef.current.running = !stateRef.current.running;
    setRunning(stateRef.current.running);
  };

  return (
    <ToolLayout title="Defrag" description="Festplatten-Defragmentierung im Win95-Stil">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex items-start justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full"
            style={{ imageRendering: "pixelated", border: "2px solid #404040" }}
          />
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          {/* Drive */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Laufwerk</p>
            <div className="flex gap-2">
              {["C:", "D:", "E:"].map(d => (
                <Button key={d} size="sm" variant={drive === d ? "default" : "outline"}
                  className="flex-1 text-xs font-mono"
                  data-testid={`button-drive-${d.replace(":", "")}`}
                  onClick={() => { setDrive(d); if (stateRef.current) { stateRef.current.drive = d; } }}>
                  <HardDrive className="w-3 h-3 mr-1" />{d}
                </Button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Steuerung</p>
            <div className="flex gap-2 flex-col">
              <Button size="sm" variant="default" disabled={running || done}
                data-testid="button-start" onClick={handleStart} className="gap-1.5 text-xs w-full">
                <Play className="w-3.5 h-3.5" /> Starten
              </Button>
              <Button size="sm" variant="outline" disabled={done || (!running && progress === 0)}
                data-testid="button-pause" onClick={handlePause} className="gap-1.5 text-xs w-full">
                <Pause className="w-3.5 h-3.5" /> {running ? "Pausieren" : "Fortsetzen"}
              </Button>
              <Button size="sm" variant="outline"
                data-testid="button-reset" onClick={reset} className="gap-1.5 text-xs w-full">
                <RotateCcw className="w-3.5 h-3.5" /> Zurücksetzen
              </Button>
            </div>
          </div>

          {/* Speed */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <div className="flex justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Geschwindigkeit</Label>
              <span className="text-xs text-muted-foreground">{speed}x</span>
            </div>
            <Slider min={1} max={20} step={1} value={[speed]}
              data-testid="slider-speed"
              onValueChange={([v]) => { setSpeed(v); if (stateRef.current) stateRef.current.speed = v; }} />
          </div>

          {/* Block size */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Blockgröße</p>
            <div className="flex gap-2">
              {[{ label: "Klein", val: 5 }, { label: "Mittel", val: 8 }, { label: "Groß", val: 12 }].map(b => (
                <Button key={b.val} size="sm" variant={blockSize === b.val ? "default" : "outline"}
                  className="flex-1 text-xs"
                  data-testid={`button-blocksize-${b.label.toLowerCase()}`}
                  onClick={() => { setBlockSize(b.val); reset(); }}>
                  {b.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
            <p className="text-xs text-muted-foreground leading-snug" data-testid="text-status">{status}</p>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }} data-testid="progress-bar" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">{progress}%</p>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
