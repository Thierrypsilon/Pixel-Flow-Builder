import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Video,
  Settings2,
  Play,
  Pause,
  RefreshCw,
  Square,
  Circle,
  Layers,
  Sun,
  Contrast,
  Droplets,
  Zap,
  ChevronRight,
  ChevronLeft,
  Monitor,
  ArrowLeft,
} from "lucide-react";

type QualityLevel = "low" | "medium" | "high" | "ultra";
type ColorMode = "color" | "bw" | "less" | "full";
type DitherAlgo = "none" | "floyd" | "bayer" | "ordered";
type ShapeMode = "squares" | "circles" | "mixed";
type SourceMode = "camera" | "video" | "demo";

const QUALITY_MAP: Record<QualityLevel, number> = {
  low: 12,
  medium: 7,
  high: 4,
  ultra: 2,
};

function clamp(v: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, v));
}

function applyAdjustments(
  r: number, g: number, b: number,
  brightness: number, contrast: number, saturation: number, lightness: number
): [number, number, number] {
  // Brightness
  r = clamp(r + brightness);
  g = clamp(g + brightness);
  b = clamp(b + brightness);

  // Contrast
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  r = clamp(cf * (r - 128) + 128);
  g = clamp(cf * (g - 128) + 128);
  b = clamp(cf * (b - 128) + 128);

  // Lightness (lift/crush)
  r = clamp(r + lightness);
  g = clamp(g + lightness);
  b = clamp(b + lightness);

  // Saturation
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = (saturation + 100) / 100;
  r = clamp(gray + sat * (r - gray));
  g = clamp(gray + sat * (g - gray));
  b = clamp(gray + sat * (b - gray));

  return [r, g, b];
}

function bayerMatrix4x4(): number[][] {
  return [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ].map(row => row.map(v => v / 16));
}

const BAYER = bayerMatrix4x4();

function getPixelColor(
  imgData: ImageData,
  x: number, y: number,
  colorMode: ColorMode,
  dither: DitherAlgo,
  threshold: number,
  brightness: number,
  contrast: number,
  saturation: number,
  lightness: number,
  blockSize: number,
  errors?: Float32Array
): [number, number, number] {
  const idx = (y * imgData.width + x) * 4;
  let r = imgData.data[idx];
  let g = imgData.data[idx + 1];
  let b = imgData.data[idx + 2];

  if (errors) {
    r = clamp(r + errors[idx]);
    g = clamp(g + errors[idx + 1]);
    b = clamp(b + errors[idx + 2]);
  }

  [r, g, b] = applyAdjustments(r, g, b, brightness, contrast, saturation, lightness);

  let gray = 0.299 * r + 0.587 * g + 0.114 * b;

  if (colorMode === "bw") {
    if (dither === "bayer") {
      const bv = BAYER[y % 4][x % 4];
      gray = gray / 255 > bv ? 255 : 0;
    } else {
      gray = gray > threshold ? 255 : 0;
    }
    return [gray, gray, gray];
  }

  if (colorMode === "less") {
    r = Math.round(r / 64) * 64;
    g = Math.round(g / 64) * 64;
    b = Math.round(b / 64) * 64;
    return [r, g, b];
  }

  if (colorMode === "full") {
    if (dither === "bayer") {
      const bv = BAYER[y % 4][x % 4] * 32;
      r = clamp(Math.round((r + bv) / 32) * 32);
      g = clamp(Math.round((g + bv) / 32) * 32);
      b = clamp(Math.round((b + bv) / 32) * 32);
    } else {
      r = Math.round(r / 32) * 32;
      g = Math.round(g / 32) * 32;
      b = Math.round(b / 32) * 32;
    }
    return [r, g, b];
  }

  return [r, g, b];
}

const DEMO_COLORS = [
  [255, 60, 120],
  [60, 180, 255],
  [120, 255, 80],
  [255, 200, 40],
  [180, 60, 255],
];

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const demoTimeRef = useRef<number>(0);

  const [source, setSource] = useState<SourceMode>("demo");
  const [quality, setQuality] = useState<QualityLevel>("medium");
  const [colorMode, setColorMode] = useState<ColorMode>("color");
  const [dither, setDither] = useState<DitherAlgo>("floyd");
  const [shapeMode, setShapeMode] = useState<ShapeMode>("squares");
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [threshold, setThreshold] = useState(128);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [lightness, setLightness] = useState(0);
  const [refreshRate, setRefreshRate] = useState(30);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  const stateRef = useRef({
    quality, colorMode, dither, shapeMode,
    threshold, brightness, contrast, saturation, lightness,
    refreshRate, playing, source
  });

  useEffect(() => {
    stateRef.current = {
      quality, colorMode, dither, shapeMode,
      threshold, brightness, contrast, saturation, lightness,
      refreshRate, playing, source
    };
  }, [quality, colorMode, dither, shapeMode, threshold, brightness, contrast, saturation, lightness, refreshRate, playing, source]);

  const processFrame = useCallback(() => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    const output = outputRef.current;
    if (!canvas || !output) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const outCtx = output.getContext("2d");
    if (!ctx || !outCtx) return;

    const blockSize = QUALITY_MAP[s.quality];
    const W = canvas.width;
    const H = canvas.height;

    let imgData: ImageData;
    try {
      imgData = ctx.getImageData(0, 0, W, H);
    } catch {
      return;
    }

    outCtx.fillStyle = "#000";
    outCtx.fillRect(0, 0, W, H);

    // Floyd-Steinberg error buffer
    const errors = s.dither === "floyd" ? new Float32Array(W * H * 4) : undefined;

    for (let py = 0; py < H; py += blockSize) {
      for (let px = 0; px < W; px += blockSize) {
        const sx = Math.min(px + Math.floor(blockSize / 2), W - 1);
        const sy = Math.min(py + Math.floor(blockSize / 2), H - 1);

        let [r, g, b] = getPixelColor(
          imgData, sx, sy, s.colorMode, s.dither, s.threshold,
          s.brightness, s.contrast, s.saturation, s.lightness,
          blockSize, errors
        );

        // Floyd-Steinberg error diffusion
        if (errors && s.colorMode === "bw") {
          const oidx = (sy * W + sx) * 4;
          const origGray = 0.299 * imgData.data[oidx] + 0.587 * imgData.data[oidx + 1] + 0.114 * imgData.data[oidx + 2];
          const newGray = r;
          const err = origGray - newGray;
          if (sx + blockSize < W) {
            errors[(sy * W + sx + blockSize) * 4] += err * 7 / 16;
          }
          if (sy + blockSize < H && sx - blockSize >= 0) {
            errors[((sy + blockSize) * W + sx - blockSize) * 4] += err * 3 / 16;
          }
          if (sy + blockSize < H) {
            errors[((sy + blockSize) * W + sx) * 4] += err * 5 / 16;
          }
          if (sy + blockSize < H && sx + blockSize < W) {
            errors[((sy + blockSize) * W + sx + blockSize) * 4] += err * 1 / 16;
          }
        }

        outCtx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;

        const bw = blockSize - 1;
        const bh = blockSize - 1;

        const shape = s.shapeMode === "mixed"
          ? (px + py) % (blockSize * 3) < blockSize * 1.5 ? "circle" : "square"
          : s.shapeMode === "circles" ? "circle" : "square";

        if (shape === "circle") {
          const cx = px + blockSize / 2;
          const cy = py + blockSize / 2;
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          const rad = (luma / 255) * (blockSize / 2) * 0.95 + 0.5;
          outCtx.beginPath();
          outCtx.arc(cx, cy, rad, 0, Math.PI * 2);
          outCtx.fill();
        } else {
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          const scale = (luma / 255) * 0.9 + 0.1;
          const sw = bw * scale;
          const sh = bh * scale;
          const ox = px + (bw - sw) / 2;
          const oy = py + (bh - sh) / 2;
          outCtx.fillRect(ox, oy, sw, sh);
        }
      }
    }
  }, []);

  const drawDemoFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const t = demoTimeRef.current;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 5; i++) {
      const [cr, cg, cb] = DEMO_COLORS[i];
      const x = W * (0.15 + 0.7 * ((Math.sin(t * 0.7 + i * 1.3) + 1) / 2));
      const y = H * (0.15 + 0.7 * ((Math.cos(t * 0.5 + i * 0.9) + 1) / 2));
      const radius = Math.min(W, H) * (0.2 + 0.1 * Math.sin(t + i));
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flowing lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.5;
    for (let j = 0; j < 8; j++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y = H / 2 + Math.sin(x / 60 + t * 1.2 + j * 0.8) * (H * 0.3) * Math.sin(t * 0.3 + j);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    demoTimeRef.current += 0.025;
  }, []);

  const drawVideoFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !video || video.readyState < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    let lastTime = 0;
    let frameCount = 0;
    let fpsTimer = 0;

    const loop = (time: number) => {
      const s = stateRef.current;
      if (!s.playing) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const interval = 1000 / s.refreshRate;
      if (time - lastTime >= interval) {
        if (s.source === "demo") {
          drawDemoFrame();
        } else {
          drawVideoFrame();
        }
        processFrame();
        lastTime = time;
        frameCount++;
      }

      fpsTimer += time - (fpsTimer === 0 ? time : lastTime);
      if (frameCount >= 10) {
        setFps(Math.round(frameCount / ((time - fpsTimer + 1) / 1000) * 10) || refreshRate);
        frameCount = 0;
        fpsTimer = time;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [processFrame, drawDemoFrame, drawVideoFrame]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setSource("camera");
      }
    } catch (e: any) {
      setCameraError("Kamera nicht verfügbar: " + e.message);
      setSource("demo");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (source === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  }, [source]);

  const W = 640;
  const H = 480;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col" style={{ fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button data-testid="button-back-to-tools" className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-zinc-100 transition-colors mr-1">
              <ArrowLeft className="w-4 h-4" />
              Tools
            </button>
          </Link>
          <div className="w-px h-5 bg-zinc-700" />
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">Pixel Flow</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono mr-2">{fps} fps</span>
          <Button
            size="sm"
            variant="ghost"
            data-testid="button-play-pause"
            onClick={() => setPlaying(p => !p)}
            className="text-zinc-300"
          >
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="button-toggle-panel"
            onClick={() => setPanelOpen(p => !p)}
            className="text-zinc-300"
          >
            <Settings2 className="w-4 h-4 mr-1" />
            Einstellungen
            {panelOpen ? <ChevronRight className="w-3 h-3 ml-1" /> : <ChevronLeft className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6 gap-4">
          <div className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-zinc-800">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="hidden"
            />
            <canvas
              ref={outputRef}
              width={W}
              height={H}
              data-testid="canvas-output"
              className="block max-w-full"
              style={{ imageRendering: "pixelated" }}
            />
            {!playing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="text-center">
                  <Pause className="w-12 h-12 text-zinc-300 mx-auto mb-2" />
                  <span className="text-zinc-300 text-sm">Pausiert</span>
                </div>
              </div>
            )}
          </div>
          <video ref={videoRef} className="hidden" playsInline muted />

          {cameraError && (
            <p className="text-xs text-red-400 bg-red-950/50 px-3 py-2 rounded-md border border-red-900">{cameraError}</p>
          )}

          {/* Source Selector */}
          <div className="flex gap-2">
            <button
              data-testid="button-source-demo"
              onClick={() => setSource("demo")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${source === "demo" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              <Monitor className="w-4 h-4" />
              Demo
            </button>
            <button
              data-testid="button-source-camera"
              onClick={() => setSource("camera")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${source === "camera" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              <Camera className="w-4 h-4" />
              Kamera
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {panelOpen && (
          <aside className="w-72 border-l border-zinc-800 bg-zinc-900/60 backdrop-blur-sm flex flex-col overflow-y-auto">
            <div className="p-5 space-y-6">

              {/* Quality */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Auflösung</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["low", "medium", "high", "ultra"] as QualityLevel[]).map(q => (
                    <button
                      key={q}
                      data-testid={`button-quality-${q}`}
                      onClick={() => setQuality(q)}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${quality === q ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                      {q === "low" ? "Niedrig" : q === "medium" ? "Mittel" : q === "high" ? "Hoch" : "Ultra"}
                    </button>
                  ))}
                </div>
              </section>

              {/* Color Mode */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Farbmodus</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "color", label: "Farbe" },
                    { v: "bw", label: "S/W" },
                    { v: "less", label: "Wenig Farbe" },
                    { v: "full", label: "Volle Farbe" },
                  ] as { v: ColorMode; label: string }[]).map(({ v, label }) => (
                    <button
                      key={v}
                      data-testid={`button-color-${v}`}
                      onClick={() => setColorMode(v)}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${colorMode === v ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Dithering */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Dithering</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "none", label: "Keins" },
                    { v: "floyd", label: "Floyd-Steinberg" },
                    { v: "bayer", label: "4×4 Bayer" },
                    { v: "ordered", label: "Geordnet" },
                  ] as { v: DitherAlgo; label: string }[]).map(({ v, label }) => (
                    <button
                      key={v}
                      data-testid={`button-dither-${v}`}
                      onClick={() => setDither(v)}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${dither === v ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Shapes */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Formen</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "squares", label: "Quadrate", icon: <Square className="w-3.5 h-3.5" /> },
                    { v: "circles", label: "Kreise", icon: <Circle className="w-3.5 h-3.5" /> },
                    { v: "mixed", label: "Gemischt", icon: <Layers className="w-3.5 h-3.5" /> },
                  ] as { v: ShapeMode; label: string; icon: React.ReactNode }[]).map(({ v, label, icon }) => (
                    <button
                      key={v}
                      data-testid={`button-shape-${v}`}
                      onClick={() => setShapeMode(v)}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-md text-xs font-medium transition-all ${shapeMode === v ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Sliders */}
              <section className="space-y-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Bildanpassung</h3>

                <SliderRow
                  icon={<Sun className="w-3.5 h-3.5" />}
                  label="Helligkeit"
                  value={brightness}
                  min={-100}
                  max={100}
                  onChange={setBrightness}
                  testId="slider-brightness"
                />
                <SliderRow
                  icon={<Contrast className="w-3.5 h-3.5" />}
                  label="Kontrast"
                  value={contrast}
                  min={-100}
                  max={100}
                  onChange={setContrast}
                  testId="slider-contrast"
                />
                <SliderRow
                  icon={<Droplets className="w-3.5 h-3.5" />}
                  label="Sättigung"
                  value={saturation}
                  min={-100}
                  max={100}
                  onChange={setSaturation}
                  testId="slider-saturation"
                />
                <SliderRow
                  icon={<Zap className="w-3.5 h-3.5" />}
                  label="Lichtstärke"
                  value={lightness}
                  min={-80}
                  max={80}
                  onChange={setLightness}
                  testId="slider-lightness"
                />
              </section>

              {/* Threshold (for B&W) */}
              {colorMode === "bw" && (
                <section>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Schwellenwert</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Schwellenwert</span>
                      <span className="font-mono text-zinc-300">{threshold}</span>
                    </div>
                    <Slider
                      data-testid="slider-threshold"
                      value={[threshold]}
                      min={0}
                      max={255}
                      step={1}
                      onValueChange={([v]) => setThreshold(v)}
                      className="w-full"
                    />
                  </div>
                </section>
              )}

              {/* Refresh Rate */}
              <section>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Bildwiederholrate</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>FPS</span>
                    <span className="font-mono text-zinc-300">{refreshRate}</span>
                  </div>
                  <Slider
                    data-testid="slider-refresh"
                    value={[refreshRate]}
                    min={1}
                    max={60}
                    step={1}
                    onValueChange={([v]) => setRefreshRate(v)}
                    className="w-full"
                  />
                </div>
              </section>

              {/* Reset Button */}
              <Button
                variant="secondary"
                size="sm"
                data-testid="button-reset"
                className="w-full bg-zinc-800 text-zinc-300 border-zinc-700"
                onClick={() => {
                  setBrightness(0);
                  setContrast(0);
                  setSaturation(0);
                  setLightness(0);
                  setThreshold(128);
                  setRefreshRate(30);
                  setQuality("medium");
                  setColorMode("color");
                  setDither("floyd");
                  setShapeMode("squares");
                }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Zurücksetzen
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function SliderRow({
  icon, label, value, min, max, onChange, testId
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <span className="font-mono text-zinc-300">{value > 0 ? "+" : ""}{value}</span>
      </div>
      <Slider
        data-testid={testId}
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}
