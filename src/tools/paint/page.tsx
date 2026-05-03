import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Download, Trash2, Undo2 } from "lucide-react";

type Tool = "pencil" | "eraser" | "line" | "rect" | "ellipse" | "fill";

// Classic MS Paint 28-color palette
const PALETTE = [
  "#000000","#808080","#800000","#808000","#008000","#008080","#000080","#800080",
  "#ffffff","#c0c0c0","#ff0000","#ffff00","#00ff00","#00ffff","#0000ff","#ff00ff",
  "#ff8040","#804000","#804080","#408080","#004080","#408040","#804040","#404080",
  "#ff8080","#ffff80","#80ff80","#80ffff",
];

interface PaintState {
  tool: Tool;
  color: string;
  bgColor: string;
  lineWidth: number;
  drawing: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  snapshot: ImageData | null;
  history: ImageData[];
}

const CANVAS_W = 560, CANVAS_H = 380;

function floodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string) {
  const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const data = imgData.data;
  const idx = (Math.round(startY) * CANVAS_W + Math.round(startX)) * 4;
  const sr = data[idx], sg = data[idx+1], sb = data[idx+2], sa = data[idx+3];

  const col = document.createElement("canvas").getContext("2d")!;
  col.fillStyle = fillColor; col.fillRect(0, 0, 1, 1);
  const fc = col.getImageData(0, 0, 1, 1).data;
  if (fc[0]===sr && fc[1]===sg && fc[2]===sb && fc[3]===sa) return;

  const stack = [Math.round(startX) + Math.round(startY) * CANVAS_W];
  const visited = new Uint8Array(CANVAS_W * CANVAS_H);

  while (stack.length > 0) {
    const pos = stack.pop()!;
    if (visited[pos]) continue;
    visited[pos] = 1;
    const i = pos * 4;
    if (data[i]!==sr || data[i+1]!==sg || data[i+2]!==sb || data[i+3]!==sa) continue;
    data[i]=fc[0]; data[i+1]=fc[1]; data[i+2]=fc[2]; data[i+3]=fc[3];
    const x = pos % CANVAS_W, y = Math.floor(pos / CANVAS_W);
    if (x > 0) stack.push(pos - 1);
    if (x < CANVAS_W - 1) stack.push(pos + 1);
    if (y > 0) stack.push(pos - CANVAS_W);
    if (y < CANVAS_H - 1) stack.push(pos + CANVAS_W);
  }
  ctx.putImageData(imgData, 0, 0);
}

const TOOL_INFO: {id: Tool; label: string; icon: string}[] = [
  { id: "pencil",  label: "Stift",     icon: "✏️" },
  { id: "eraser",  label: "Radierer",  icon: "⬜" },
  { id: "fill",    label: "Eimer",     icon: "🪣" },
  { id: "line",    label: "Linie",     icon: "╱" },
  { id: "rect",    label: "Rechteck",  icon: "▭" },
  { id: "ellipse", label: "Ellipse",   icon: "⬭" },
];

export default function PaintPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [lineWidth, setLineWidth] = useState(2);
  const [selectFg, setSelectFg] = useState(true); // true=FG, false=BG
  const stateRef = useRef<PaintState>({
    tool: "pencil", color: "#000000", bgColor: "#ffffff",
    lineWidth: 2, drawing: false,
    startX: 0, startY: 0, lastX: 0, lastY: 0,
    snapshot: null, history: [],
  });

  // Sync
  useEffect(() => { stateRef.current.tool = tool; }, [tool]);
  useEffect(() => { stateRef.current.color = color; }, [color]);
  useEffect(() => { stateRef.current.bgColor = bgColor; }, [bgColor]);
  useEffect(() => { stateRef.current.lineWidth = lineWidth; }, [lineWidth]);

  // Init white canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const saveHistory = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    stateRef.current.history = [...stateRef.current.history.slice(-19), snap];
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e);
    const s = stateRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    const pCtx = previewRef.current?.getContext("2d");
    if (!ctx || !pCtx) return;

    const drawColor = e.button === 2 ? s.bgColor : s.color;
    saveHistory();

    if (s.tool === "fill") {
      floodFill(ctx, x, y, drawColor); return;
    }
    s.drawing = true; s.startX = x; s.startY = y; s.lastX = x; s.lastY = y;
    s.snapshot = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);

    if (s.tool === "pencil" || s.tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = s.tool === "eraser" ? s.bgColor : drawColor;
      ctx.lineWidth = s.tool === "eraser" ? s.lineWidth * 4 : s.lineWidth;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
    }
  }, [saveHistory]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.drawing) return;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    const pCtx = previewRef.current?.getContext("2d");
    if (!ctx || !pCtx) return;
    const drawColor = e.buttons === 2 ? s.bgColor : s.color;

    if (s.tool === "pencil" || s.tool === "eraser") {
      ctx.lineTo(x, y); ctx.stroke();
      s.lastX = x; s.lastY = y;
      return;
    }
    // Shape preview
    pCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    pCtx.strokeStyle = drawColor;
    pCtx.fillStyle = drawColor;
    pCtx.lineWidth = s.lineWidth;
    const dx = x - s.startX, dy = y - s.startY;

    if (s.tool === "line") {
      pCtx.beginPath(); pCtx.moveTo(s.startX, s.startY); pCtx.lineTo(x, y); pCtx.stroke();
    } else if (s.tool === "rect") {
      pCtx.strokeRect(s.startX, s.startY, dx, dy);
    } else if (s.tool === "ellipse") {
      pCtx.beginPath();
      pCtx.ellipse(s.startX + dx/2, s.startY + dy/2, Math.abs(dx/2), Math.abs(dy/2), 0, 0, Math.PI*2);
      pCtx.stroke();
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s.drawing) return;
    s.drawing = false;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    const pCtx = previewRef.current?.getContext("2d");
    if (!ctx || !pCtx) return;
    const drawColor = e.button === 2 ? s.bgColor : s.color;

    if (s.tool === "pencil" || s.tool === "eraser") {
      ctx.closePath(); pCtx.clearRect(0, 0, CANVAS_W, CANVAS_H); return;
    }
    // Commit shape
    pCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = drawColor; ctx.fillStyle = drawColor; ctx.lineWidth = s.lineWidth;
    const dx = x - s.startX, dy = y - s.startY;
    if (s.tool === "line") {
      ctx.beginPath(); ctx.moveTo(s.startX, s.startY); ctx.lineTo(x, y); ctx.stroke();
    } else if (s.tool === "rect") {
      ctx.strokeRect(s.startX, s.startY, dx, dy);
    } else if (s.tool === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(s.startX + dx/2, s.startY + dy/2, Math.abs(dx/2), Math.abs(dy/2), 0, 0, Math.PI*2);
      ctx.stroke();
    }
  }, []);

  const undo = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const h = stateRef.current.history;
    if (h.length === 0) return;
    const snap = h[h.length - 1];
    ctx.putImageData(snap, 0, 0);
    stateRef.current.history = h.slice(0, -1);
  }, []);

  const clearCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    saveHistory();
    ctx.fillStyle = stateRef.current.bgColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, [saveHistory]);

  const save = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "paint.png"; a.click();
  }, []);

  return (
    <ToolLayout title="Paint" description="MS Paint — Zeichenwerkzeuge im Windows-Stil">
      <div className="flex flex-col w-full">
        {/* Toolbar */}
        <div className="flex items-center gap-1 px-3 py-2 bg-zinc-800 border-b border-zinc-700 flex-wrap">
          {TOOL_INFO.map(t => (
            <Button key={t.id} size="sm" variant={tool === t.id ? "default" : "ghost"}
              className="h-8 px-2.5 text-xs gap-1.5 min-w-[64px]"
              data-testid={`button-tool-${t.id}`}
              onClick={() => setTool(t.id)}>
              <span className="text-base leading-none">{t.icon}</span> {t.label}
            </Button>
          ))}
          <div className="w-px h-6 bg-zinc-600 mx-1" />
          <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-xs"
            data-testid="button-undo" onClick={undo}>
            <Undo2 className="w-3.5 h-3.5" /> Rückgängig
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-xs"
            data-testid="button-clear" onClick={clearCanvas}>
            <Trash2 className="w-3.5 h-3.5" /> Löschen
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 gap-1 text-xs"
            data-testid="button-save" onClick={save}>
            <Download className="w-3.5 h-3.5" /> Speichern
          </Button>
        </div>

        <div className="flex flex-1 gap-0 overflow-hidden">
          {/* Left toolbar: line width */}
          <div className="flex flex-col items-center gap-2 px-2 py-3 bg-zinc-800 border-r border-zinc-700 w-16">
            <p className="text-[10px] text-zinc-400 font-semibold uppercase">Breite</p>
            {[1, 2, 4, 7, 10].map(w => (
              <button key={w} onClick={() => setLineWidth(w)}
                data-testid={`button-width-${w}`}
                className={`w-10 flex items-center justify-center rounded transition-colors
                  ${lineWidth === w ? "bg-zinc-600 ring-1 ring-blue-400" : "hover:bg-zinc-700"}`}
                style={{ height: `${Math.max(18, w + 10)}px` }}>
                <div className="bg-white rounded-full" style={{ width: `${Math.min(32, 32)}px`, height: `${w}px` }} />
              </button>
            ))}
          </div>

          {/* Canvas area */}
          <div className="flex-1 overflow-auto bg-zinc-700 p-2 flex items-start justify-center">
            <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                data-testid="canvas-output"
                className="absolute inset-0 cursor-crosshair"
                style={{ touchAction: "none" }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={e => { if (stateRef.current.drawing) onMouseUp(e); }}
                onContextMenu={e => e.preventDefault()}
              />
              <canvas
                ref={previewRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="absolute inset-0 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Bottom palette */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-t border-zinc-700">
          {/* FG/BG color boxes */}
          <div className="relative w-10 h-8 shrink-0 mr-2">
            <button
              className={`absolute top-0 left-0 w-7 h-6 border-2 ${selectFg ? "border-blue-400 z-10" : "border-zinc-500"}`}
              style={{ background: color }}
              data-testid="button-color-fg"
              title="Vordergrundfarbe"
              onClick={() => setSelectFg(true)}
            />
            <button
              className={`absolute bottom-0 right-0 w-7 h-6 border-2 ${!selectFg ? "border-blue-400 z-10" : "border-zinc-500"}`}
              style={{ background: bgColor }}
              data-testid="button-color-bg"
              title="Hintergrundfarbe"
              onClick={() => setSelectFg(false)}
            />
          </div>
          <div className="flex flex-wrap gap-0.5">
            {PALETTE.map(c => (
              <button
                key={c}
                className="w-5 h-5 border border-zinc-600 hover:scale-125 transition-transform hover:border-white"
                style={{ background: c }}
                data-testid={`button-palette-${c.replace("#","")}`}
                title={c}
                onClick={() => { if (selectFg) setColor(c); else setBgColor(c); }}
                onContextMenu={e => { e.preventDefault(); setBgColor(c); }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Label className="text-xs text-zinc-400">Pinselgröße: {lineWidth}px</Label>
            <div className="w-24">
              <Slider min={1} max={20} step={1} value={[lineWidth]}
                data-testid="slider-brush-size"
                onValueChange={([v]) => setLineWidth(v)} />
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
