import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Camera, Monitor, Upload, Download, Play, Pause, Circle, Square } from "lucide-react";

type SourceMode = "demo" | "camera" | "video";
type EffectMode = "melt" | "smear" | "corrupt" | "projection";

const CANVAS_W = 620, CANVAS_H = 440;

// ─── Demo animation ───────────────────────────────────────────────────────────
function drawDemo(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  ctx.fillStyle = "rgba(4,0,12,0.5)";
  ctx.fillRect(0, 0, w, h);
  const shapes = [
    { fx: 0.5 + 0.4 * Math.sin(t * 0.3), fy: 0.5 + 0.3 * Math.cos(t * 0.4), r: 90, h: (t * 50) % 360 },
    { fx: 0.3 + 0.25 * Math.cos(t * 0.5), fy: 0.4 + 0.25 * Math.sin(t * 0.35), r: 65, h: (t * 50 + 120) % 360 },
    { fx: 0.7 + 0.2 * Math.sin(t * 0.6 + 1), fy: 0.6 + 0.2 * Math.cos(t * 0.45), r: 55, h: (t * 50 + 240) % 360 },
    { fx: 0.5 + 0.35 * Math.cos(t * 0.25 + 2), fy: 0.3 + 0.35 * Math.sin(t * 0.28), r: 40, h: (t * 50 + 60) % 360 },
  ];
  for (const s of shapes) {
    const bx = s.fx * w, by = s.fy * h;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, s.r);
    g.addColorStop(0, `hsla(${s.h},100%,75%,0.95)`);
    g.addColorStop(0.5, `hsla(${s.h},90%,50%,0.5)`);
    g.addColorStop(1, `hsla(${s.h},70%,30%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Fast diagonal lines for rich motion data
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const phase = t * (60 + i * 15) % (w + h);
    ctx.strokeStyle = `hsla(${(t * 60 + i * 90) % 360},100%,80%,0.35)`;
    ctx.lineWidth = 2 + i * 0.5;
    ctx.beginPath();
    ctx.moveTo(phase - h, 0);
    ctx.lineTo(phase, h);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Effect: Melt (pixel bleeding / color melt) ───────────────────────────────
function effectMelt(
  out: Uint8ClampedArray,
  curr: Uint8ClampedArray,
  melt: Uint8ClampedArray,
  W: number, H: number,
  intensity: number,
  t: number
) {
  const alpha = 0.04 + intensity * 0.35;
  const warp = intensity * 10;
  for (let y = 0; y < H; y++) {
    const warpY = Math.round(Math.sin(y * 0.04 + t * 0.8) * warp * 0.5);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const wx = Math.min(W - 1, Math.max(0, x + Math.round(Math.sin(y * 0.06 + t) * warp)));
      const wy = Math.min(H - 1, Math.max(0, y + warpY));
      const wi = (wy * W + wx) * 4;
      melt[i]   = melt[wi]   * (1 - alpha) + curr[i]   * alpha;
      melt[i+1] = melt[wi+1] * (1 - alpha) + curr[i+1] * alpha;
      melt[i+2] = melt[wi+2] * (1 - alpha) + curr[i+2] * alpha;
      melt[i+3] = 255;
      out[i] = melt[i]; out[i+1] = melt[i+1]; out[i+2] = melt[i+2]; out[i+3] = 255;
    }
  }
}

// ─── Effect: Smear (row / column displacement) ────────────────────────────────
function effectSmear(
  out: Uint8ClampedArray,
  curr: Uint8ClampedArray,
  prev: Uint8ClampedArray,
  W: number, H: number,
  intensity: number,
  t: number
) {
  const maxShift = Math.floor(intensity * 50);
  const smearProb = intensity * 0.8;
  for (let y = 0; y < H; y++) {
    const rowShift = Math.round(
      Math.sin(y * 0.07 + t * 2.5) * maxShift * 0.7 +
      Math.sin(y * 0.02 + t * 1.0) * maxShift * 0.3
    );
    for (let x = 0; x < W; x++) {
      const oi = (y * W + x) * 4;
      if (Math.random() < smearProb && prev.length > 0) {
        const sx = Math.min(W - 1, Math.max(0, x + rowShift));
        const si = (y * W + sx) * 4;
        const m = 0.35 + intensity * 0.45;
        out[oi]   = prev[si]   * m + curr[oi]   * (1 - m);
        out[oi+1] = prev[si+1] * m + curr[oi+1] * (1 - m);
        out[oi+2] = prev[si+2] * m + curr[oi+2] * (1 - m);
      } else {
        out[oi] = curr[oi]; out[oi+1] = curr[oi+1]; out[oi+2] = curr[oi+2];
      }
      out[oi+3] = 255;
    }
  }
}

// ─── Effect: Corrupt (block moshing) ─────────────────────────────────────────
function effectCorrupt(
  out: Uint8ClampedArray,
  curr: Uint8ClampedArray,
  prev: Uint8ClampedArray,
  W: number, H: number,
  intensity: number
) {
  out.set(curr);
  const bSize = Math.max(4, Math.floor(6 + (1 - intensity) * 30));
  const cols = Math.floor(W / bSize), rows = Math.floor(H / bSize);
  const numMosh = Math.floor(cols * rows * intensity * 0.45);
  const mix = 0.55 + intensity * 0.35;
  for (let k = 0; k < numMosh; k++) {
    const sx = Math.floor(Math.random() * cols) * bSize;
    const sy = Math.floor(Math.random() * rows) * bSize;
    const dx = Math.floor(Math.random() * cols) * bSize;
    const dy = Math.floor(Math.random() * rows) * bSize;
    for (let by = 0; by < bSize && sy + by < H && dy + by < H; by++) {
      for (let bx = 0; bx < bSize && sx + bx < W && dx + bx < W; bx++) {
        const si = ((sy + by) * W + (sx + bx)) * 4;
        const di = ((dy + by) * W + (dx + bx)) * 4;
        out[di]   = prev[si]   * mix + curr[di]   * (1 - mix);
        out[di+1] = prev[si+1] * mix + curr[di+1] * (1 - mix);
        out[di+2] = prev[si+2] * mix + curr[di+2] * (1 - mix);
        out[di+3] = 255;
      }
    }
  }
  // RGB channel shift
  const shift = Math.floor(intensity * 18);
  if (shift > 0) {
    for (let y = 0; y < H; y++) {
      for (let x = shift; x < W - shift; x++) {
        if (Math.random() > intensity * 0.08) continue;
        const di = (y * W + x) * 4;
        const si = (y * W + (x - shift)) * 4;
        out[di] = out[si]; // red bleeds left
        const si2 = (y * W + Math.min(W - 1, x + shift)) * 4;
        out[di+2] = out[si2+2]; // blue bleeds right
      }
    }
  }
}

// ─── Effect: Projection (ghost / frame stick) ─────────────────────────────────
function effectProjection(
  out: Uint8ClampedArray,
  curr: Uint8ClampedArray,
  ghost: Uint8ClampedArray,
  W: number, H: number,
  intensity: number
) {
  const threshold = 18 + (1 - intensity) * 70;
  const retain = 0.88 + intensity * 0.1;
  const mixIn = intensity * 0.75;
  for (let i = 0; i < W * H * 4; i += 4) {
    const diff = Math.abs(curr[i] - ghost[i]) + Math.abs(curr[i+1] - ghost[i+1]) + Math.abs(curr[i+2] - ghost[i+2]);
    if (diff > threshold) {
      ghost[i]   = ghost[i]   * retain + curr[i]   * (1 - retain);
      ghost[i+1] = ghost[i+1] * retain + curr[i+1] * (1 - retain);
      ghost[i+2] = ghost[i+2] * retain + curr[i+2] * (1 - retain);
    }
    ghost[i+3] = 255;
    out[i]   = ghost[i]   * mixIn + curr[i]   * (1 - mixIn);
    out[i+1] = ghost[i+1] * mixIn + curr[i+1] * (1 - mixIn);
    out[i+2] = ghost[i+2] * mixIn + curr[i+2] * (1 - mixIn);
    out[i+3] = 255;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PixelCrashPage() {
  const srcRef  = useRef<HTMLCanvasElement>(null);
  const outRef  = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef   = useRef<number>(0);
  const demoT    = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effect state buffers
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const auxBufRef    = useRef<Uint8ClampedArray | null>(null); // melt / ghost buffer
  const frameCountRef = useRef(0);

  const [source, setSource]       = useState<SourceMode>("demo");
  const [effect, setEffect]       = useState<EffectMode>("melt");
  const [intensity, setIntensity] = useState(0.6);
  const [paused, setPaused]       = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [cameraErr, setCameraErr] = useState(false);

  const recorderRef   = useRef<MediaRecorder | null>(null);
  const recTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const recChunksRef  = useRef<Blob[]>([]);

  const stateRef = useRef({ source: "demo" as SourceMode, effect: "melt" as EffectMode, intensity: 0.6, paused: false });
  useEffect(() => { stateRef.current = { source, effect, intensity, paused }; }, [source, effect, intensity, paused]);

  // Reset buffers when effect changes
  useEffect(() => { prevFrameRef.current = null; auxBufRef.current = null; }, [effect]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraErr(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: CANVAS_W, height: CANVAS_H } });
      if (!videoRef.current) videoRef.current = document.createElement("video");
      videoRef.current.srcObject = stream;
      videoRef.current.autoplay = true; videoRef.current.muted = true; videoRef.current.playsInline = true;
      await videoRef.current.play();
    } catch { setCameraErr(true); setSource("demo"); }
  }, []);

  const loadVideo = useCallback((file: File) => {
    stopCamera();
    setVideoName(file.name);
    if (!videoRef.current) videoRef.current = document.createElement("video");
    const vid = videoRef.current;
    vid.src = URL.createObjectURL(file);
    vid.loop = true; vid.muted = true; vid.autoplay = true; vid.playsInline = true;
    vid.play();
    prevFrameRef.current = null; auxBufRef.current = null;
    setSource("video");
  }, [stopCamera]);

  useEffect(() => {
    if (source === "camera") startCamera();
    else if (source === "demo") { stopCamera(); setVideoName(null); }
  }, [source, startCamera, stopCamera]);

  // ─── Main render loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const src = srcRef.current, out = outRef.current;
    if (!src || !out) return;
    const sc = src.getContext("2d", { willReadFrequently: true })!;
    const oc = out.getContext("2d")!;
    const W = CANVAS_W, H = CANVAS_H;
    let lastMs = 0;

    const loop = (ms: number) => {
      const s = stateRef.current;
      const dt = ms - lastMs;
      rafRef.current = requestAnimationFrame(loop);

      if (s.paused || dt < 28) return; // ~30fps cap
      lastMs = ms;
      frameCountRef.current++;

      // Draw source
      src.width = W; src.height = H;
      if (s.source === "demo") {
        demoT.current += 0.018;
        drawDemo(sc, demoT.current, W, H);
      } else if (videoRef.current && videoRef.current.readyState >= 2) {
        sc.drawImage(videoRef.current, 0, 0, W, H);
      } else {
        sc.fillStyle = "#060012"; sc.fillRect(0, 0, W, H);
      }

      const frame = sc.getImageData(0, 0, W, H);
      const curr = frame.data;
      const size = W * H * 4;

      if (!prevFrameRef.current) prevFrameRef.current = new Uint8ClampedArray(curr);
      if (!auxBufRef.current)    auxBufRef.current    = new Uint8ClampedArray(curr);
      const prev = prevFrameRef.current;
      const aux  = auxBufRef.current;

      const outArr = new Uint8ClampedArray(size);
      const t = frameCountRef.current * 0.016;

      switch (s.effect) {
        case "melt":       effectMelt(outArr, curr, aux, W, H, s.intensity, t); break;
        case "smear":      effectSmear(outArr, curr, prev, W, H, s.intensity, t); break;
        case "corrupt":    effectCorrupt(outArr, curr, prev, W, H, s.intensity); break;
        case "projection": effectProjection(outArr, curr, aux, W, H, s.intensity); break;
      }

      prevFrameRef.current = new Uint8ClampedArray(curr);
      oc.putImageData(new ImageData(outArr, W, H), 0, 0);

      // Overlay recording indicator
      if (isRecording) {
        oc.fillStyle = "rgba(220,30,30,0.85)";
        oc.beginPath(); oc.arc(W - 16, 16, 7, 0, Math.PI * 2); oc.fill();
        oc.fillStyle = "rgba(255,255,255,0.9)";
        oc.font = "10px monospace"; oc.textAlign = "right"; oc.textBaseline = "top";
        oc.fillText(`REC ${recDuration}s`, W - 28, 9);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); stopCamera(); };
  }, [stopCamera, isRecording, recDuration]);

  // ─── Recording ──────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const canvas = outRef.current;
    if (!canvas || isRecording) return;
    try {
      const stream = (canvas as any).captureStream(30) as MediaStream;
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "pixelcrash.webm"; a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecDuration(0);
        if (recTimerRef.current) clearInterval(recTimerRef.current);
      };
      recorder.start(100);
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecDuration(0);
      recTimerRef.current = setInterval(() => setRecDuration(d => d + 1), 1000);
    } catch (e) {
      console.warn("Recording not supported:", e);
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  }, []);

  useEffect(() => () => { if (recTimerRef.current) clearInterval(recTimerRef.current); }, []);

  // ─── Click to pause/play ─────────────────────────────────────────────────────
  const handleCanvasClick = useCallback(() => setPaused(p => !p), []);

  const EFFECTS: { id: EffectMode; label: string; desc: string }[] = [
    { id: "melt",       label: "Melt",       desc: "Farben schmelzen & fließen ineinander" },
    { id: "smear",      label: "Smear",      desc: "Zeilen werden wellenartig verschmiert" },
    { id: "corrupt",    label: "Corrupt",    desc: "Blöcke & Kanäle zufällig korrumpiert" },
    { id: "projection", label: "Projection", desc: "Voriger Frame klebt an der Szene" },
  ];

  return (
    <ToolLayout title="Pixel Crash" description="Echtzeit-Datamoshing & Videomoshing mit WebM-Export">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">

        {/* Canvas */}
        <div className="flex-1 flex flex-col items-start gap-2">
          <canvas ref={srcRef} className="hidden" />
          <div className="relative w-full max-w-full">
            <canvas
              ref={outRef}
              width={CANVAS_W}
              height={CANVAS_H}
              data-testid="canvas-output"
              className="max-w-full rounded bg-black cursor-pointer select-none"
              onClick={handleCanvasClick}
            />
            {/* Pause overlay */}
            {paused && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/50 rounded-full p-4">
                  <Play className="w-10 h-10 text-white opacity-80" />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-1">
            <p className="text-[10px] text-muted-foreground/40">
              {paused ? "Pausiert – klicken zum Fortsetzen" : "Klicken zum Pausieren"}
            </p>
            {videoName && <p className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-48">▶ {videoName}</p>}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full lg:w-64 flex flex-col gap-3">

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
            {cameraErr && <p className="text-[11px] text-red-400 mt-1">Kamera nicht verfügbar.</p>}
          </div>

          {/* Effects */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Effekt</p>
            <div className="flex flex-col gap-1.5">
              {EFFECTS.map(e => (
                <button
                  key={e.id}
                  data-testid={`button-effect-${e.id}`}
                  onClick={() => setEffect(e.id)}
                  className={`w-full text-left rounded-md px-3 py-2 text-xs transition-colors border ${
                    effect === e.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  <span className="font-semibold">{e.label}</span>
                  <span className={`block text-[10px] mt-0.5 ${effect === e.id ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                    {e.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Intensity */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <div className="flex justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intensität</Label>
              <span className="text-xs text-muted-foreground">{Math.round(intensity * 100)}%</span>
            </div>
            <Slider min={0.05} max={1.0} step={0.01} value={[intensity]}
              data-testid="slider-intensity"
              onValueChange={([v]) => setIntensity(v)} />
            <div className="flex gap-1 mt-2">
              {[["Sanft", 0.25], ["Mittel", 0.55], ["Stark", 0.82], ["Max", 1.0]].map(([label, val]) => (
                <Button key={label as string} size="sm" variant="outline"
                  className="flex-1 text-[10px] px-1"
                  data-testid={`button-intensity-${(label as string).toLowerCase()}`}
                  onClick={() => setIntensity(val as number)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Playback + Reset */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
              data-testid="button-toggle-pause"
              onClick={() => setPaused(p => !p)}>
              {paused ? <><Play className="w-3 h-3" /> Play</> : <><Pause className="w-3 h-3" /> Pause</>}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
              data-testid="button-reset-buffers"
              onClick={() => { prevFrameRef.current = null; auxBufRef.current = null; }}>
              Reset
            </Button>
          </div>

          {/* Recording */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">WebM Export</p>
            {!isRecording ? (
              <Button className="w-full gap-2 text-xs bg-red-600 hover:bg-red-700 text-white border-0"
                data-testid="button-start-record"
                onClick={startRecording}>
                <Circle className="w-3 h-3 fill-current" /> Aufnahme starten
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400 font-mono">REC {recDuration}s</span>
                </div>
                <Button variant="outline" className="w-full gap-2 text-xs border-red-500/50 text-red-400"
                  data-testid="button-stop-record"
                  onClick={stopRecording}>
                  <Square className="w-3 h-3" /> Stoppen & Herunterladen
                </Button>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/40 mt-2 leading-snug">
              Nimmt den Canvas als WebM-Video auf. Klicke Stoppen, um die Datei herunterzuladen.
            </p>
          </div>

        </div>
      </div>
    </ToolLayout>
  );
}
