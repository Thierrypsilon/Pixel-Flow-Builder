import { useEffect, useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToolLayout } from "@/components/tool-layout";
import {
  Camera, Monitor, Play, Pause, Settings2,
  ChevronRight, ChevronLeft, Upload, RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type TrackMode = "motion" | "bright" | "dark";
type ShapeType = "basic" | "circle" | "scope" | "frame" | "lframe" | "xframe" | "glow" | "particle" | "label";
type FilterType = "none" | "thermal" | "invert" | "glitch" | "pixel" | "dither" | "edge" | "crt";
type ConnMode = "none" | "mesh" | "hub";
type SourceMode = "demo" | "camera" | "video";

interface Blob {
  cx: number; cy: number;
  w: number; h: number;
  score: number; id: number;
}

// ─── Blob Detection ───────────────────────────────────────────────────────────

const BLOCK = 12;

function detectBlobs(
  cur: Uint8ClampedArray,
  prev: Uint8ClampedArray | null,
  W: number, H: number,
  mode: TrackMode, threshold: number, maxCount: number, minSize: number
): Blob[] {
  const bw = Math.ceil(W / BLOCK), bh = Math.ceil(H / BLOCK);
  const scores = new Float32Array(bw * bh);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let sum = 0, cnt = 0;
      for (let dy = 0; dy < BLOCK; dy++) {
        for (let dx = 0; dx < BLOCK; dx++) {
          const px = bx * BLOCK + dx, py = by * BLOCK + dy;
          if (px >= W || py >= H) continue;
          const i = (py * W + px) * 4;
          const gray = (cur[i] * 0.299 + cur[i + 1] * 0.587 + cur[i + 2] * 0.114);
          if (mode === "bright") {
            sum += gray;
          } else if (mode === "dark") {
            sum += 255 - gray;
          } else {
            if (!prev) continue;
            sum += (Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2])) / 3;
          }
          cnt++;
        }
      }
      scores[by * bw + bx] = cnt > 0 ? sum / cnt : 0;
    }
  }

  const visited = new Uint8Array(bw * bh);
  const candidates: { bx: number; by: number; score: number }[] = [];
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      if (scores[by * bw + bx] > threshold) candidates.push({ bx, by, score: scores[by * bw + bx] });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const blobs: Blob[] = [];
  let idCounter = 0;

  for (const c of candidates) {
    if (blobs.length >= maxCount) break;
    if (visited[c.by * bw + c.bx]) continue;

    const queue: { bx: number; by: number }[] = [{ bx: c.bx, by: c.by }];
    let sx = 0, sy = 0, cnt = 0, ts = 0;
    let mnX = c.bx, mxX = c.bx, mnY = c.by, mxY = c.by;

    while (queue.length) {
      const { bx, by } = queue.shift()!;
      if (bx < 0 || bx >= bw || by < 0 || by >= bh || visited[by * bw + bx]) continue;
      if (scores[by * bw + bx] < threshold * 0.5) continue;
      visited[by * bw + bx] = 1;
      sx += bx; sy += by; cnt++; ts += scores[by * bw + bx];
      mnX = Math.min(mnX, bx); mxX = Math.max(mxX, bx);
      mnY = Math.min(mnY, by); mxY = Math.max(mxY, by);
      queue.push({ bx: bx - 1, by }, { bx: bx + 1, by }, { bx, by: by - 1 }, { bx, by: by + 1 });
    }
    if (!cnt) continue;
    const blobW = (mxX - mnX + 1) * BLOCK, blobH = (mxY - mnY + 1) * BLOCK;
    if (blobW < minSize || blobH < minSize) continue;
    blobs.push({ cx: (sx / cnt + 0.5) * BLOCK, cy: (sy / cnt + 0.5) * BLOCK, w: blobW, h: blobH, score: ts / cnt, id: idCounter++ });
  }
  return blobs;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

const THERMAL_LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r, g, b;
    if (t < 0.25) { r = 0; g = Math.round(t * 4 * 255); b = 255; }
    else if (t < 0.5) { r = 0; g = 255; b = Math.round((1 - (t - 0.25) * 4) * 255); }
    else if (t < 0.75) { r = Math.round((t - 0.5) * 4 * 255); g = 255; b = 0; }
    else { r = 255; g = Math.round((1 - (t - 0.75) * 4) * 255); b = 0; }
    lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
  }
  return lut;
})();

const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => v / 16));

function applyFilter(src: ImageData, filter: FilterType, frameN: number): ImageData {
  const W = src.width, H = src.height;
  const out = new Uint8ClampedArray(src.data.length);

  if (filter === "none") {
    out.set(src.data);
  } else if (filter === "thermal") {
    for (let i = 0; i < W * H * 4; i += 4) {
      const g = Math.round(src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114);
      out[i] = THERMAL_LUT[g * 3]; out[i + 1] = THERMAL_LUT[g * 3 + 1]; out[i + 2] = THERMAL_LUT[g * 3 + 2]; out[i + 3] = 255;
    }
  } else if (filter === "invert") {
    for (let i = 0; i < W * H * 4; i += 4) {
      out[i] = 255 - src.data[i]; out[i + 1] = 255 - src.data[i + 1]; out[i + 2] = 255 - src.data[i + 2]; out[i + 3] = 255;
    }
  } else if (filter === "glitch") {
    for (let y = 0; y < H; y++) {
      const shift = Math.sin(y * 0.3 + frameN * 0.4) > 0.7 ? Math.floor(Math.sin(frameN * 3.7 + y) * 20) : 0;
      for (let x = 0; x < W; x++) {
        const sx = Math.max(0, Math.min(W - 1, x + shift));
        const si = (y * W + sx) * 4, di = (y * W + x) * 4;
        out[di] = src.data[si]; out[di + 1] = src.data[si + 1]; out[di + 2] = src.data[si + 2]; out[di + 3] = 255;
      }
    }
  } else if (filter === "pixel") {
    const ps = 8;
    for (let py = 0; py < H; py += ps) {
      for (let px = 0; px < W; px += ps) {
        const si = (Math.min(py + ps / 2, H - 1) * W + Math.min(px + ps / 2, W - 1)) * 4;
        const r = src.data[si], g = src.data[si + 1], b = src.data[si + 2];
        for (let dy = 0; dy < ps; dy++) for (let dx = 0; dx < ps; dx++) {
          if (py + dy >= H || px + dx >= W) continue;
          const di = ((py + dy) * W + (px + dx)) * 4;
          out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = 255;
        }
      }
    }
  } else if (filter === "dither") {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const g = src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114;
        const v = g / 255 > BAYER4[y % 4][x % 4] ? 255 : 0;
        out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
      }
    }
  } else if (filter === "edge") {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const gx = (
          src.data[((y - 1) * W + x + 1) * 4] - src.data[((y - 1) * W + x - 1) * 4] +
          2 * src.data[(y * W + x + 1) * 4] - 2 * src.data[(y * W + x - 1) * 4] +
          src.data[((y + 1) * W + x + 1) * 4] - src.data[((y + 1) * W + x - 1) * 4]
        ) / 8;
        const gy = (
          src.data[((y + 1) * W + x - 1) * 4] - src.data[((y - 1) * W + x - 1) * 4] +
          2 * src.data[((y + 1) * W + x) * 4] - 2 * src.data[((y - 1) * W + x) * 4] +
          src.data[((y + 1) * W + x + 1) * 4] - src.data[((y - 1) * W + x + 1) * 4]
        ) / 8;
        const v = Math.min(255, Math.abs(gx) + Math.abs(gy));
        const di = (y * W + x) * 4;
        out[di] = v; out[di + 1] = v; out[di + 2] = v; out[di + 3] = 255;
      }
    }
  } else if (filter === "crt") {
    for (let y = 0; y < H; y++) {
      const scanline = y % 3 === 0 ? 0.6 : 1;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const phase = x % 3;
        out[i] = phase === 0 ? Math.round(src.data[i] * scanline) : 0;
        out[i + 1] = phase === 1 ? Math.round(src.data[i + 1] * scanline) : 0;
        out[i + 2] = phase === 2 ? Math.round(src.data[i + 2] * scanline) : 0;
        out[i + 3] = 255;
      }
    }
  }

  return new ImageData(out, W, H);
}

// ─── Overlay Drawing ──────────────────────────────────────────────────────────

function parseColor(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  blobs: Blob[],
  shape: ShapeType,
  conn: ConnMode,
  color: string,
  strokeWidth: number,
  trails: Map<number, { x: number; y: number }[]>,
  frameN: number,
  fontSize: number,
  blobSize: number
) {
  const [cr, cg, cb] = parseColor(color);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  const cx = ctx.canvas.width / 2, cy = ctx.canvas.height / 2;

  // Connections
  if (conn === "mesh") {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        ctx.beginPath();
        ctx.moveTo(blobs[i].cx, blobs[i].cy);
        ctx.lineTo(blobs[j].cx, blobs[j].cy);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else if (conn === "hub") {
    ctx.globalAlpha = 0.5;
    for (const b of blobs) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(b.cx, b.cy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of blobs) {
    const r = Math.max(blobSize, Math.max(b.w, b.h) / 2);
    const hw = Math.max(blobSize, b.w / 2), hh = Math.max(blobSize, b.h / 2);

    if (shape === "basic") {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, strokeWidth * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
      ctx.stroke();

    } else if (shape === "circle") {
      const pulse = 1 + 0.05 * Math.sin(frameN * 0.15 + b.id);
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, 4, 0, Math.PI * 2);
      ctx.fill();

    } else if (shape === "scope") {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
      ctx.stroke();
      const cs = r * 1.4;
      ctx.beginPath();
      ctx.moveTo(b.cx - cs, b.cy); ctx.lineTo(b.cx - r * 0.2, b.cy);
      ctx.moveTo(b.cx + r * 0.2, b.cy); ctx.lineTo(b.cx + cs, b.cy);
      ctx.moveTo(b.cx, b.cy - cs); ctx.lineTo(b.cx, b.cy - r * 0.2);
      ctx.moveTo(b.cx, b.cy + r * 0.2); ctx.lineTo(b.cx, b.cy + cs);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, 3, 0, Math.PI * 2);
      ctx.fill();

    } else if (shape === "frame") {
      ctx.strokeRect(b.cx - hw, b.cy - hh, hw * 2, hh * 2);
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, 3, 0, Math.PI * 2);
      ctx.fill();

    } else if (shape === "lframe") {
      const llen = Math.min(hw, hh) * 0.4;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [sx, sy] of corners) {
        const ox = b.cx + sx * hw, oy = b.cy + sy * hh;
        ctx.beginPath();
        ctx.moveTo(ox, oy); ctx.lineTo(ox + sx * -llen, oy);
        ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + sy * -llen);
        ctx.stroke();
      }

    } else if (shape === "xframe") {
      const llen = Math.min(hw, hh) * 0.35;
      const diag = Math.min(hw, hh) * 0.2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const ox = b.cx + sx * hw, oy = b.cy + sy * hh;
        ctx.beginPath();
        ctx.moveTo(ox, oy); ctx.lineTo(ox + sx * -llen, oy);
        ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + sy * -llen);
        ctx.moveTo(ox + sx * diag, oy + sy * diag);
        ctx.lineTo(ox - sx * diag, oy - sy * diag);
        ctx.stroke();
      }

    } else if (shape === "glow") {
      const grad = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, r * 1.5);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.6)`);
      grad.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.25)`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, r, 0, Math.PI * 2);
      ctx.stroke();

    } else if (shape === "particle") {
      const trail = trails.get(b.id) || [];
      trail.push({ x: b.cx, y: b.cy });
      if (trail.length > 40) trail.shift();
      trails.set(b.id, trail);
      for (let i = 0; i < trail.length; i++) {
        const alpha = (i / trail.length) * 0.8;
        const size = (i / trail.length) * strokeWidth * 4;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, strokeWidth * 4, 0, Math.PI * 2);
      ctx.fill();

    } else if (shape === "label") {
      ctx.strokeRect(b.cx - hw, b.cy - hh, hw * 2, hh * 2);
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      const label = `#${b.id + 1}`;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = strokeWidth + 2;
      ctx.strokeText(label, b.cx, b.cy - hh - 4);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.fillStyle = color;
      ctx.fillText(label, b.cx, b.cy - hh - 4);
    }
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEMO_BLOBS = [
  { x: 0.3, y: 0.4, ox: 0, oy: 0, vx: 0.004, vy: 0.003, r: 50, g: 80, b: 255 },
  { x: 0.7, y: 0.6, ox: 1, oy: 1, vx: -0.003, vy: 0.005, r: 255, g: 60, b: 100 },
  { x: 0.5, y: 0.25, ox: 2, oy: 0, vx: 0.005, vy: -0.004, r: 0, g: 220, b: 120 },
  { x: 0.2, y: 0.7, ox: 0, oy: 2, vx: -0.004, vy: -0.003, r: 255, g: 180, b: 0 },
];

const SHAPE_OPTS: { id: ShapeType; label: string }[] = [
  { id: "basic", label: "Basic" }, { id: "circle", label: "Kreis" },
  { id: "scope", label: "Scope" }, { id: "frame", label: "Rahmen" },
  { id: "lframe", label: "L-Rahmen" }, { id: "xframe", label: "X-Rahmen" },
  { id: "glow", label: "Glow" }, { id: "particle", label: "Partikel" },
  { id: "label", label: "Label" },
];

const FILTER_OPTS: { id: FilterType; label: string }[] = [
  { id: "none", label: "Original" }, { id: "thermal", label: "Thermal" },
  { id: "invert", label: "Invertiert" }, { id: "glitch", label: "Glitch" },
  { id: "pixel", label: "Pixel" }, { id: "dither", label: "Dither" },
  { id: "edge", label: "Kanten" }, { id: "crt", label: "CRT" },
];

const TRACK_OPTS: { id: TrackMode; label: string; desc: string }[] = [
  { id: "motion", label: "Bewegung", desc: "Verfolgt sich bewegende Objekte" },
  { id: "bright", label: "Hell", desc: "Verfolgt helle Bereiche" },
  { id: "dark", label: "Dunkel", desc: "Verfolgt dunkle Bereiche" },
];

const CONN_OPTS: { id: ConnMode; label: string }[] = [
  { id: "none", label: "Keine" }, { id: "mesh", label: "Netz" }, { id: "hub", label: "Hub" },
];

const PRESET_COLORS = ["#00ff88", "#00aaff", "#ff4499", "#ffaa00", "#aa44ff", "#ffffff", "#ff3300", "#00ffff"];

export default function MotionTrack() {
  const srcCanvasRef = useRef<HTMLCanvasElement>(null);
  const outCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const trailsRef = useRef<Map<number, { x: number; y: number }[]>>(new Map());
  const frameNRef = useRef(0);
  const demoTRef = useRef(0);
  const demoRef = useRef(DEMO_BLOBS.map(b => ({ ...b })));

  const [source, setSource] = useState<SourceMode>("demo");
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [trackMode, setTrackMode] = useState<TrackMode>("motion");
  const [shape, setShape] = useState<ShapeType>("scope");
  const [filter, setFilter] = useState<FilterType>("none");
  const [conn, setConn] = useState<ConnMode>("none");
  const [color, setColor] = useState("#00ff88");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [blobCount, setBlobCount] = useState(4);
  const [blobSize, setBlobSize] = useState(32);
  const [threshold, setThreshold] = useState(20);
  const [fontSize, setFontSize] = useState(14);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [blobsFound, setBlobsFound] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stateRef = useRef({
    source, playing, trackMode, shape, filter, conn,
    color, strokeWidth, blobCount, blobSize, threshold, fontSize, videoSpeed
  });
  useEffect(() => {
    stateRef.current = {
      source, playing, trackMode, shape, filter, conn,
      color, strokeWidth, blobCount, blobSize, threshold, fontSize, videoSpeed
    };
    const v = videoRef.current;
    if (v) v.playbackRate = videoSpeed;
  }, [source, playing, trackMode, shape, filter, conn, color, strokeWidth, blobCount, blobSize, threshold, fontSize, videoSpeed]);

  const drawDemo = useCallback(() => {
    const canvas = srcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const t = demoTRef.current;

    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(60,60,120,0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Moving demo blobs
    const demo = demoRef.current;
    for (const b of demo) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < 0.1 || b.x > 0.9) b.vx *= -1;
      if (b.y < 0.1 || b.y > 0.9) b.vy *= -1;
      const bx = b.x * W, by = b.y * H;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 80 + 20 * Math.sin(t + b.ox));
      grad.addColorStop(0, `rgba(${b.r},${b.g},${b.b},0.9)`);
      grad.addColorStop(0.6, `rgba(${b.r},${b.g},${b.b},0.3)`);
      grad.addColorStop(1, `rgba(${b.r},${b.g},${b.b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    demoTRef.current += 0.02;
  }, []);

  useEffect(() => {
    const W = 640, H = 480;
    let raf = 0;
    let lastTime = 0;

    const loop = (time: number) => {
      const s = stateRef.current;
      if (s.playing && time - lastTime >= 30) {
        const src = srcCanvasRef.current;
        const out = outCanvasRef.current;
        if (!src || !out) { raf = requestAnimationFrame(loop); return; }

        const sc = src.getContext("2d", { willReadFrequently: true });
        const oc = out.getContext("2d");
        if (!sc || !oc) { raf = requestAnimationFrame(loop); return; }

        // Draw source
        if (s.source === "demo") {
          drawDemo();
        } else {
          const v = videoRef.current;
          if (v && v.readyState >= 2) sc.drawImage(v, 0, 0, W, H);
        }

        const srcData = sc.getImageData(0, 0, W, H);
        const blobs = detectBlobs(srcData.data, prevFrameRef.current, W, H, s.trackMode, s.threshold, s.blobCount, s.blobSize);
        prevFrameRef.current = new Uint8ClampedArray(srcData.data);

        // Apply filter
        const filtered = applyFilter(srcData, s.filter, frameNRef.current);
        oc.putImageData(filtered, 0, 0);

        // Draw overlays
        drawOverlay(oc, blobs, s.shape, s.conn, s.color, s.strokeWidth, trailsRef.current, frameNRef.current, s.fontSize, s.blobSize);

        setBlobsFound(blobs.length);
        frameNRef.current++;
        lastTime = time;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    rafRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [drawDemo]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    prevFrameRef.current = null;
    trailsRef.current.clear();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      const srcCtx = srcCanvasRef.current?.getContext("2d");
      if (srcCtx) {
        const drawV = () => {
          if (v.readyState >= 2) srcCtx.drawImage(v, 0, 0, 640, 480);
          if (stateRef.current.source === "camera") requestAnimationFrame(drawV);
        };
        requestAnimationFrame(drawV);
      }
    } catch (e: any) {
      setCameraError(e.message);
      setSource("demo");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleVideoFile = useCallback((file: File) => {
    prevFrameRef.current = null;
    trailsRef.current.clear();
    const url = URL.createObjectURL(file);
    const v = videoRef.current;
    if (!v) return;
    v.src = url;
    v.loop = true;
    v.play();
    setSource("video");
  }, []);

  useEffect(() => {
    if (source === "camera") startCamera();
    else stopCamera();
  }, [source]);

  const W = 640, H = 480;

  return (
    <ToolLayout
      title="Motion Track"
      description="Echtzeit-Objekt- und Bewegungsverfolgung"
      headerRight={
        <>
          <span className="text-xs font-mono text-zinc-500 mr-1">
            {blobsFound} <span className="text-zinc-600">Blobs</span>
          </span>
          <Button size="sm" variant="ghost" data-testid="button-play-pause"
            onClick={() => setPlaying(p => !p)} className="text-zinc-300">
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-toggle-panel"
            onClick={() => setPanelOpen(p => !p)} className="text-zinc-300">
            <Settings2 className="w-4 h-4 mr-1" />
            {panelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </Button>
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-5 gap-4">
        <div className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-zinc-800 bg-[#080810]">
          <canvas ref={srcCanvasRef} width={W} height={H} className="hidden" />
          <canvas ref={outCanvasRef} width={W} height={H} data-testid="canvas-output" className="block max-w-full" />
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Pause className="w-12 h-12 text-zinc-300" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {blobsFound > 0 && Array.from({ length: blobsFound }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            ))}
          </div>
        </div>
        <video ref={videoRef} className="hidden" playsInline muted loop />
        <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); }} />

        {cameraError && (
          <p className="text-xs text-red-400 bg-red-950/50 px-3 py-2 rounded-md border border-red-900">{cameraError}</p>
        )}

        {/* Source buttons */}
        <div className="flex gap-2 flex-wrap justify-center">
          <button data-testid="button-source-demo" onClick={() => setSource("demo")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${source === "demo" ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            <Monitor className="w-4 h-4" />Demo
          </button>
          <button data-testid="button-source-camera" onClick={() => setSource("camera")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${source === "camera" ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            <Camera className="w-4 h-4" />Kamera
          </button>
          <button data-testid="button-source-video" onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${source === "video" ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
            <Upload className="w-4 h-4" />Video
          </button>

          {/* Speed */}
          {source === "video" && (
            <div className="flex gap-1">
              {([1, 2, 3, 4] as const).map(s => (
                <button key={s} data-testid={`button-speed-${s}`} onClick={() => setVideoSpeed(s)}
                  className={`px-3 py-2 rounded-md text-xs font-bold transition-all ${videoSpeed === s ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                  {s}×
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {panelOpen && (
        <aside className="w-72 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 space-y-5">

            {/* Track Mode */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Verfolgungsmodus</h3>
              <div className="space-y-1.5">
                {TRACK_OPTS.map(t => (
                  <button key={t.id} data-testid={`button-track-${t.id}`} onClick={() => setTrackMode(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all ${trackMode === t.id ? "bg-emerald-700/80 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    <span className="text-sm font-medium block">{t.label}</span>
                    <span className="text-xs opacity-60">{t.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Shape */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Overlay-Form</h3>
              <div className="grid grid-cols-3 gap-1">
                {SHAPE_OPTS.map(s => (
                  <button key={s.id} data-testid={`button-shape-${s.id}`} onClick={() => setShape(s.id)}
                    className={`py-1.5 px-1 rounded-md text-xs font-medium transition-all text-center ${shape === s.id ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Filter */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Filter</h3>
              <div className="grid grid-cols-2 gap-1">
                {FILTER_OPTS.map(f => (
                  <button key={f.id} data-testid={`button-filter-${f.id}`} onClick={() => setFilter(f.id)}
                    className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${filter === f.id ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Connections */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Verbindungen</h3>
              <div className="grid grid-cols-3 gap-1">
                {CONN_OPTS.map(c => (
                  <button key={c.id} data-testid={`button-conn-${c.id}`} onClick={() => setConn(c.id)}
                    className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${conn === c.id ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Color */}
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Farbe</h3>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} data-testid={`button-color-${c.slice(1)}`} onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-md transition-all ${color === c ? "ring-2 ring-white scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-400">Benutzerdefiniert</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  data-testid="input-color" className="w-8 h-7 rounded cursor-pointer bg-transparent border-0" />
              </div>
            </section>

            {/* Sliders */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Parameter</h3>
              {([
                { label: "Linienbreite", value: strokeWidth, min: 1, max: 6, step: 0.5, set: setStrokeWidth, id: "slider-stroke" },
                { label: "Blob-Anzahl", value: blobCount, min: 1, max: 16, step: 1, set: setBlobCount, id: "slider-count" },
                { label: "Min. Blob-Größe", value: blobSize, min: 8, max: 256, step: 8, set: setBlobSize, id: "slider-size" },
                { label: "Empfindlichkeit", value: threshold, min: 5, max: 80, step: 1, set: setThreshold, id: "slider-threshold" },
                { label: "Label-Größe", value: fontSize, min: 10, max: 24, step: 2, set: setFontSize, id: "slider-fontsize" },
              ] as { label: string; value: number; min: number; max: number; step: number; set: (v: number) => void; id: string }[]).map(({ label, value, min, max, step, set, id }) => (
                <div key={id} className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{label}</span>
                    <span className="font-mono text-zinc-300">{value}</span>
                  </div>
                  <Slider data-testid={id} value={[value]} min={min} max={max} step={step}
                    onValueChange={([v]) => set(v)} />
                </div>
              ))}
            </section>

            {/* Reset */}
            <Button variant="secondary" size="sm" data-testid="button-reset"
              className="w-full bg-zinc-800 text-zinc-300 border-zinc-700"
              onClick={() => {
                prevFrameRef.current = null;
                trailsRef.current.clear();
                setShape("scope"); setFilter("none"); setConn("none");
                setColor("#00ff88"); setStrokeWidth(2); setBlobCount(4);
                setBlobSize(32); setThreshold(20);
              }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Zurücksetzen
            </Button>
          </div>
        </aside>
      )}
    </ToolLayout>
  );
}
