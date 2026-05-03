import { useEffect, useRef, useState } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Stars, Zap, GitBranch, Circle, Combine } from "lucide-react";

type Mode = "starfield" | "matrix" | "pipes" | "bouncing" | "maze";

interface ScreensaverState {
  mode: Mode;
  speed: number;
  // Starfield
  stars: { x: number; y: number; z: number; pz: number }[];
  // Matrix
  matrixCols: { y: number; speed: number; chars: string[] }[];
  // Pipes
  pipes: { x: number; y: number; dir: number; color: string; len: number }[];
  pipeCanvas: HTMLCanvasElement;
  pipeCtx: CanvasRenderingContext2D;
  // Bouncing
  bouncers: { x: number; y: number; vx: number; vy: number; w: number; h: number; hue: number }[];
  // Maze
  mazeGrid: number[];
  mazeCols: number;
  mazeRows: number;
  mazeStack: number[];
  mazeCurrent: number;
  mazeDone: boolean;
  mazeCanvas: HTMLCanvasElement;
  mazeCtx: CanvasRenderingContext2D;
}

const CANVAS_W = 640, CANVAS_H = 460;
const MATRIX_CHARS = "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEF";
const PIPE_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const PIPE_COLORS = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#ff8800","#8800ff"];

function initState(): ScreensaverState {
  const numStars = 300;
  const matrixFontSize = 14, matrixColCount = Math.floor(CANVAS_W / matrixFontSize);
  const pCanvas = document.createElement("canvas");
  pCanvas.width = CANVAS_W; pCanvas.height = CANVAS_H;
  const pCtx = pCanvas.getContext("2d")!;
  pCtx.fillStyle = "#000"; pCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const mzCols = 31, mzRows = 23, cellSize = 14;
  const mCanvas = document.createElement("canvas");
  mCanvas.width = CANVAS_W; mCanvas.height = CANVAS_H;
  const mCtx = mCanvas.getContext("2d")!;
  mCtx.fillStyle = "#000"; mCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const mzTotal = mzCols * mzRows;
  const mzGrid = new Array(mzTotal).fill(0b1111); // all walls

  return {
    mode: "starfield",
    speed: 5,
    stars: Array.from({length: numStars}, () => ({
      x: Math.random() * CANVAS_W - CANVAS_W/2,
      y: Math.random() * CANVAS_H - CANVAS_H/2,
      z: Math.random() * CANVAS_W,
      pz: 0,
    })),
    matrixCols: Array.from({length: matrixColCount}, () => ({
      y: Math.random() * -CANVAS_H,
      speed: 1 + Math.random() * 3,
      chars: Array.from({length: 30}, () => MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]),
    })),
    pipes: [],
    pipeCanvas: pCanvas, pipeCtx: pCtx,
    bouncers: [
      { x: 120, y: 100, vx: 2.5, vy: 2, w: 120, h: 50, hue: 210 },
    ],
    mazeGrid: mzGrid, mazeCols: mzCols, mazeRows: mzRows,
    mazeStack: [0], mazeCurrent: 0, mazeDone: false,
    mazeCanvas: mCanvas, mazeCtx: mCtx,
  };
}

// ─── Screensaver draw functions ───────────────────────────────────────────────

function drawStarfield(ctx: CanvasRenderingContext2D, s: ScreensaverState) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
  const sp = s.speed * 3;
  for (const star of s.stars) {
    star.pz = star.z;
    star.z -= sp;
    if (star.z <= 0) {
      star.x = Math.random() * CANVAS_W - cx;
      star.y = Math.random() * CANVAS_H - cy;
      star.z = CANVAS_W; star.pz = star.z;
    }
    const sx = cx + (star.x / star.z) * CANVAS_W;
    const sy = cy + (star.y / star.z) * CANVAS_H;
    const px = cx + (star.x / star.pz) * CANVAS_W;
    const py = cy + (star.y / star.pz) * CANVAS_H;
    const size = Math.max(0.5, (1 - star.z / CANVAS_W) * 3);
    const bright = Math.floor((1 - star.z / CANVAS_W) * 255);
    ctx.strokeStyle = `rgb(${bright},${bright},${bright})`;
    ctx.lineWidth = size;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy); ctx.stroke();
  }
}

function drawMatrix(ctx: CanvasRenderingContext2D, s: ScreensaverState) {
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const fs = 14;
  ctx.font = `${fs}px monospace`;
  for (let i = 0; i < s.matrixCols.length; i++) {
    const col = s.matrixCols[i];
    col.y += col.speed * s.speed * 0.5;
    if (col.y > CANVAS_H + 100) {
      col.y = -fs * (5 + Math.random() * 20);
      col.speed = 1 + Math.random() * 3;
    }
    if (Math.random() < 0.02) col.chars[0] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
    for (let j = 0; j < col.chars.length; j++) {
      const cy = col.y + j * fs;
      if (cy < -fs || cy > CANVAS_H) continue;
      ctx.fillStyle = j === 0 ? "#ccffcc" : j < 2 ? "#00ff41" : `rgba(0,${Math.max(60, 255 - j * 15)},0,1)`;
      ctx.fillText(col.chars[j], i * fs, cy);
    }
  }
}

function drawPipes(ctx: CanvasRenderingContext2D, s: ScreensaverState) {
  const seg = 20;
  const movesPerFrame = Math.max(1, Math.floor(s.speed * 1.5));
  for (let m = 0; m < movesPerFrame; m++) {
    if (s.pipes.length < 6) {
      s.pipes.push({
        x: Math.floor(Math.random() * (CANVAS_W / seg)) * seg,
        y: Math.floor(Math.random() * (CANVAS_H / seg)) * seg,
        dir: Math.floor(Math.random() * 4),
        color: PIPE_COLORS[Math.floor(Math.random() * PIPE_COLORS.length)],
        len: 0,
      });
    }
    for (const pipe of s.pipes) {
      const [dx, dy] = PIPE_DIRS[pipe.dir];
      const nx = pipe.x + dx * seg, ny = pipe.y + dy * seg;
      s.pipeCtx.strokeStyle = pipe.color; s.pipeCtx.lineWidth = 6;
      s.pipeCtx.lineCap = "square";
      s.pipeCtx.beginPath(); s.pipeCtx.moveTo(pipe.x + seg/2, pipe.y + seg/2);
      s.pipeCtx.lineTo(nx + seg/2, ny + seg/2); s.pipeCtx.stroke();
      s.pipeCtx.fillStyle = pipe.color;
      s.pipeCtx.beginPath(); s.pipeCtx.arc(pipe.x + seg/2, pipe.y + seg/2, 5, 0, Math.PI*2); s.pipeCtx.fill();
      pipe.x = nx; pipe.y = ny; pipe.len++;
      if (nx < 0 || nx >= CANVAS_W || ny < 0 || ny >= CANVAS_H || pipe.len > 30 + Math.random() * 40) {
        pipe.x = Math.floor(Math.random() * (CANVAS_W/seg)) * seg;
        pipe.y = Math.floor(Math.random() * (CANVAS_H/seg)) * seg;
        pipe.color = PIPE_COLORS[Math.floor(Math.random() * PIPE_COLORS.length)];
        pipe.len = 0;
      }
      if (Math.random() < 0.2) pipe.dir = Math.floor(Math.random() * 4);
    }
  }
  if (Math.random() < 0.0005) {
    s.pipeCtx.fillStyle = "#000"; s.pipeCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    s.pipes = [];
  }
  ctx.drawImage(s.pipeCanvas, 0, 0);
}

function drawBouncing(ctx: CanvasRenderingContext2D, s: ScreensaverState) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (const b of s.bouncers) {
    const sp = s.speed * 0.5;
    b.x += b.vx * sp; b.y += b.vy * sp;
    let bounced = false;
    if (b.x <= 0)               { b.x = 0;              b.vx = Math.abs(b.vx); bounced = true; }
    if (b.x + b.w >= CANVAS_W)  { b.x = CANVAS_W - b.w; b.vx = -Math.abs(b.vx); bounced = true; }
    if (b.y <= 0)               { b.y = 0;              b.vy = Math.abs(b.vy); bounced = true; }
    if (b.y + b.h >= CANVAS_H)  { b.y = CANVAS_H - b.h; b.vy = -Math.abs(b.vy); bounced = true; }
    if (bounced) b.hue = (b.hue + 47) % 360;
    const col = `hsl(${b.hue},100%,55%)`;
    ctx.fillStyle = col;
    ctx.font = "bold 40px Arial, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Windows 93", b.x, b.y);
    ctx.strokeStyle = `hsl(${b.hue},100%,35%)`;
    ctx.lineWidth = 1;
    ctx.strokeText("Windows 93", b.x, b.y);
  }
  // corner flash
  ctx.fillStyle = "rgba(255,255,255,0)";
}

function drawMaze(ctx: CanvasRenderingContext2D, s: ScreensaverState) {
  const cs = 14;
  if (!s.mazeDone) {
    const stepsPerFrame = Math.max(1, Math.floor(s.speed * 2));
    for (let step = 0; step < stepsPerFrame; step++) {
      if (s.mazeStack.length === 0) { s.mazeDone = true; break; }
      const cur = s.mazeStack[s.mazeStack.length - 1];
      const cx2 = cur % s.mazeCols, cy2 = Math.floor(cur / s.mazeCols);
      const neighbors: {i: number; wall: number; opp: number}[] = [];
      const dirs2 = [{dx:1,dy:0,wall:1,opp:3},{dx:-1,dy:0,wall:3,opp:1},{dx:0,dy:1,wall:2,opp:0},{dx:0,dy:-1,wall:0,opp:2}];
      for (const {dx, dy, wall, opp} of dirs2) {
        const nx2 = cx2+dx, ny2 = cy2+dy;
        if (nx2<0||nx2>=s.mazeCols||ny2<0||ny2>=s.mazeRows) continue;
        const ni = ny2*s.mazeCols+nx2;
        if (s.mazeGrid[ni] === 0b1111) neighbors.push({i: ni, wall, opp});
      }
      if (neighbors.length > 0) {
        const {i: ni, wall, opp} = neighbors[Math.floor(Math.random()*neighbors.length)];
        s.mazeGrid[cur] &= ~(1 << wall);
        s.mazeGrid[ni] &= ~(1 << opp);
        s.mazeCurrent = ni;
        s.mazeStack.push(ni);
        const ncx = ni % s.mazeCols, ncy = Math.floor(ni / s.mazeCols);
        const ccx = cur % s.mazeCols, ccy = Math.floor(cur / s.mazeCols);
        s.mazeCtx.fillStyle = "#00cc44";
        s.mazeCtx.fillRect(ccx*cs+1, ccy*cs+1, cs-1, cs-1);
        s.mazeCtx.fillRect(ncx*cs+1, ncy*cs+1, cs-1, cs-1);
        s.mazeCtx.fillStyle = "#003311";
        s.mazeCtx.fillRect(Math.min(ccx,ncx)*cs+(ccx!==ncx?cs-1:1), Math.min(ccy,ncy)*cs+(ccy!==ncy?cs-1:1),
          ccx!==ncx?2:cs-1, ccy!==ncy?2:cs-1);
      } else {
        s.mazeStack.pop();
      }
    }
  }
  ctx.drawImage(s.mazeCanvas, (CANVAS_W - s.mazeCols*cs)/2, (CANVAS_H - s.mazeRows*cs)/2);
  if (s.mazeDone) {
    setTimeout(() => {
      s.mazeCtx.fillStyle = "#000"; s.mazeCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const mzTotal = s.mazeCols * s.mazeRows;
      s.mazeGrid = new Array(mzTotal).fill(0b1111);
      s.mazeStack = [0]; s.mazeCurrent = 0; s.mazeDone = false;
    }, 2000);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const MODE_INFO: {id: Mode; label: string; desc: string; icon: React.ComponentType<{className?: string}>}[] = [
  { id: "starfield", label: "Starfield",  desc: "3D Sternenhimmel", icon: Stars },
  { id: "matrix",    label: "Matrix",     desc: "Digitaler Regen",  icon: Zap },
  { id: "pipes",     label: "3D Pipes",   desc: "Rohre wachsen",    icon: GitBranch },
  { id: "bouncing",  label: "Bouncing",   desc: "Springender Text", icon: Circle },
  { id: "maze",      label: "Labyrinth",  desc: "Maze Generator",   icon: Combine },
];

export default function ScreensaverPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ScreensaverState | null>(null);
  const rafRef = useRef<number>(0);
  const [mode, setMode] = useState<Mode>("starfield");
  const [speed, setSpeed] = useState(5);

  useEffect(() => {
    stateRef.current = initState();
  }, []);

  useEffect(() => {
    if (stateRef.current) stateRef.current.mode = mode;
  }, [mode]);

  useEffect(() => {
    if (stateRef.current) stateRef.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const loop = () => {
      const s = stateRef.current;
      if (!s) { rafRef.current = requestAnimationFrame(loop); return; }
      switch (s.mode) {
        case "starfield": drawStarfield(ctx, s); break;
        case "matrix":    drawMatrix(ctx, s); break;
        case "pipes":     drawPipes(ctx, s); break;
        case "bouncing":  drawBouncing(ctx, s); break;
        case "maze":      drawMaze(ctx, s); break;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <ToolLayout title="Screensaver" description="Klassische Windows Bildschirmschoner">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex items-start justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full bg-black"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Modus</p>
            <div className="flex flex-col gap-1.5">
              {MODE_INFO.map(m => (
                <Button
                  key={m.id}
                  size="sm"
                  variant={mode === m.id ? "default" : "outline"}
                  className="w-full justify-start gap-2 text-xs"
                  data-testid={`button-mode-${m.id}`}
                  onClick={() => {
                    setMode(m.id);
                    const s = stateRef.current;
                    if (!s) return;
                    if (m.id === "pipes") { s.pipeCtx.fillStyle="#000"; s.pipeCtx.fillRect(0,0,CANVAS_W,CANVAS_H); s.pipes=[]; }
                    if (m.id === "maze") {
                      s.mazeCtx.fillStyle="#000"; s.mazeCtx.fillRect(0,0,CANVAS_W,CANVAS_H);
                      s.mazeGrid = new Array(s.mazeCols*s.mazeRows).fill(0b1111);
                      s.mazeStack=[0]; s.mazeCurrent=0; s.mazeDone=false;
                    }
                  }}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  <div className="text-left">
                    <div>{m.label}</div>
                    <div className="text-muted-foreground text-[10px]">{m.desc}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <div className="flex justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Geschwindigkeit</Label>
              <span className="text-xs text-muted-foreground">{speed}x</span>
            </div>
            <Slider min={1} max={15} step={1} value={[speed]}
              data-testid="slider-speed"
              onValueChange={([v]) => setSpeed(v)} />
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
