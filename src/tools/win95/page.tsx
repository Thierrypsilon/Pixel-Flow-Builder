import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Monitor, Camera, RefreshCw, Plus, Minus, Upload } from "lucide-react";

// ─── Win95 Color Constants ────────────────────────────────────────────────────
const C = {
  gray:    "#c0c0c0",
  white:   "#ffffff",
  light:   "#dfdfdf",
  dark:    "#808080",
  darker:  "#404040",
  black:   "#000000",
  desktop: "#008080",
  navy:    "#000080",
  blue:    "#1084d0",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Effect = "normal" | "gray" | "invert" | "sepia" | "dither";
type DesktopColor = "teal" | "navy" | "olive" | "maroon" | "purple";

interface Win {
  id: number;
  x: number; y: number; w: number; h: number;
  title: string;
  zIndex: number;
  minimized: boolean;
  effect: Effect;
};

interface AppState {
  source: "demo" | "camera" | "video";
  videoEl: HTMLVideoElement | null;
  windows: Win[];
  dragging: { id: number; ox: number; oy: number } | null;
  desktop: DesktopColor;
  scanlines: boolean;
  windowCount: number;
  demoT: number;
  nextZ: number;
  offscreen: HTMLCanvasElement;
  offCtx: CanvasRenderingContext2D;
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function raised(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = C.white;  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = C.darker; ctx.fillRect(x, y+h-1, w, 1); ctx.fillRect(x+w-1, y, 1, h);
  ctx.fillStyle = C.light;  ctx.fillRect(x+1, y+1, w-2, 1); ctx.fillRect(x+1, y+1, 1, h-2);
  ctx.fillStyle = C.dark;   ctx.fillRect(x+1, y+h-2, w-2, 1); ctx.fillRect(x+w-2, y+1, 1, h-2);
}

function sunken(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = C.dark;   ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = C.white;  ctx.fillRect(x, y+h-1, w, 1); ctx.fillRect(x+w-1, y, 1, h);
  ctx.fillStyle = C.darker; ctx.fillRect(x+1, y+1, w-2, 1); ctx.fillRect(x+1, y+1, 1, h-2);
  ctx.fillStyle = C.light;  ctx.fillRect(x+1, y+h-2, w-2, 1); ctx.fillRect(x+w-2, y+1, 1, h-2);
}

function win95Button(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, active = false) {
  ctx.fillStyle = C.gray; ctx.fillRect(x, y, w, h);
  if (active) sunken(ctx, x, y, w, h); else raised(ctx, x, y, w, h);
  ctx.fillStyle = C.black;
  ctx.font = "bold 9px Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2 + (active ? 1 : 0), y + h / 2 + (active ? 1 : 0));
}

function titleBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  title: string, focused: boolean
) {
  const H = 18, pad = 2;
  const bw = w - pad * 2;
  if (focused) {
    const g = ctx.createLinearGradient(x + pad, 0, x + bw - 48, 0);
    g.addColorStop(0, C.navy); g.addColorStop(1, C.blue);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = C.dark;
  }
  ctx.fillRect(x + pad, y + pad, bw - 48, H);
  ctx.fillStyle = focused ? C.blue : C.gray;
  ctx.fillRect(x + bw - 46, y + pad, 46, H);

  ctx.fillStyle = C.white;
  ctx.font = "bold 11px Arial, sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const maxTW = bw - 48 - 20;
  ctx.save();
  ctx.beginPath(); ctx.rect(x + pad + 4, y + pad, maxTW, H); ctx.clip();
  ctx.fillText(title, x + pad + 4, y + pad + H / 2);
  ctx.restore();

  win95Button(ctx, x + w - pad - 16,      y + pad + 2, 14, 14, "✕");
  win95Button(ctx, x + w - pad - 16 * 2 - 2, y + pad + 2, 14, 14, "□");
  win95Button(ctx, x + w - pad - 16 * 3 - 4, y + pad + 2, 14, 14, "_");
}

function menuBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = C.gray; ctx.fillRect(x, y, w, 18);
  ctx.fillStyle = C.black; ctx.font = "11px Arial, sans-serif";
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const items = ["Datei", "Bearbeiten", "Ansicht", "Hilfe"];
  let ix = x + 4;
  for (const item of items) {
    ctx.fillText(item, ix, y + 9);
    ix += ctx.measureText(item).width + 14;
  }
  ctx.fillStyle = C.dark; ctx.fillRect(x, y + 17, w, 1);
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  win: Win,
  focused: boolean,
  source: HTMLVideoElement | null,
  demoT: number,
  offscreen: HTMLCanvasElement,
  offCtx: CanvasRenderingContext2D,
  showMenu: boolean
) {
  const { x, y, w, h } = win;
  const B = 2, TITLE_H = 18, MENU_H = showMenu ? 18 : 0;

  ctx.fillStyle = C.gray; ctx.fillRect(x, y, w, h);
  raised(ctx, x, y, w, h);
  titleBar(ctx, x, y, w, win.title, focused);

  if (win.minimized) return;

  if (showMenu) menuBar(ctx, x + B, y + B + TITLE_H, w - B * 2);

  const cx = x + B, cy = y + B + TITLE_H + MENU_H;
  const cw = w - B * 2, ch = h - B * 2 - TITLE_H - MENU_H;
  if (cw <= 4 || ch <= 4) return;

  sunken(ctx, cx, cy, cw, ch);
  const vx = cx + 2, vy = cy + 2, vw = cw - 4, vh = ch - 4;
  if (vw <= 0 || vh <= 0) return;

  ctx.save();
  ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();

  const videoSrc = source;

  if (win.effect === "dither" && videoSrc) {
    offscreen.width = vw; offscreen.height = vh;
    offCtx.filter = "grayscale(1)";
    offCtx.drawImage(videoSrc, 0, 0, vw, vh);
    offCtx.filter = "none";
    const imgData = offCtx.getImageData(0, 0, vw, vh);
    const bayer = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    for (let py = 0; py < vh; py++) {
      for (let px = 0; px < vw; px++) {
        const i = (py * vw + px) * 4;
        const luma = imgData.data[i];
        const threshold = bayer[py % 4][px % 4] / 16 * 255;
        const v = luma > threshold ? 255 : 0;
        imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = v;
      }
    }
    offCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(offscreen, vx, vy, vw, vh);
  } else if (videoSrc) {
    const filters: Record<Effect, string> = {
      normal: "none", gray: "grayscale(1)", invert: "invert(1)", sepia: "sepia(1)", dither: "none",
    };
    ctx.filter = filters[win.effect] ?? "none";
    ctx.drawImage(videoSrc, vx, vy, vw, vh);
    ctx.filter = "none";
  } else {
    drawDemoContent(ctx, vx, vy, vw, vh, demoT, win.id, win.effect);
  }

  ctx.restore();
}

function drawDemoContent(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  t: number, id: number, effect: Effect
) {
  const hues = [0, 60, 120, 200, 280, 30];
  const hue = hues[id % hues.length];

  if (effect === "dither") {
    const cols = Math.ceil(w / 3), rows = Math.ceil(h / 3);
    const bayer = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
    for (let py = 0; py < rows; py++) {
      for (let px = 0; px < cols; px++) {
        const nx = px / cols, ny = py / rows;
        const v = (Math.sin(nx * 8 + t + id) * Math.cos(ny * 6 - t * 0.7) + 1) / 2;
        const threshold = bayer[py % 4][px % 4] / 16;
        ctx.fillStyle = v > threshold ? "#ffffff" : "#000000";
        ctx.fillRect(x + px * 3, y + py * 3, 3, 3);
      }
    }
    return;
  }

  const baseFilter: Record<Effect, string> = {
    normal: "none", gray: "grayscale(1)", invert: "invert(1)", sepia: "sepia(0.8)", dither: "none",
  };
  ctx.save();
  ctx.filter = baseFilter[effect] ?? "none";

  ctx.fillStyle = `hsl(${hue},50%,10%)`;
  ctx.fillRect(x, y, w, h);

  const blobs = 3;
  for (let i = 0; i < blobs; i++) {
    const bx = x + w * (0.2 + 0.6 * ((Math.sin(t * 0.7 + i * 1.2 + id * 0.5) + 1) / 2));
    const by = y + h * (0.2 + 0.6 * ((Math.cos(t * 0.5 + i * 0.9 + id * 0.4) + 1) / 2));
    const r = Math.min(w, h) * 0.35;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, `hsla(${(hue + i * 40) % 360},90%,55%,0.8)`);
    g.addColorStop(1, `hsla(${(hue + i * 40) % 360},90%,40%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawDesktopBg(ctx: CanvasRenderingContext2D, w: number, h: number, color: DesktopColor, tbH: number) {
  const colors: Record<DesktopColor, string> = {
    teal: "#008080", navy: "#000080", olive: "#808000", maroon: "#800000", purple: "#800080",
  };
  ctx.fillStyle = colors[color];
  ctx.fillRect(0, 0, w, h - tbH);
}

function drawTaskbar(
  ctx: CanvasRenderingContext2D,
  cw: number, ch: number, tbH: number,
  windows: Win[], focusId: number
) {
  const y = ch - tbH;
  ctx.fillStyle = C.gray; ctx.fillRect(0, y, cw, tbH);
  ctx.fillStyle = C.white; ctx.fillRect(0, y, cw, 1);

  win95Button(ctx, 3, y + 3, 58, tbH - 6, "▶ Start");

  ctx.fillStyle = C.dark; ctx.fillRect(65, y + 4, 1, tbH - 8);

  let bx = 70;
  const btnW = Math.min(140, (cw - bx - 80) / Math.max(windows.length, 1));
  for (const win of windows) {
    const active = win.id === focusId;
    if (active) sunken(ctx, bx, y + 3, btnW - 2, tbH - 6);
    else raised(ctx, bx, y + 3, btnW - 2, tbH - 6);
    ctx.fillStyle = C.gray; ctx.fillRect(bx + 2, y + 5, btnW - 6, tbH - 10);
    ctx.fillStyle = C.black; ctx.font = "11px Arial, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.save();
    ctx.beginPath(); ctx.rect(bx + 4, y + 5, btnW - 10, tbH - 10); ctx.clip();
    ctx.fillText(win.title, bx + 4, y + tbH / 2);
    ctx.restore();
    bx += btnW;
  }

  const now = new Date();
  const t = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const clockW = 58;
  sunken(ctx, cw - clockW - 4, y + 4, clockW, tbH - 8);
  ctx.fillStyle = C.gray; ctx.fillRect(cw - clockW - 2, y + 6, clockW - 4, tbH - 12);
  ctx.fillStyle = C.black; ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(t, cw - clockW / 2 - 4, y + tbH / 2);
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
}

// ─── Window factories ─────────────────────────────────────────────────────────
const TITLES = ["Video Viewer", "Kamera", "Live Feed", "Stream"];
const EFFECTS: Effect[] = ["normal", "gray", "sepia", "invert"];

function makeWindows(count: number, cw: number, ch: number, tbH: number): Win[] {
  const dh = ch - tbH;
  const margin = 20;
  const positions = [
    [margin, margin],
    [cw - 260 - margin, margin],
    [margin, dh - 200 - margin],
    [cw - 260 - margin, dh - 200 - margin],
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    x: positions[i][0],
    y: positions[i][1],
    w: 240,
    h: 190,
    title: TITLES[i],
    zIndex: i + 1,
    minimized: false,
    effect: EFFECTS[i % EFFECTS.length],
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Win95Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AppState | null>(null);
  const rafRef = useRef<number>(0);
  const [source, setSource] = useState<"demo" | "camera" | "video">("demo");
  const [windowCount, setWindowCount] = useState(2);
  const [desktop, setDesktop] = useState<DesktopColor>("teal");
  const [scanlines, setScanlines] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [_, forceUpdate] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TB_H = 30;
  const CANVAS_W = 640;
  const CANVAS_H = 480;

  // ── Init ──
  useEffect(() => {
    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d")!;
    stateRef.current = {
      source: "demo",
      videoEl: null,
      windows: makeWindows(windowCount, CANVAS_W, CANVAS_H, TB_H),
      dragging: null,
      desktop: "teal",
      scanlines: false,
      windowCount,
      demoT: 0,
      nextZ: windowCount + 1,
      offscreen,
      offCtx,
    };
  }, []);

  // ── Sync props to stateRef ──
  useEffect(() => {
    if (!stateRef.current) return;
    stateRef.current.desktop = desktop;
    stateRef.current.scanlines = scanlines;
  }, [desktop, scanlines]);

  // ── Window count ──
  useEffect(() => {
    if (!stateRef.current) return;
    stateRef.current.windows = makeWindows(windowCount, CANVAS_W, CANVAS_H, TB_H);
    stateRef.current.windowCount = windowCount;
    stateRef.current.nextZ = windowCount + 1;
  }, [windowCount]);

  // ── Camera / Video ──
  useEffect(() => {
    if (!stateRef.current) return;
    stateRef.current.source = source;
    if (source === "camera") {
      setCameraError(false);
      const vid = document.createElement("video");
      vid.autoplay = true; vid.muted = true; vid.playsInline = true;
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        vid.srcObject = stream;
        vid.play();
        if (stateRef.current) stateRef.current.videoEl = vid;
      }).catch(() => {
        setCameraError(true);
        if (stateRef.current) { stateRef.current.source = "demo"; stateRef.current.videoEl = null; }
        setSource("demo");
      });
    } else if (source === "demo") {
      if (stateRef.current.videoEl) {
        const stream = stateRef.current.videoEl.srcObject as MediaStream | null;
        stream?.getTracks().forEach(t => t.stop());
        stateRef.current.videoEl.pause();
        stateRef.current.videoEl = null;
      }
      setVideoFileName(null);
    }
    // "video" source: videoEl is set by handleVideoFile
  }, [source]);

  const handleVideoFile = useCallback((file: File) => {
    if (!stateRef.current) return;
    // Stop any existing camera stream
    if (stateRef.current.videoEl?.srcObject) {
      const stream = stateRef.current.videoEl.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
    }
    const vid = document.createElement("video");
    vid.autoplay = true; vid.muted = true; vid.playsInline = true; vid.loop = true;
    vid.src = URL.createObjectURL(file);
    vid.play();
    stateRef.current.videoEl = vid;
    stateRef.current.source = "video";
    setSource("video");
    setVideoFileName(file.name);
  }, []);

  // ── RAF loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      const s = stateRef.current;
      if (!s) { rafRef.current = requestAnimationFrame(loop); return; }
      s.demoT += 0.02;

      const videoSrc = (s.source === "camera" || s.source === "video") && s.videoEl && (s.videoEl.readyState ?? 0) >= 2 ? s.videoEl : null;
      const sorted = [...s.windows].sort((a, b) => a.zIndex - b.zIndex);
      const focusId = sorted.at(-1)?.id ?? -1;

      drawDesktopBg(ctx, CANVAS_W, CANVAS_H, s.desktop, TB_H);
      for (const win of sorted) {
        drawWindow(ctx, win, win.id === focusId, videoSrc, s.demoT, s.offscreen, s.offCtx, showMenu);
      }
      drawTaskbar(ctx, CANVAS_W, CANVAS_H, TB_H, s.windows, focusId);
      if (s.scanlines) drawScanlines(ctx, CANVAS_W, CANVAS_H);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [showMenu]);

  // ── Mouse events ──
  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const hitTitleBar = (win: Win, mx: number, my: number) => {
    const B = 2;
    return mx >= win.x + B && mx <= win.x + win.w - B
      && my >= win.y + B && my <= win.y + B + 18;
  };

  const hitWindow = (win: Win, mx: number, my: number) =>
    mx >= win.x && mx <= win.x + win.w && my >= win.y && my <= win.y + win.h;

  const hitCloseBtn = (win: Win, mx: number, my: number) => {
    const bx = win.x + win.w - 4 - 16, by = win.y + 4;
    return mx >= bx && mx <= bx + 14 && my >= by && my <= by + 14;
  };

  const hitMinBtn = (win: Win, mx: number, my: number) => {
    const bx = win.x + win.w - 4 - 16 * 3 - 4, by = win.y + 4;
    return mx >= bx && mx <= bx + 14 && my >= by && my <= by + 14;
  };

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s) return;
    const { x, y } = getCanvasPos(e);
    const sorted = [...s.windows].sort((a, b) => b.zIndex - a.zIndex);
    for (const win of sorted) {
      if (hitWindow(win, x, y)) {
        s.nextZ++;
        win.zIndex = s.nextZ;
        if (hitCloseBtn(win, x, y)) {
          s.windows = s.windows.filter(w => w.id !== win.id);
          forceUpdate(n => n + 1);
          return;
        }
        if (hitMinBtn(win, x, y)) {
          win.minimized = !win.minimized;
          forceUpdate(n => n + 1);
          return;
        }
        if (hitTitleBar(win, x, y)) {
          s.dragging = { id: win.id, ox: x - win.x, oy: y - win.y };
        }
        return;
      }
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (!s?.dragging) return;
    const { x, y } = getCanvasPos(e);
    const win = s.windows.find(w => w.id === s.dragging!.id);
    if (!win) return;
    win.x = Math.max(0, Math.min(CANVAS_W - win.w, x - s.dragging.ox));
    win.y = Math.max(0, Math.min(CANVAS_H - TB_H - 20, y - s.dragging.oy));
  }, []);

  const onMouseUp = useCallback(() => {
    if (stateRef.current) stateRef.current.dragging = null;
  }, []);

  // ── Effect cycle ──
  const cycleEffect = (id: number) => {
    const s = stateRef.current;
    if (!s) return;
    const order: Effect[] = ["normal", "gray", "sepia", "invert", "dither"];
    const win = s.windows.find(w => w.id === id);
    if (!win) return;
    const idx = order.indexOf(win.effect);
    win.effect = order[(idx + 1) % order.length];
    forceUpdate(n => n + 1);
  };

  const EFFECT_LABELS: Record<Effect, string> = {
    normal: "Normal", gray: "Graustufen", sepia: "Sepia", invert: "Invertiert", dither: "Dithering",
  };
  const DESKTOP_LABELS: Record<DesktopColor, string> = {
    teal: "Türkis", navy: "Marine", olive: "Olive", maroon: "Kastanie", purple: "Lila",
  };

  return (
    <ToolLayout title="Win95 Windows">
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden min-h-0">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full max-h-full"
            style={{ imageRendering: "pixelated", cursor: "default", aspectRatio: "4/3" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        </div>

        {/* Controls */}
        <div className="w-full lg:w-64 flex flex-col gap-4 overflow-y-auto">
          {/* Source */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quelle</p>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <Button
                size="sm" variant={source === "demo" ? "default" : "outline"}
                className="gap-1 text-xs"
                data-testid="button-source-demo"
                onClick={() => setSource("demo")}
              >
                <Monitor className="w-3 h-3" /> Demo
              </Button>
              <Button
                size="sm" variant={source === "camera" ? "default" : "outline"}
                className="gap-1 text-xs"
                data-testid="button-source-camera"
                onClick={() => setSource("camera")}
              >
                <Camera className="w-3 h-3" /> Kamera
              </Button>
              <Button
                size="sm" variant={source === "video" ? "default" : "outline"}
                className="gap-1 text-xs"
                data-testid="button-source-video"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3" /> Video
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              data-testid="input-video-file"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); e.target.value = ""; }}
            />
            {cameraError && <p className="text-xs text-red-400">Kamera nicht verfügbar.</p>}
            {videoFileName && (
              <p className="text-[10px] text-muted-foreground/60 truncate mt-1">▶ {videoFileName}</p>
            )}
          </div>

          {/* Fenster-Anzahl */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Fenster ({windowCount})
            </p>
            <div className="flex items-center gap-2 mb-3">
              <Button size="icon" variant="outline" className="h-7 w-7"
                data-testid="button-window-less"
                onClick={() => setWindowCount(c => Math.max(1, c - 1))}>
                <Minus className="w-3 h-3" />
              </Button>
              <div className="flex-1 flex gap-1 justify-center">
                {[1,2,3,4].map(n => (
                  <Button key={n} size="sm" variant={windowCount === n ? "default" : "outline"}
                    className="w-8 h-7 text-xs p-0"
                    data-testid={`button-windows-${n}`}
                    onClick={() => setWindowCount(n)}>{n}</Button>
                ))}
              </div>
              <Button size="icon" variant="outline" className="h-7 w-7"
                data-testid="button-window-more"
                onClick={() => setWindowCount(c => Math.min(4, c + 1))}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {/* Per-window effect cycle */}
            <div className="space-y-1.5">
              {stateRef.current?.windows.map(win => (
                <Button
                  key={win.id}
                  size="sm"
                  variant="outline"
                  className="w-full text-xs justify-between"
                  data-testid={`button-effect-${win.id}`}
                  onClick={() => cycleEffect(win.id)}
                >
                  <span className="truncate text-left">{win.title}</span>
                  <span className="text-muted-foreground ml-2 shrink-0">{EFFECT_LABELS[win.effect]}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Desktop Farbe */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Desktop</p>
            <div className="grid grid-cols-5 gap-1.5">
              {(["teal","navy","olive","maroon","purple"] as DesktopColor[]).map(c => {
                const bg: Record<DesktopColor,string> = {
                  teal:"bg-teal-600", navy:"bg-blue-900", olive:"bg-yellow-700",
                  maroon:"bg-red-800", purple:"bg-purple-700"
                };
                return (
                  <button
                    key={c}
                    data-testid={`button-desktop-${c}`}
                    title={DESKTOP_LABELS[c]}
                    onClick={() => setDesktop(c)}
                    className={`w-full aspect-square rounded ${bg[c]} border-2 transition-all ${desktop === c ? "border-white scale-110" : "border-transparent"}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Optionen */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Optionen</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="sw-scanlines" className="text-xs">Scanlines</Label>
              <Switch id="sw-scanlines" data-testid="switch-scanlines"
                checked={scanlines} onCheckedChange={setScanlines} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sw-menu" className="text-xs">Menüleiste</Label>
              <Switch id="sw-menu" data-testid="switch-menu"
                checked={showMenu} onCheckedChange={setShowMenu} />
            </div>
          </div>

          {/* Reset */}
          <Button variant="outline" size="sm" className="gap-2 text-xs"
            data-testid="button-reset"
            onClick={() => {
              if (!stateRef.current) return;
              stateRef.current.windows = makeWindows(windowCount, CANVAS_W, CANVAS_H, TB_H);
              stateRef.current.nextZ = windowCount + 1;
              forceUpdate(n => n + 1);
            }}>
            <RefreshCw className="w-3.5 h-3.5" /> Layout zurücksetzen
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
