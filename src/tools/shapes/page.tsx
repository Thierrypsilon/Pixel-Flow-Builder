import { useEffect, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToolLayout } from "@/components/tool-layout";
import { Play, Pause, RefreshCw, Settings2, ChevronRight, ChevronLeft } from "lucide-react";

type ShapeType = "spirograph" | "lissajous" | "rose" | "fourier" | "hypocycloid";

const SHAPES: { id: ShapeType; name: string; desc: string }[] = [
  { id: "spirograph", name: "Spirograph", desc: "Hypotrochoid-Kurven" },
  { id: "lissajous", name: "Lissajous", desc: "Harmonische Schwingungen" },
  { id: "rose", name: "Rosenblüte", desc: "Polare Rosenkurven" },
  { id: "fourier", name: "Fourier", desc: "Umlaufende Epizykloiden" },
  { id: "hypocycloid", name: "Astroid", desc: "Hypozykloide Sterne" },
];

const PALETTES = [
  { name: "Neon", hues: [280, 320, 180, 60] },
  { name: "Pastell", hues: [200, 240, 280, 320] },
  { name: "Feuer", hues: [0, 30, 60, 10] },
  { name: "Eis", hues: [180, 200, 220, 240] },
  { name: "Mono", hues: [0, 0, 0, 0] },
];

function drawShape(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  type: ShapeType, t: number, scale: number, speed: number,
  R: number, r: number, d: number, a: number, b: number,
  palette: number, lineWidth: number, trailLength: number
) {
  const steps = Math.floor(trailLength * 200);
  const pal = PALETTES[palette];
  ctx.lineWidth = lineWidth;

  if (type === "spirograph") {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2 * 20 + t * speed * 0.01;
      const x = cx + (R - r) * Math.cos(angle) + d * Math.cos((R - r) / r * angle);
      const y = cy + (R - r) * Math.sin(angle) - d * Math.sin((R - r) / r * angle);
      const hue = (pal.hues[0] + i / steps * 120) % 360;
      const sat = pal.name === "Mono" ? "0%" : "80%";
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const hue = pal.hues[0];
    const sat = pal.name === "Mono" ? "0%" : "80%";
    ctx.strokeStyle = `hsl(${hue},${sat},60%)`;
    ctx.stroke();
  } else if (type === "lissajous") {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = cx + Math.sin(a * angle + t * speed * 0.02) * scale;
      const y = cy + Math.cos(b * angle) * scale;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const hue = (pal.hues[0] + t * 20) % 360;
    const sat = pal.name === "Mono" ? "0%" : "75%";
    ctx.strokeStyle = `hsl(${hue},${sat},65%)`;
    ctx.stroke();
  } else if (type === "rose") {
    ctx.beginPath();
    const k = a;
    for (let i = 0; i <= steps * 2; i++) {
      const angle = (i / (steps * 2)) * Math.PI * 2 * Math.max(a, b);
      const rho = Math.cos(k * angle + t * speed * 0.015) * scale;
      const x = cx + rho * Math.cos(angle);
      const y = cy + rho * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const hue = (pal.hues[0] + t * 15) % 360;
    const sat = pal.name === "Mono" ? "0%" : "80%";
    ctx.strokeStyle = `hsl(${hue},${sat},60%)`;
    ctx.stroke();
  } else if (type === "fourier") {
    const numCircles = Math.round(a);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + t * speed * 0.01;
      let x = cx, y = cy;
      for (let n = 1; n <= numCircles; n++) {
        const freq = n;
        const amp = scale / n;
        x += amp * Math.cos(freq * angle);
        y += amp * Math.sin(freq * angle);
      }
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const hue = (pal.hues[0] + t * 10) % 360;
    const sat = pal.name === "Mono" ? "0%" : "70%";
    ctx.strokeStyle = `hsl(${hue},${sat},65%)`;
    ctx.stroke();
  } else if (type === "hypocycloid") {
    const k = Math.round(b);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2 + t * speed * 0.01;
      const x = cx + scale * ((k - 1) * Math.cos(angle) + Math.cos((k - 1) * angle));
      const y = cy + scale * ((k - 1) * Math.sin(angle) - Math.sin((k - 1) * angle));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    const hue = (pal.hues[0] + t * 12) % 360;
    const sat = pal.name === "Mono" ? "0%" : "80%";
    ctx.strokeStyle = `hsl(${hue},${sat},60%)`;
    ctx.stroke();
  }
}

export default function Shapes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  const [shapeType, setShapeType] = useState<ShapeType>("spirograph");
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [palette, setPalette] = useState(0);
  const [speed, setSpeed] = useState(5);
  const [scale, setScale] = useState(75);
  const [R, setR] = useState(5);
  const [r, setR2] = useState(3);
  const [d, setD] = useState(5);
  const [a, setA] = useState(3);
  const [b, setB] = useState(5);
  const [lineWidth, setLineWidth] = useState(1.5);
  const [trailLength, setTrailLength] = useState(1);
  const [trails, setTrails] = useState(true);

  const stateRef = useRef({ shapeType, playing, palette, speed, scale, R, r, d, a, b, lineWidth, trailLength, trails });
  useEffect(() => {
    stateRef.current = { shapeType, playing, palette, speed, scale, R, r, d, a, b, lineWidth, trailLength, trails };
  }, [shapeType, playing, palette, speed, scale, R, r, d, a, b, lineWidth, trailLength, trails]);

  useEffect(() => {
    const W = 640, H = 480;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const loop = () => {
      const s = stateRef.current;
      if (s.playing) {
        const ctx = canvas.getContext("2d")!;
        if (s.trails) {
          ctx.fillStyle = "rgba(10,10,10,0.08)";
        } else {
          ctx.fillStyle = "rgb(10,10,10)";
        }
        ctx.fillRect(0, 0, W, H);
        drawShape(
          ctx, W / 2, H / 2, s.shapeType, tRef.current,
          (s.scale / 100) * Math.min(W, H) * 0.42,
          s.speed, s.R * 15, s.r * 8, s.d * 10, s.a, s.b,
          s.palette, s.lineWidth, s.trailLength
        );
        tRef.current += 0.016 * s.speed;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reset = () => {
    tRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgb(10,10,10)";
    ctx.fillRect(0, 0, 640, 480);
  };

  const W = 640, H = 480;

  return (
    <ToolLayout
      title="Shapes"
      description="Parametrische Spirographen und Kurven"
      headerRight={
        <>
          <Button size="sm" variant="ghost" data-testid="button-play-pause" onClick={() => setPlaying(p => !p)} className="text-zinc-300">
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-reset" onClick={reset} className="text-zinc-300">
            <RefreshCw className="w-4 h-4 mr-1" />Reset
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-toggle-panel" onClick={() => setPanelOpen(p => !p)} className="text-zinc-300">
            <Settings2 className="w-4 h-4 mr-1" />
            {panelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </Button>
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 p-6 gap-4">
        <div className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-zinc-800 bg-[#0a0a0a]">
          <canvas ref={canvasRef} width={W} height={H} data-testid="canvas-output" className="block max-w-full" />
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {SHAPES.map(s => (
            <button key={s.id} data-testid={`button-shape-${s.id}`} onClick={() => { setShapeType(s.id); reset(); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${shapeType === s.id ? "bg-cyan-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {panelOpen && (
        <aside className="w-72 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto">
          <div className="p-5 space-y-5">
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Farbpalette</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {PALETTES.map((p, i) => (
                  <button key={i} data-testid={`button-palette-${i}`} onClick={() => setPalette(i)}
                    className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${palette === i ? "bg-cyan-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Parameter</h3>
              {([
                { label: "Geschwindigkeit", value: speed, min: 1, max: 20, step: 1, set: setSpeed, id: "slider-speed" },
                { label: "Größe", value: scale, min: 10, max: 100, step: 1, set: setScale, id: "slider-scale" },
                { label: "R (Radius)", value: R, min: 1, max: 20, step: 1, set: setR, id: "slider-R" },
                { label: "r (Innenradius)", value: r, min: 1, max: 15, step: 1, set: setR2, id: "slider-r" },
                { label: "d (Stiftabstand)", value: d, min: 1, max: 15, step: 1, set: setD, id: "slider-d" },
                { label: "a (Frequenz 1)", value: a, min: 1, max: 10, step: 1, set: setA, id: "slider-a" },
                { label: "b (Frequenz 2)", value: b, min: 1, max: 10, step: 1, set: setB, id: "slider-b" },
                { label: "Linienstärke", value: lineWidth, min: 0.5, max: 5, step: 0.5, set: setLineWidth, id: "slider-linewidth" },
                { label: "Spurlänge", value: trailLength, min: 0.2, max: 5, step: 0.1, set: setTrailLength, id: "slider-trail" },
              ] as { label: string; value: number; min: number; max: number; step: number; set: (v: number) => void; id: string }[]).map(({ label, value, min, max, step, set, id }) => (
                <div key={id} className="space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{label}</span>
                    <span className="font-mono text-zinc-300">{value}</span>
                  </div>
                  <Slider data-testid={id} value={[value]} min={min} max={max} step={step} onValueChange={([v]) => set(v)} />
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={trails} onChange={e => setTrails(e.target.checked)} data-testid="checkbox-trails" className="accent-cyan-500" />
                <span className="text-xs text-zinc-400">Spuren aktivieren</span>
              </label>
            </section>
          </div>
        </aside>
      )}
    </ToolLayout>
  );
}
