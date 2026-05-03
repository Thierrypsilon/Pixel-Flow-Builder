import { useEffect, useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToolLayout } from "@/components/tool-layout";
import { Camera, Monitor, Play, Pause, Settings2, ChevronRight, ChevronLeft } from "lucide-react";

type DitherAlgo = "bayer2" | "bayer4" | "bayer8" | "floyd" | "atkinson" | "random";

const ALGOS: { id: DitherAlgo; name: string; desc: string }[] = [
  { id: "bayer2", name: "Bayer 2×2", desc: "Geordnetes Dithering" },
  { id: "bayer4", name: "Bayer 4×4", desc: "Geordnetes Dithering" },
  { id: "bayer8", name: "Bayer 8×8", desc: "Geordnetes Dithering" },
  { id: "floyd", name: "Floyd-Steinberg", desc: "Fehlerdiffusion" },
  { id: "atkinson", name: "Atkinson", desc: "Mac-Fehlerdiffusion" },
  { id: "random", name: "Zufall", desc: "Zufälliges Rauschen" },
];

const PALETTES_DITHER = [
  { name: "S/W", levels: [0, 255] },
  { name: "4 Grau", levels: [0, 85, 170, 255] },
  { name: "8 Grau", levels: [0, 36, 72, 109, 145, 182, 218, 255] },
  { name: "Monochrom Grün", levels: [0, 255], colorize: [0, 255, 0] as [number, number, number] },
  { name: "Monochrom Blau", levels: [0, 255], colorize: [0, 100, 255] as [number, number, number] },
  { name: "Monochrom Rot", levels: [0, 255], colorize: [255, 40, 0] as [number, number, number] },
];

const BAYER2 = [[0, 2], [3, 1]].map(r => r.map(v => v / 4));
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => v / 16));
const BAYER8 = (() => {
  const m: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const bx = x < 4 ? BAYER4[y < 4 ? y : y - 4][x] : BAYER4[y < 4 ? y : y - 4][x - 4];
    m[y][x] = x < 4 ? (y < 4 ? BAYER4[y][x] / 2 : BAYER4[y - 4][x] / 2 + 0.5) : (y < 4 ? BAYER4[y][x - 4] / 2 + 0.25 : BAYER4[y - 4][x - 4] / 2 + 0.75);
    m[y][x] = (BAYER4[y % 4][x % 4] + (y < 4 ? 0 : 0.5) + (x < 4 ? 0 : 0.25)) % 1;
  }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    let v = 0;
    for (let b = 0; b < 6; b++) {
      const xi = (x >> b) & 1, yi = (y >> b) & 1;
      v |= ((xi ^ yi) << (5 - b * 2 + 1)) | (yi << (5 - b * 2));
    }
    m[y][x] = v / 63;
  }
  return m;
})();

function quantize(v: number, levels: number[]): number {
  let closest = levels[0], minD = Math.abs(v - levels[0]);
  for (const l of levels) { const d = Math.abs(v - l); if (d < minD) { minD = d; closest = l; } }
  return closest;
}

type SourceMode = "demo" | "camera";

export default function DitheringTool() {
  const srcCanvasRef = useRef<HTMLCanvasElement>(null);
  const outCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  const [algo, setAlgo] = useState<DitherAlgo>("bayer4");
  const [palIdx, setPalIdx] = useState(0);
  const [source, setSource] = useState<SourceMode>("demo");
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [scale, setScale] = useState(100);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stateRef = useRef({ algo, palIdx, playing, scale, brightness, contrast, source });
  useEffect(() => { stateRef.current = { algo, palIdx, playing, scale, brightness, contrast, source }; },
    [algo, palIdx, playing, scale, brightness, contrast, source]);

  const drawDemo = useCallback(() => {
    const canvas = srcCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const t = tRef.current;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const v = (Math.sin(x / 30 + t * 0.8) * Math.cos(y / 25 - t * 0.5) + Math.sin((x + y) / 40 + t * 0.3) + 2) / 3;
        const gray = Math.round(v * 200 + 20);
        ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    tRef.current += 0.02;
  }, []);

  const processFrame = useCallback(() => {
    const s = stateRef.current;
    const src = srcCanvasRef.current;
    const out = outCanvasRef.current;
    if (!src || !out) return;
    const sc = src.getContext("2d", { willReadFrequently: true });
    const oc = out.getContext("2d");
    if (!sc || !oc) return;

    const W = src.width, H = src.height;
    const scaleFactor = s.scale / 100;
    const sw = Math.max(1, Math.floor(W * scaleFactor));
    const sh = Math.max(1, Math.floor(H * scaleFactor));

    const tmp = document.createElement("canvas");
    tmp.width = sw; tmp.height = sh;
    const tc = tmp.getContext("2d", { willReadFrequently: true })!;
    tc.drawImage(src, 0, 0, sw, sh);
    const id = tc.getImageData(0, 0, sw, sh);
    const od = tc.createImageData(sw, sh);
    const errors = new Float32Array(sw * sh);
    const pal = PALETTES_DITHER[s.palIdx];
    const cf = (259 * (s.contrast + 255)) / (255 * (259 - s.contrast));

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i4 = (y * sw + x) * 4;
        let r = id.data[i4], g = id.data[i4 + 1], b = id.data[i4 + 2];
        r = Math.max(0, Math.min(255, r + s.brightness));
        g = Math.max(0, Math.min(255, g + s.brightness));
        b = Math.max(0, Math.min(255, b + s.brightness));
        r = Math.max(0, Math.min(255, cf * (r - 128) + 128));
        g = Math.max(0, Math.min(255, cf * (g - 128) + 128));
        b = Math.max(0, Math.min(255, cf * (b - 128) + 128));
        let gray = Math.max(0, Math.min(255, 0.299 * r + 0.587 * g + 0.114 * b + errors[y * sw + x]));

        let out_v: number;
        if (s.algo === "bayer2") {
          out_v = gray / 255 > BAYER2[y % 2][x % 2] ? 255 : 0;
        } else if (s.algo === "bayer4") {
          out_v = gray / 255 > BAYER4[y % 4][x % 4] ? 255 : 0;
        } else if (s.algo === "bayer8") {
          out_v = gray / 255 > BAYER8[y % 8][x % 8] ? 255 : 0;
        } else if (s.algo === "random") {
          out_v = gray / 255 > Math.random() ? 255 : 0;
        } else {
          out_v = quantize(gray, pal.levels);
        }

        if (s.algo === "floyd") {
          const err = gray - out_v;
          if (x + 1 < sw) errors[y * sw + x + 1] += err * 7 / 16;
          if (y + 1 < sh) {
            if (x - 1 >= 0) errors[(y + 1) * sw + x - 1] += err * 3 / 16;
            errors[(y + 1) * sw + x] += err * 5 / 16;
            if (x + 1 < sw) errors[(y + 1) * sw + x + 1] += err * 1 / 16;
          }
        } else if (s.algo === "atkinson") {
          const err = gray - out_v;
          const spread = err / 8;
          if (x + 1 < sw) errors[y * sw + x + 1] += spread;
          if (x + 2 < sw) errors[y * sw + x + 2] += spread;
          if (y + 1 < sh) {
            if (x - 1 >= 0) errors[(y + 1) * sw + x - 1] += spread;
            errors[(y + 1) * sw + x] += spread;
            if (x + 1 < sw) errors[(y + 1) * sw + x + 1] += spread;
          }
          if (y + 2 < sh) errors[(y + 2) * sw + x] += spread;
        }

        let fr = out_v, fg = out_v, fb = out_v;
        if (pal.colorize) {
          const [cr, cg, cb] = pal.colorize;
          fr = Math.round(out_v / 255 * cr);
          fg = Math.round(out_v / 255 * cg);
          fb = Math.round(out_v / 255 * cb);
        }
        od.data[i4] = fr; od.data[i4 + 1] = fg; od.data[i4 + 2] = fb; od.data[i4 + 3] = 255;
      }
    }
    tc.putImageData(od, 0, 0);
    oc.imageSmoothingEnabled = false;
    oc.drawImage(tmp, 0, 0, W, H);
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastTime = 0;
    const loop = (time: number) => {
      const s = stateRef.current;
      if (s.playing && time - lastTime >= 33) {
        if (s.source === "demo") drawDemo();
        else {
          const video = videoRef.current;
          const canvas = srcCanvasRef.current;
          if (canvas && video && video.readyState >= 2) {
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }
        processFrame();
        lastTime = time;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    rafRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [processFrame, drawDemo]);

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
      title="Dithering"
      description="Verschiedene Dithering-Algorithmen"
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
        <div className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-zinc-800 bg-black">
          <canvas ref={srcCanvasRef} width={W} height={H} className="hidden" />
          <canvas ref={outCanvasRef} width={W} height={H} data-testid="canvas-output" className="block max-w-full" style={{ imageRendering: "pixelated" }} />
        </div>
        <video ref={videoRef} className="hidden" playsInline muted />
        {cameraError && <p className="text-xs text-red-400 bg-red-950/50 px-3 py-2 rounded-md border border-red-900">{cameraError}</p>}
        <div className="flex gap-2">
          {(["demo", "camera"] as SourceMode[]).map(s => (
            <button key={s} data-testid={`button-source-${s}`} onClick={() => setSource(s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${source === s ? "bg-slate-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
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
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Algorithmus</h3>
              <div className="space-y-1.5">
                {ALGOS.map(a => (
                  <button key={a.id} data-testid={`button-algo-${a.id}`} onClick={() => setAlgo(a.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-all ${algo === a.id ? "bg-slate-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    <span className="text-sm font-medium block">{a.name}</span>
                    <span className="text-xs opacity-60">{a.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Farbpalette</h3>
              <div className="space-y-1.5">
                {PALETTES_DITHER.map((p, i) => (
                  <button key={i} data-testid={`button-pal-${i}`} onClick={() => setPalIdx(i)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${palIdx === i ? "bg-slate-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Einstellungen</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400"><span>Auflösung</span><span className="font-mono text-zinc-300">{scale}%</span></div>
                <Slider data-testid="slider-scale" value={[scale]} min={10} max={100} step={5} onValueChange={([v]) => setScale(v)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400"><span>Helligkeit</span><span className="font-mono text-zinc-300">{brightness > 0 ? "+" : ""}{brightness}</span></div>
                <Slider data-testid="slider-brightness" value={[brightness]} min={-100} max={100} step={1} onValueChange={([v]) => setBrightness(v)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400"><span>Kontrast</span><span className="font-mono text-zinc-300">{contrast > 0 ? "+" : ""}{contrast}</span></div>
                <Slider data-testid="slider-contrast" value={[contrast]} min={-100} max={100} step={1} onValueChange={([v]) => setContrast(v)} />
              </div>
            </section>
          </div>
        </aside>
      )}
    </ToolLayout>
  );
}
