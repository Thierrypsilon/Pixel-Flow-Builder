import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Camera, Monitor, Upload, RefreshCw } from "lucide-react";

type SourceMode = "demo" | "camera" | "video";
type GlitchMode = "blocks" | "sort" | "channels" | "accumulate" | "all";

const CANVAS_W = 620, CANVAS_H = 440;
const BLOCK = 16;

// Demo: animated procedural pattern
function drawDemo(ctx: CanvasRenderingContext2D, t: number) {
  const W = CANVAS_W, H = CANVAS_H;
  ctx.fillStyle = "#080010";
  ctx.fillRect(0, 0, W, H);
  // Moving color blobs
  const blobs = [
    { x: 0.3 + 0.2 * Math.sin(t * 0.5), y: 0.4 + 0.15 * Math.cos(t * 0.3), r: 120, h: 200 },
    { x: 0.7 + 0.15 * Math.cos(t * 0.4), y: 0.3 + 0.2 * Math.sin(t * 0.6), r: 100, h: 300 },
    { x: 0.5 + 0.1 * Math.sin(t * 0.7), y: 0.7 + 0.1 * Math.cos(t * 0.4), r: 130, h: 100 },
  ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r);
    g.addColorStop(0, `hsla(${b.h},90%,55%,0.8)`);
    g.addColorStop(1, `hsla(${b.h},80%,40%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Stripes
  for (let y = 0; y < H; y += 8) {
    if (Math.sin(y * 0.1 + t) > 0.7) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.03 * Math.sin(t * 2)})`;
      ctx.fillRect(0, y, W, 4);
    }
  }
}

// ─── Glitch Effects ───────────────────────────────────────────────────────────
function glitchBlocks(
  out: Uint8ClampedArray, inp: Uint8ClampedArray, prev: Uint8ClampedArray,
  W: number, H: number, intensity: number
) {
  out.set(inp);
  const bw = Math.ceil(W / BLOCK), bh = Math.ceil(H / BLOCK);
  const numMosh = Math.floor(bw * bh * intensity * 0.3);
  for (let k = 0; k < numMosh; k++) {
    const srcBx = Math.floor(Math.random() * bw), srcBy = Math.floor(Math.random() * bh);
    const dstBx = Math.floor(Math.random() * bw), dstBy = Math.floor(Math.random() * bh);
    for (let dy = 0; dy < BLOCK; dy++) {
      for (let dx = 0; dx < BLOCK; dx++) {
        const sx = srcBx * BLOCK + dx, sy = srcBy * BLOCK + dy;
        const tx = dstBx * BLOCK + dx, ty = dstBy * BLOCK + dy;
        if (sx >= W || sy >= H || tx >= W || ty >= H) continue;
        const si = (sy * W + sx) * 4, ti = (ty * W + tx) * 4;
        out[ti] = prev[si]; out[ti+1] = prev[si+1]; out[ti+2] = prev[si+2]; out[ti+3] = 255;
      }
    }
  }
}

function glitchChannels(out: Uint8ClampedArray, inp: Uint8ClampedArray, W: number, H: number, intensity: number) {
  const shiftR = Math.floor(intensity * 30);
  const shiftG = Math.floor(intensity * 15);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const di = (y * W + x) * 4;
      const ri = (y * W + Math.min(W - 1, x + shiftR)) * 4;
      const gi = (y * W + Math.max(0, x - shiftG)) * 4;
      out[di]   = inp[ri];
      out[di+1] = inp[gi+1];
      out[di+2] = inp[di+2];
      out[di+3] = 255;
    }
  }
}

function glitchSort(out: Uint8ClampedArray, inp: Uint8ClampedArray, W: number, H: number, intensity: number) {
  out.set(inp);
  const segLen = Math.floor(8 + (1 - intensity) * 60);
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      const len = Math.min(segLen, H - y);
      const seg: { i: number; luma: number }[] = [];
      for (let k = 0; k < len; k++) {
        const i = ((y + k) * W + x) * 4;
        const luma = inp[i] * 0.299 + inp[i+1] * 0.587 + inp[i+2] * 0.114;
        if (luma > 30) seg.push({ i, luma }); // only sort bright pixels
      }
      seg.sort((a, b) => a.luma - b.luma);
      let si = 0;
      for (let k = 0; k < len; k++) {
        const ti = ((y + k) * W + x) * 4;
        const luma = inp[ti] * 0.299 + inp[ti+1] * 0.587 + inp[ti+2] * 0.114;
        if (luma > 30 && si < seg.length) {
          const src = seg[si++].i;
          out[ti] = inp[src]; out[ti+1] = inp[src+1]; out[ti+2] = inp[src+2];
        }
      }
      y += len;
    }
  }
}

function glitchAccumulate(out: Uint8ClampedArray, inp: Uint8ClampedArray, prev: Uint8ClampedArray, W: number, H: number, intensity: number) {
  const a = 0.3 + intensity * 0.5; // how much prev bleeds in
  const shift = Math.floor(intensity * 12);
  for (let y = 0; y < H; y++) {
    const rowShift = Math.sin(y * 0.2) > 0.6 ? Math.floor(Math.sin(y * 0.3) * shift) : 0;
    for (let x = 0; x < W; x++) {
      const sx = Math.min(W - 1, Math.max(0, x + rowShift));
      const di = (y * W + x) * 4;
      const si = (y * W + sx) * 4;
      out[di]   = inp[si]   * (1 - a) + prev[di]   * a;
      out[di+1] = inp[si+1] * (1 - a) + prev[di+1] * a;
      out[di+2] = inp[si+2] * (1 - a) + prev[di+2] * a;
      out[di+3] = 255;
    }
  }
}

export default function DatamoshPage() {
  const srcCanvasRef = useRef<HTMLCanvasElement>(null);
  const outCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const demoTRef = useRef(0);

  const [source, setSource] = useState<SourceMode>("demo");
  const [glitchMode, setGlitchMode] = useState<GlitchMode>("blocks");
  const [intensity, setIntensity] = useState(0.5);
  const [cameraError, setCameraError] = useState(false);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);

  const stateRef = useRef({ source: "demo" as SourceMode, glitchMode: "blocks" as GlitchMode, intensity: 0.5 });
  useEffect(() => { stateRef.current = { source, glitchMode, intensity }; }, [source, glitchMode, intensity]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: CANVAS_W, height: CANVAS_H } });
      if (!videoRef.current) videoRef.current = document.createElement("video");
      const vid = videoRef.current;
      vid.srcObject = stream;
      vid.autoplay = true; vid.muted = true; vid.playsInline = true;
      await vid.play();
    } catch { setCameraError(true); setSource("demo"); }
  }, []);

  const loadVideoFile = useCallback((file: File) => {
    stopCamera();
    setVideoFileName(file.name);
    if (!videoRef.current) videoRef.current = document.createElement("video");
    const vid = videoRef.current;
    vid.src = URL.createObjectURL(file);
    vid.loop = true; vid.muted = true; vid.autoplay = true;
    vid.play();
    setSource("video");
  }, [stopCamera]);

  useEffect(() => {
    if (source === "camera") startCamera();
    else if (source === "demo") { stopCamera(); setVideoFileName(null); }
  }, [source]);

  useEffect(() => {
    const src = srcCanvasRef.current;
    const out = outCanvasRef.current;
    if (!src || !out) return;
    const sc = src.getContext("2d", { willReadFrequently: true })!;
    const oc = out.getContext("2d")!;
    const W = CANVAS_W, H = CANVAS_H;
    let lastTime = 0;

    const loop = (time: number) => {
      const s = stateRef.current;
      if (time - lastTime >= 33) { // ~30fps
        lastTime = time;

        // Draw source
        if (s.source === "demo") {
          demoTRef.current += 0.02;
          drawDemo(sc, demoTRef.current);
        } else if (videoRef.current && videoRef.current.readyState >= 2) {
          sc.drawImage(videoRef.current, 0, 0, W, H);
        }

        const frame = sc.getImageData(0, 0, W, H);
        const prev = prevFrameRef.current ?? new Uint8ClampedArray(frame.data);
        const out_data = new Uint8ClampedArray(frame.data.length);

        // Apply glitch effect
        switch (s.glitchMode) {
          case "blocks":     glitchBlocks(out_data, frame.data, prev, W, H, s.intensity); break;
          case "channels":   glitchChannels(out_data, frame.data, W, H, s.intensity); break;
          case "sort":       glitchSort(out_data, frame.data, W, H, s.intensity); break;
          case "accumulate": glitchAccumulate(out_data, frame.data, prev, W, H, s.intensity); break;
          case "all": {
            const tmp = new Uint8ClampedArray(frame.data.length);
            glitchBlocks(tmp, frame.data, prev, W, H, s.intensity * 0.5);
            glitchChannels(out_data, tmp, W, H, s.intensity * 0.6);
            break;
          }
        }

        prevFrameRef.current = new Uint8ClampedArray(frame.data);
        const outImg = new ImageData(out_data, W, H);
        oc.putImageData(outImg, 0, 0);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); stopCamera(); };
  }, [stopCamera]);

  const MODE_INFO: { id: GlitchMode; label: string }[] = [
    { id: "blocks",     label: "Blöcke" },
    { id: "channels",   label: "RGB-Shift" },
    { id: "sort",       label: "Pixel Sort" },
    { id: "accumulate", label: "Akkumulation" },
    { id: "all",        label: "Alles" },
  ];

  return (
    <ToolLayout title="Datamosh" description="Video-Glitch und Datamoshing-Effekte">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex flex-col items-start gap-2">
          {/* Hidden source canvas */}
          <canvas ref={srcCanvasRef} width={CANVAS_W} height={CANVAS_H} className="hidden" />
          {/* Output canvas */}
          <canvas
            ref={outCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded bg-black"
          />
          {videoFileName && <p className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-full px-1">▶ {videoFileName}</p>}
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          {/* Source */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quelle</p>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant={source === "demo" ? "default" : "outline"}
                className="gap-1 text-xs" data-testid="button-source-demo"
                onClick={() => setSource("demo")}>
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
              onChange={e => { const f = e.target.files?.[0]; if (f) loadVideoFile(f); e.target.value = ""; }} />
            {cameraError && <p className="text-xs text-red-400 mt-1">Kamera nicht verfügbar.</p>}
          </div>

          {/* Glitch Mode */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Glitch-Modus</p>
            <div className="flex flex-col gap-1.5">
              {MODE_INFO.map(m => (
                <Button key={m.id} size="sm"
                  variant={glitchMode === m.id ? "default" : "outline"}
                  className="w-full text-xs justify-start"
                  data-testid={`button-mode-${m.id}`}
                  onClick={() => setGlitchMode(m.id)}>
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Intensity */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <div className="flex justify-between mb-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intensität</Label>
              <span className="text-xs text-muted-foreground">{Math.round(intensity * 100)}%</span>
            </div>
            <Slider min={0.05} max={1} step={0.01} value={[intensity]}
              data-testid="slider-intensity"
              onValueChange={([v]) => setIntensity(v)} />
          </div>

          <Button size="sm" variant="outline" className="gap-2 text-xs"
            data-testid="button-reset-buffer"
            onClick={() => { prevFrameRef.current = null; }}>
            <RefreshCw className="w-3 h-3" /> Puffer zurücksetzen
          </Button>

          <p className="text-[10px] text-muted-foreground/40 px-1 leading-snug">
            Datamoshing: Blöcke aus vorherigen Frames werden zufällig verschoben, wie Artefakte bei komprimiertem Video.
          </p>
        </div>
      </div>
    </ToolLayout>
  );
}
