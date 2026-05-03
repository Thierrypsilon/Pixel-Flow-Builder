import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Camera, Monitor, Upload, Download } from "lucide-react";

type SourceMode = "demo" | "camera" | "video";
type IconType = "cursor" | "hourglass" | "mine" | "folder" | "floppy" | "window" | "pointer" | "cross";
type BgMode = "black" | "desktop" | "source";
type ColorMode = "white" | "original" | "neon";

const CANVAS_W = 620, CANVAS_H = 440;

// ─── Icon drawing functions (Win98 style) ─────────────────────────────────────

function drawWin98Cursor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "white", outline = "#000") {
  ctx.save();
  ctx.translate(x, y);
  const s = size;
  // Classic Win98 arrow cursor polygon
  const pts: [number, number][] = [
    [0, 0],
    [0, s * 0.76],
    [s * 0.22, s * 0.55],
    [s * 0.34, s * 0.88],
    [s * 0.5, s * 0.8],
    [s * 0.38, s * 0.48],
    [s * 0.64, s * 0.48],
  ];
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = outline;
  ctx.fill();
  // Inner fill (inset by 1px)
  ctx.scale(0.82, 0.82);
  ctx.translate(s * 0.08, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawWin98Pointer(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "white", outline = "#000") {
  ctx.save();
  ctx.translate(x + size * 0.1, y);
  const s = size;
  // Hand/pointer cursor
  const fw = s * 0.22;
  // Finger pointing up
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, s * 0.09);
  // Index finger
  ctx.beginPath();
  ctx.roundRect(s * 0.3 - fw / 2, 0, fw, s * 0.55, 3);
  ctx.fill(); ctx.stroke();
  // Other fingers
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.roundRect(i * fw + fw * 0.2, s * 0.35, fw * 0.9, s * 0.5, 3);
    ctx.fill(); ctx.stroke();
  }
  // Palm
  ctx.beginPath();
  ctx.roundRect(fw * 0.2, s * 0.55, fw * 3.5, s * 0.38, 3);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawHourglass(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "white", outline = "#000") {
  ctx.save();
  ctx.translate(x, y);
  const s = size;
  const cx = s / 2, m = s * 0.1;
  ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, s * 0.08);
  // Top triangle
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(m, m);
  ctx.lineTo(s - m, m);
  ctx.lineTo(cx, s / 2 - m * 0.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Bottom triangle
  ctx.beginPath();
  ctx.moveTo(cx, s / 2 + m * 0.5);
  ctx.lineTo(s - m, s - m);
  ctx.lineTo(m, s - m);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // Center pinch line
  ctx.beginPath();
  ctx.moveTo(m, m); ctx.lineTo(m, s - m);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s - m, m); ctx.lineTo(s - m, s - m);
  ctx.stroke();
  ctx.restore();
}

function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "#555", outline = "#000") {
  ctx.save();
  ctx.translate(x, y);
  const s = size, cx = s / 2, cy = s / 2, r = s * 0.28;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.lineCap = "round";
  // 8 spikes
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1);
    ctx.lineTo(cx + Math.cos(a) * r * 1.85, cy + Math.sin(a) * r * 1.85);
    ctx.stroke();
  }
  // Body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  // Highlight
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fill();
  ctx.restore();
}

function drawFolder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "#FFD700", outline = "#AA7700") {
  ctx.save();
  ctx.translate(x, y);
  const s = size;
  ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.fillStyle = fill;
  // Tab
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.lineTo(s * 0.38, s * 0.3);
  ctx.lineTo(s * 0.46, s * 0.18);
  ctx.lineTo(s * 0.7, s * 0.18);
  ctx.lineTo(s * 0.7, s * 0.3);
  ctx.lineTo(s, s * 0.3);
  ctx.lineTo(s, s * 0.98);
  ctx.lineTo(0, s * 0.98);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Inner highlight
  ctx.fillStyle = `rgba(255,255,180,0.4)`;
  ctx.beginPath();
  ctx.roundRect(s * 0.07, s * 0.38, s * 0.86, s * 0.15, 1);
  ctx.fill();
  ctx.restore();
}

function drawFloppy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "#ccc", outline = "#555") {
  ctx.save();
  ctx.translate(x, y);
  const s = size;
  ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, s * 0.07);
  // Body
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, 2);
  ctx.fill(); ctx.stroke();
  // Top dark stripe
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.roundRect(s * 0.1, 0, s * 0.8, s * 0.38, [2, 2, 0, 0]);
  ctx.fill();
  // Metal shutter
  ctx.fillStyle = "#aaa";
  ctx.fillRect(s * 0.28, s * 0.06, s * 0.44, s * 0.26);
  // Label area
  ctx.fillStyle = "white";
  ctx.fillRect(s * 0.1, s * 0.45, s * 0.8, s * 0.48);
  ctx.strokeRect(s * 0.1, s * 0.45, s * 0.8, s * 0.48);
  ctx.restore();
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "white", outline = "#000") {
  ctx.save();
  ctx.translate(x, y);
  const s = size;
  // Window body
  ctx.fillStyle = "#C0C0C0";
  ctx.strokeStyle = outline; ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath(); ctx.roundRect(0, 0, s, s, 1); ctx.fill(); ctx.stroke();
  // Title bar
  ctx.fillStyle = "#000080";
  ctx.fillRect(s * 0.06, s * 0.1, s * 0.88, s * 0.22);
  // Title bar buttons
  ctx.fillStyle = "#C0C0C0";
  ctx.fillRect(s * 0.72, s * 0.13, s * 0.09, s * 0.16);
  ctx.fillRect(s * 0.84, s * 0.13, s * 0.09, s * 0.16);
  // Content area
  ctx.fillStyle = "white";
  ctx.fillRect(s * 0.06, s * 0.37, s * 0.88, s * 0.55);
  ctx.strokeRect(s * 0.06, s * 0.37, s * 0.88, s * 0.55);
  ctx.restore();
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill = "white", outline = "#000") {
  ctx.save();
  ctx.translate(x, y);
  const s = size, t = s * 0.28, cx = s / 2, cy = s / 2;
  ctx.fillStyle = fill; ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.lineJoin = "round";
  const path = new Path2D(
    `M ${cx - t} ${0}
     L ${cx + t} 0
     L ${cx + t} ${cy - t}
     L ${s} ${cy - t}
     L ${s} ${cy + t}
     L ${cx + t} ${cy + t}
     L ${cx + t} ${s}
     L ${cx - t} ${s}
     L ${cx - t} ${cy + t}
     L 0 ${cy + t}
     L 0 ${cy - t}
     L ${cx - t} ${cy - t}
     Z`
  );
  ctx.fill(path); ctx.stroke(path);
  ctx.restore();
}

// Draw a single icon at (x, y) with given size
function drawIcon(ctx: CanvasRenderingContext2D, type: IconType, x: number, y: number, size: number, fill: string, outline: string) {
  switch (type) {
    case "cursor":   drawWin98Cursor(ctx, x, y, size, fill, outline); break;
    case "pointer":  drawWin98Pointer(ctx, x, y, size, fill, outline); break;
    case "hourglass":drawHourglass(ctx, x, y, size, fill, outline); break;
    case "mine":     drawMine(ctx, x, y, size, fill === "white" ? "#555" : fill, outline); break;
    case "folder":   drawFolder(ctx, x, y, size, fill === "white" ? "#FFD700" : fill, outline); break;
    case "floppy":   drawFloppy(ctx, x, y, size, fill === "white" ? "#ccc" : fill, outline); break;
    case "window":   drawWindow(ctx, x, y, size, fill, outline); break;
    case "cross":    drawCross(ctx, x, y, size, fill, outline); break;
  }
}

// ─── Win98 desktop background ─────────────────────────────────────────────────
function drawDesktopBg(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = "#008080";
  ctx.fillRect(0, 0, W, H);
  // Taskbar
  const tbarH = 28;
  ctx.fillStyle = "#C0C0C0";
  ctx.fillRect(0, H - tbarH, W, tbarH);
  // Raised border
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, H - tbarH, W, 1);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, H - 1, W, 1);
  // Start button
  ctx.fillStyle = "#C0C0C0";
  ctx.fillRect(4, H - tbarH + 3, 54, tbarH - 6);
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(4, H - tbarH + 3, 54, 1); ctx.fillRect(4, H - tbarH + 3, 1, tbarH - 6);
  ctx.fillStyle = "#808080"; ctx.fillRect(58, H - tbarH + 3, 1, tbarH - 6); ctx.fillRect(4, H - 3, 55, 1);
  ctx.fillStyle = "#000080";
  ctx.fillRect(7, H - tbarH + 5, 48, tbarH - 10);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px 'Arial'"; ctx.textBaseline = "middle";
  ctx.fillText("Start", 14, H - tbarH / 2);
  // Clock
  ctx.fillStyle = "#C0C0C0"; ctx.font = "10px monospace"; ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = "#000";
  ctx.fillText("12:00", W - 8, H - tbarH / 2);
  ctx.textAlign = "left";
  // Desktop icons
  const icons = [["My Computer", 12], ["My Documents", 80], ["Recycle Bin", W - 52]];
  ctx.font = "9px monospace"; ctx.textAlign = "center";
  for (const [label, ix] of icons) {
    ctx.fillStyle = "#C0C0C0"; ctx.fillRect(ix as number, 8, 24, 20);
    ctx.strokeStyle = "#808080"; ctx.lineWidth = 1;
    ctx.strokeRect(ix as number, 8, 24, 20);
    ctx.fillStyle = "#000"; ctx.fillText(label as string, (ix as number) + 12, 36);
  }
}

// ─── Demo animation (high-contrast silhouette) ───────────────────────────────
function drawDemo(ctx: CanvasRenderingContext2D, t: number, W: number, H: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2 + Math.sin(t * 0.4) * W * 0.12;
  const cy = H / 2;

  // Person-like silhouette: head + body + arms + legs
  ctx.fillStyle = "#fff";
  // Head
  ctx.beginPath(); ctx.arc(cx, cy - H * 0.25, H * 0.1, 0, Math.PI * 2); ctx.fill();
  // Body
  ctx.fillRect(cx - H * 0.07, cy - H * 0.14, H * 0.14, H * 0.22);
  // Arms
  const armAngle = Math.sin(t * 1.5) * 0.6;
  ctx.save(); ctx.translate(cx - H * 0.07, cy - H * 0.12); ctx.rotate(-armAngle - 0.3);
  ctx.fillRect(-H * 0.12, 0, H * 0.06, H * 0.18); ctx.restore();
  ctx.save(); ctx.translate(cx + H * 0.07, cy - H * 0.12); ctx.rotate(armAngle + 0.3);
  ctx.fillRect(0, 0, H * 0.06, H * 0.18); ctx.restore();
  // Legs
  const legSwing = Math.sin(t * 2) * 0.3;
  ctx.save(); ctx.translate(cx - H * 0.04, cy + H * 0.08); ctx.rotate(legSwing);
  ctx.fillRect(-H * 0.04, 0, H * 0.08, H * 0.18); ctx.restore();
  ctx.save(); ctx.translate(cx + H * 0.04, cy + H * 0.08); ctx.rotate(-legSwing);
  ctx.fillRect(-H * 0.04, 0, H * 0.08, H * 0.18); ctx.restore();
}

const ICON_LABELS: Record<IconType, string> = {
  cursor: "Cursor", pointer: "Hand", hourglass: "Sanduhr",
  mine: "Mine", folder: "Ordner", floppy: "Diskette",
  window: "Fenster", cross: "Kreuz",
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function CursorVisionPage() {
  const srcRef   = useRef<HTMLCanvasElement>(null);
  const outRef   = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef   = useRef<number>(0);
  const demoT    = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [source,     setSource]     = useState<SourceMode>("demo");
  const [iconType,   setIconType]   = useState<IconType>("cursor");
  const [iconSize,   setIconSize]   = useState(16);
  const [threshold,  setThreshold]  = useState(60);
  const [bgMode,     setBgMode]     = useState<BgMode>("black");
  const [colorMode,  setColorMode]  = useState<ColorMode>("white");
  const [cameraErr,  setCameraErr]  = useState(false);
  const [videoName,  setVideoName]  = useState<string | null>(null);
  const [sizeByLuma, setSizeByLuma] = useState(false);

  const stateRef = useRef({
    source: "demo" as SourceMode, iconType: "cursor" as IconType,
    iconSize: 16, threshold: 60, bgMode: "black" as BgMode,
    colorMode: "white" as ColorMode, sizeByLuma: false,
  });
  useEffect(() => {
    stateRef.current = { source, iconType, iconSize, threshold, bgMode, colorMode, sizeByLuma };
  }, [source, iconType, iconSize, threshold, bgMode, colorMode, sizeByLuma]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraErr(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) videoRef.current = document.createElement("video");
      Object.assign(videoRef.current, { srcObject: stream, autoplay: true, muted: true, playsInline: true });
      await videoRef.current.play();
    } catch { setCameraErr(true); setSource("demo"); }
  }, []);

  const loadVideo = useCallback((file: File) => {
    stopCamera(); setVideoName(file.name);
    if (!videoRef.current) videoRef.current = document.createElement("video");
    const vid = videoRef.current;
    vid.src = URL.createObjectURL(file);
    vid.loop = true; vid.muted = true; vid.autoplay = true; vid.playsInline = true;
    vid.play(); setSource("video");
  }, [stopCamera]);

  useEffect(() => {
    if (source === "camera") startCamera();
    else if (source === "demo") { stopCamera(); setVideoName(null); }
  }, [source, startCamera, stopCamera]);

  // ─── Render loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const src = srcRef.current, out = outRef.current;
    if (!src || !out) return;
    const sc = src.getContext("2d", { willReadFrequently: true })!;
    const oc = out.getContext("2d")!;
    const W = CANVAS_W, H = CANVAS_H;
    let last = 0;

    const loop = (ms: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (ms - last < 30) return;
      last = ms;

      const s = stateRef.current;
      const cellSize = s.iconSize;
      const cols = Math.ceil(W / cellSize), rows = Math.ceil(H / cellSize);

      // Draw source at grid resolution
      src.width = cols; src.height = rows;
      if (s.source === "demo") {
        demoT.current += 0.02;
        drawDemo(sc, demoT.current, cols, rows);
      } else if (videoRef.current && videoRef.current.readyState >= 2) {
        sc.drawImage(videoRef.current, 0, 0, cols, rows);
      } else {
        sc.fillStyle = "#000"; sc.fillRect(0, 0, cols, rows);
      }

      const imgData = sc.getImageData(0, 0, cols, rows);
      const d = imgData.data;

      // Draw background
      if (s.bgMode === "desktop") {
        drawDesktopBg(oc, W, H);
      } else if (s.bgMode === "source") {
        // Draw source scaled up dimly as bg
        src.width = W; src.height = H;
        if (s.source === "demo") drawDemo(sc, demoT.current, W, H);
        else if (videoRef.current && videoRef.current.readyState >= 2)
          sc.drawImage(videoRef.current, 0, 0, W, H);
        oc.globalAlpha = 0.25;
        oc.drawImage(src, 0, 0);
        oc.globalAlpha = 1;
        // Restore small canvas for pixel sampling
        src.width = cols; src.height = rows;
        if (s.source === "demo") drawDemo(sc, demoT.current, cols, rows);
        else if (videoRef.current && videoRef.current.readyState >= 2)
          sc.drawImage(videoRef.current, 0, 0, cols, rows);
      } else {
        oc.fillStyle = "#000"; oc.fillRect(0, 0, W, H);
      }

      // Stamp icons
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const pi = (row * cols + col) * 4;
          const r = d[pi], g = d[pi + 1], b = d[pi + 2];
          const luma = r * 0.299 + g * 0.587 + b * 0.114;
          if (luma < s.threshold) continue;

          const normLuma = luma / 255;
          const sz = s.sizeByLuma
            ? Math.max(6, Math.round(cellSize * (0.4 + normLuma * 0.7)))
            : cellSize * 0.9;

          const px = col * cellSize + (cellSize - sz) / 2;
          const py = row * cellSize + (cellSize - sz) / 2;

          let fill: string, outline: string;
          switch (s.colorMode) {
            case "original":
              fill = `rgb(${r},${g},${b})`;
              outline = `rgba(0,0,0,0.8)`;
              break;
            case "neon":
              fill = `hsl(${(luma * 2 + 180) % 360},100%,60%)`;
              outline = "#000";
              break;
            default: // white
              fill = "white";
              outline = "#000";
          }

          drawIcon(oc, s.iconType, px, py, sz, fill, outline);
        }
      }

      // Overlay info
      oc.fillStyle = "rgba(0,0,0,0.5)";
      oc.fillRect(0, 0, W, 16);
      oc.fillStyle = "#fff";
      oc.font = "9px monospace";
      oc.textBaseline = "top";
      oc.textAlign = "left";
      oc.fillText(`${ICON_LABELS[s.iconType]} · ${cols}×${rows} Zellen · Schwelle ${s.threshold}`, 4, 3);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); stopCamera(); };
  }, [stopCamera]);

  const handleExport = useCallback(() => {
    const canvas = outRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "cursorvision.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, []);

  const ICONS: IconType[] = ["cursor", "pointer", "hourglass", "mine", "folder", "floppy", "window", "cross"];

  return (
    <ToolLayout title="CursorVision" description="Video und Kamera als Win98-Icon-Mosaik">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">

        {/* Canvas area */}
        <div className="flex-1 flex flex-col items-start gap-2">
          <canvas ref={srcRef} className="hidden" />
          <canvas
            ref={outRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded bg-black"
          />
          {videoName && <p className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-full px-1">▶ {videoName}</p>}
        </div>

        {/* Controls */}
        <div className="w-full lg:w-60 flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-0.5">

          {/* Source */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quelle</p>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant={source === "demo" ? "default" : "outline"}
                className="gap-1 text-xs" data-testid="button-source-demo"
                onClick={() => { stopCamera(); setSource("demo"); }}>
                <Monitor className="w-3 h-3" /> Demo
              </Button>
              <Button size="sm" variant={source === "camera" ? "default" : "outline"}
                className="gap-1 text-xs" data-testid="button-source-camera"
                onClick={() => setSource("camera")}>
                <Camera className="w-3 h-3" /> Kamera
              </Button>
              <Button size="sm" variant={source === "video" ? "default" : "outline"}
                className="gap-1 text-xs" data-testid="button-source-video"
                onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3 h-3" /> Video
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) loadVideo(f); e.target.value = ""; }} />
            {cameraErr && <p className="text-xs text-red-400 mt-1">Kamera nicht verfügbar.</p>}
          </div>

          {/* Icon type */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Icon</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ICONS.map(ic => (
                <Button key={ic} size="sm"
                  variant={iconType === ic ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-icon-${ic}`}
                  onClick={() => setIconType(ic)}>
                  {ICON_LABELS[ic]}
                </Button>
              ))}
            </div>
          </div>

          {/* Appearance */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Darstellung</p>

            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Icon-Größe</Label>
                <span className="text-xs text-muted-foreground">{iconSize}px</span>
              </div>
              <Slider min={6} max={40} step={1} value={[iconSize]}
                data-testid="slider-icon-size"
                onValueChange={([v]) => setIconSize(v)} />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Helligkeitsschwelle</Label>
                <span className="text-xs text-muted-foreground">{threshold}</span>
              </div>
              <Slider min={0} max={240} step={1} value={[threshold]}
                data-testid="slider-threshold"
                onValueChange={([v]) => setThreshold(v)} />
            </div>

            <Button size="sm"
              variant={sizeByLuma ? "default" : "outline"}
              className="w-full text-xs"
              data-testid="button-toggle-size-by-luma"
              onClick={() => setSizeByLuma(v => !v)}>
              Größe nach Helligkeit {sizeByLuma ? "An" : "Aus"}
            </Button>
          </div>

          {/* Color */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Farbe</p>
            <div className="grid grid-cols-3 gap-1">
              {(["white", "original", "neon"] as ColorMode[]).map(m => (
                <Button key={m} size="sm"
                  variant={colorMode === m ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-color-${m}`}
                  onClick={() => setColorMode(m)}>
                  {m === "white" ? "Weiß" : m === "original" ? "Original" : "Neon"}
                </Button>
              ))}
            </div>
          </div>

          {/* Background */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Hintergrund</p>
            <div className="grid grid-cols-3 gap-1">
              {(["black", "desktop", "source"] as BgMode[]).map(m => (
                <Button key={m} size="sm"
                  variant={bgMode === m ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-bg-${m}`}
                  onClick={() => setBgMode(m)}>
                  {m === "black" ? "Schwarz" : m === "desktop" ? "Win98" : "Quelle"}
                </Button>
              ))}
            </div>
          </div>

          <Button className="gap-2 text-xs" data-testid="button-export" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Als PNG exportieren
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
}
