import { useEffect, useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToolLayout } from "@/components/tool-layout";
import { Camera, Monitor, Play, Pause, Settings2, ChevronRight, ChevronLeft } from "lucide-react";

type GradientPreset = {
  name: string;
  stops: [number, string][];
};

const PRESETS: GradientPreset[] = [
  { name: "Hitze", stops: [[0, "#000000"], [0.25, "#9b1dcd"], [0.5, "#ff4500"], [0.75, "#ffaa00"], [1, "#ffffff"]] },
  { name: "Regenbogen", stops: [[0, "#ff0000"], [0.17, "#ff8800"], [0.33, "#ffff00"], [0.5, "#00cc00"], [0.66, "#0044ff"], [0.83, "#8800cc"], [1, "#ff0088"]] },
  { name: "Ozean", stops: [[0, "#000510"], [0.4, "#003366"], [0.7, "#0077bb"], [1, "#aaddff"]] },
  { name: "Wald", stops: [[0, "#000000"], [0.4, "#1a3300"], [0.7, "#337700"], [1, "#aaff44"]] },
  { name: "Sonnenuntergang", stops: [[0, "#1a0030"], [0.3, "#6600aa"], [0.6, "#ff3300"], [0.85, "#ff9900"], [1, "#ffeeaa"]] },
  { name: "Eis", stops: [[0, "#000033"], [0.4, "#003388"], [0.7, "#66aaff"], [1, "#eeeeff"]] },
  { name: "S/W", stops: [[0, "#000000"], [1, "#ffffff"]] },
  { name: "S/W Inv.", stops: [[0, "#ffffff"], [1, "#000000"]] },
];

function buildLUT(preset: GradientPreset): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const stops = preset.stops;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j][0] && t <= stops[j + 1][0]) {
        lo = stops[j]; hi = stops[j + 1];
        break;
      }
    }
    const range = hi[0] - lo[0];
    const f = range === 0 ? 0 : (t - lo[0]) / range;
    const loC = hexToRgb(lo[1]);
    const hiC = hexToRgb(hi[1]);
    lut[i * 3] = Math.round(loC[0] + f * (hiC[0] - loC[0]));
    lut[i * 3 + 1] = Math.round(loC[1] + f * (hiC[1] - loC[1]));
    lut[i * 3 + 2] = Math.round(loC[2] + f * (hiC[2] - loC[2]));
  }
  return lut;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

type SourceMode = "demo" | "camera";

export default function GradientMap() {
  const srcCanvasRef = useRef<HTMLCanvasElement>(null);
  const outCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  const [preset, setPreset] = useState(0);
  const [source, setSource] = useState<SourceMode>("demo");
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [invert, setInvert] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stateRef = useRef({ preset, brightness, contrast, invert, playing, source });
  useEffect(() => { stateRef.current = { preset, brightness, contrast, invert, playing, source }; },
    [preset, brightness, contrast, invert, playing, source]);

  const processFrame = useCallback(() => {
    const s = stateRef.current;
    const src = srcCanvasRef.current;
    const out = outCanvasRef.current;
    if (!src || !out) return;
    const sc = src.getContext("2d", { willReadFrequently: true });
    const oc = out.getContext("2d");
    if (!sc || !oc) return;
    const W = src.width, H = src.height;
    const id = sc.getImageData(0, 0, W, H);
    const od = oc.createImageData(W, H);
    const lut = buildLUT(PRESETS[s.preset]);
    const cf = (259 * (s.contrast + 255)) / (255 * (259 - s.contrast));

    for (let i = 0; i < W * H * 4; i += 4) {
      let r = id.data[i], g = id.data[i + 1], b = id.data[i + 2];
      r = Math.max(0, Math.min(255, r + s.brightness));
      g = Math.max(0, Math.min(255, g + s.brightness));
      b = Math.max(0, Math.min(255, b + s.brightness));
      r = Math.max(0, Math.min(255, cf * (r - 128) + 128));
      g = Math.max(0, Math.min(255, cf * (g - 128) + 128));
      b = Math.max(0, Math.min(255, cf * (b - 128) + 128));
      let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      if (s.invert) gray = 255 - gray;
      od.data[i] = lut[gray * 3];
      od.data[i + 1] = lut[gray * 3 + 1];
      od.data[i + 2] = lut[gray * 3 + 2];
      od.data[i + 3] = 255;
    }
    oc.putImageData(od, 0, 0);
  }, []);

  const drawDemo = useCallback(() => {
    const canvas = srcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const t = tRef.current;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const cols = [[255, 80, 40], [40, 120, 255], [80, 255, 120], [255, 200, 40]];
    cols.forEach(([r, g, b], i) => {
      const x = W * (0.15 + 0.7 * ((Math.sin(t * 0.6 + i * 1.4) + 1) / 2));
      const y = H * (0.15 + 0.7 * ((Math.cos(t * 0.4 + i * 1.1) + 1) / 2));
      const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.min(W, H) * 0.35);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    });
    tRef.current += 0.02;
  }, []);

  const drawCamera = useCallback(() => {
    const video = videoRef.current;
    const canvas = srcCanvasRef.current;
    if (!canvas || !video || video.readyState < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    let lastTime = 0;
    const loop = (time: number) => {
      const s = stateRef.current;
      if (s.playing && time - lastTime >= 33) {
        if (s.source === "demo") drawDemo(); else drawCamera();
        processFrame();
        lastTime = time;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [processFrame, drawDemo, drawCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (e: any) { setCameraError(e.message); setSource("demo"); }
  }, []);

  useEffect(() => {
    if (source === "camera") startCamera();
    else if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, [source]);

  const W = 640, H = 480;

  return (
    <ToolLayout
      title="Gradient Map"
      description="Farbverlaufskarten auf Bilder anwenden"
      headerRight={
        <>
          <Button size="sm" variant="ghost" data-testid="button-play-pause" onClick={() => setPlaying(p => !p)} className="text-zinc-300">
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Pause" : "Play"}
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
          <canvas ref={srcCanvasRef} width={W} height={H} className="hidden" />
          <canvas ref={outCanvasRef} width={W} height={H} data-testid="canvas-output" className="block max-w-full" />
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Pause className="w-12 h-12 text-zinc-300" />
            </div>
          )}
        </div>
        <video ref={videoRef} className="hidden" playsInline muted />
        {cameraError && <p className="text-xs text-red-400 bg-red-950/50 px-3 py-2 rounded-md border border-red-900">{cameraError}</p>}
        <div className="flex gap-2">
          {(["demo", "camera"] as SourceMode[]).map(s => (
            <button key={s} data-testid={`button-source-${s}`} onClick={() => setSource(s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${source === s ? "bg-rose-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
              {s === "camera" ? <Camera className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              {s === "camera" ? "Kamera" : "Demo"}
            </button>
          ))}
        </div>
      </div>

      {panelOpen && (
        <aside className="w-72 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto">
          <div className="p-5 space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Verlaufskarte</h3>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESETS.map((p, i) => {
                  const grad = `linear-gradient(to right, ${p.stops.map(([s, c]) => `${c} ${s * 100}%`).join(", ")})`;
                  return (
                    <button key={i} data-testid={`button-preset-${i}`} onClick={() => setPreset(i)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${preset === i ? "ring-2 ring-rose-500 bg-zinc-800" : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700"}`}>
                      <span className="w-20 h-4 rounded-sm flex-shrink-0 border border-zinc-700" style={{ background: grad }} />
                      <span className="text-zinc-300 text-xs">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Anpassung</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400"><span>Helligkeit</span><span className="font-mono text-zinc-300">{brightness > 0 ? "+" : ""}{brightness}</span></div>
                <Slider data-testid="slider-brightness" value={[brightness]} min={-100} max={100} step={1} onValueChange={([v]) => setBrightness(v)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400"><span>Kontrast</span><span className="font-mono text-zinc-300">{contrast > 0 ? "+" : ""}{contrast}</span></div>
                <Slider data-testid="slider-contrast" value={[contrast]} min={-100} max={100} step={1} onValueChange={([v]) => setContrast(v)} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={invert} onChange={e => setInvert(e.target.checked)} data-testid="checkbox-invert" className="accent-rose-500" />
                <span className="text-xs text-zinc-400">Invertieren</span>
              </label>
            </section>
          </div>
        </aside>
      )}
    </ToolLayout>
  );
}
