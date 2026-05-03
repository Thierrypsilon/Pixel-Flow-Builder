import { useEffect, useRef, useState, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToolLayout } from "@/components/tool-layout";
import { Play, Pause, RefreshCw, Settings2, ChevronRight, ChevronLeft, Wand2 } from "lucide-react";

type EffectType = "assemble" | "explode" | "wave" | "rain" | "glitch";

const EFFECTS: { id: EffectType; name: string; desc: string }[] = [
  { id: "assemble", name: "Zusammensetzen", desc: "Pixel fliegen zum Text" },
  { id: "explode", name: "Explosion", desc: "Text explodiert in Pixel" },
  { id: "wave", name: "Welle", desc: "Pixel schwingen wie eine Welle" },
  { id: "rain", name: "Matrix-Regen", desc: "Pixel fallen wie Regen" },
  { id: "glitch", name: "Glitch", desc: "Digitaler Glitch-Effekt" },
];

const COLOR_SCHEMES = [
  { name: "Violett", fg: [180, 80, 255], bg: [10, 0, 20] },
  { name: "Neon Grün", fg: [0, 255, 100], bg: [0, 15, 5] },
  { name: "Feuer", fg: [255, 140, 0], bg: [15, 5, 0] },
  { name: "Eis", fg: [80, 200, 255], bg: [0, 10, 20] },
  { name: "Gold", fg: [255, 215, 0], bg: [20, 15, 0] },
  { name: "Rosa", fg: [255, 80, 180], bg: [20, 0, 10] },
];

interface Particle {
  x: number; y: number;
  tx: number; ty: number;
  vx: number; vy: number;
  life: number;
  r: number; g: number; b: number;
  size: number;
  phase: number;
}

export default function TextEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const tRef = useRef(0);
  const phaseRef = useRef<"in" | "hold" | "out">("in");

  const [text, setText] = useState("HELLO");
  const [effect, setEffect] = useState<EffectType>("assemble");
  const [colorScheme, setColorScheme] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [fontSize, setFontSize] = useState(80);
  const [particleSize, setParticleSize] = useState(3);
  const [speed, setSpeed] = useState(5);

  const stateRef = useRef({ text, effect, colorScheme, playing, fontSize, particleSize, speed });
  useEffect(() => {
    stateRef.current = { text, effect, colorScheme, playing, fontSize, particleSize, speed };
  }, [text, effect, colorScheme, playing, fontSize, particleSize, speed]);

  const buildParticles = useCallback((W: number, H: number) => {
    const s = stateRef.current;
    const tmp = document.createElement("canvas");
    tmp.width = W; tmp.height = H;
    const tc = tmp.getContext("2d")!;
    tc.fillStyle = "#000";
    tc.fillRect(0, 0, W, H);
    tc.fillStyle = "#fff";
    tc.font = `bold ${s.fontSize}px monospace`;
    tc.textAlign = "center";
    tc.textBaseline = "middle";
    tc.fillText(s.text, W / 2, H / 2);
    const data = tc.getImageData(0, 0, W, H).data;
    const col = COLOR_SCHEMES[s.colorScheme];
    const particles: Particle[] = [];
    const step = s.particleSize + 1;

    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 64) {
          const [r, g, b] = col.fg;
          const jitter = (v: number) => v + (Math.random() - 0.5) * 40;
          particles.push({
            tx: x, ty: y,
            x: s.effect === "assemble" ? Math.random() * W : x,
            y: s.effect === "assemble" ? Math.random() * H : y,
            vx: (Math.random() - 0.5) * 8,
            vy: s.effect === "rain" ? -(Math.random() * 5 + 2) : (Math.random() - 0.5) * 8,
            life: Math.random(),
            r: jitter(r) | 0, g: jitter(g) | 0, b: jitter(b) | 0,
            size: s.particleSize,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }
    particlesRef.current = particles;
    tRef.current = 0;
    phaseRef.current = "in";
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    buildParticles(canvas.width, canvas.height);
  }, [text, effect, colorScheme, fontSize, particleSize, buildParticles]);

  useEffect(() => {
    const W = 640, H = 480;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = () => {
      const s = stateRef.current;
      const ctx = canvas.getContext("2d")!;
      const col = COLOR_SCHEMES[s.colorScheme];

      if (!s.playing) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const speedFactor = s.speed / 5;
      tRef.current += 0.016 * speedFactor;

      ctx.fillStyle = `rgba(${col.bg.join(",")},0.2)`;
      ctx.fillRect(0, 0, W, H);

      const particles = particlesRef.current;

      for (const p of particles) {
        const ef = s.effect;

        if (ef === "assemble") {
          p.vx += (p.tx - p.x) * 0.08 * speedFactor;
          p.vy += (p.ty - p.y) * 0.08 * speedFactor;
          p.vx *= 0.75; p.vy *= 0.75;
          p.x += p.vx; p.y += p.vy;

        } else if (ef === "explode") {
          p.x += p.vx * speedFactor;
          p.y += p.vy * speedFactor;
          p.vx *= 0.97; p.vy *= 0.97;
          p.vy += 0.05 * speedFactor;
          p.life -= 0.005 * speedFactor;
          if (p.life < 0) {
            p.x = p.tx; p.y = p.ty;
            p.vx = (Math.random() - 0.5) * 10;
            p.vy = (Math.random() - 0.5) * 10 - 3;
            p.life = 1;
          }

        } else if (ef === "wave") {
          p.x = p.tx + Math.sin(tRef.current * 2 + p.phase) * 15;
          p.y = p.ty + Math.cos(tRef.current * 1.5 + p.phase) * 10;

        } else if (ef === "rain") {
          p.y -= speedFactor * 1.5;
          if (p.y < -10) p.y = H + 10;
          p.x = p.tx + Math.sin(tRef.current * 0.5 + p.phase) * 3;

        } else if (ef === "glitch") {
          const glitchAmt = Math.sin(tRef.current * 8 + p.phase) > 0.7 ? (Math.random() - 0.5) * 40 : 0;
          p.x = p.tx + glitchAmt;
          p.y = p.ty + (Math.random() - 0.5) * (glitchAmt !== 0 ? 8 : 0);
        }

        const alpha = Math.max(0.1, Math.min(1, p.life));
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const W = 640, H = 480;

  return (
    <ToolLayout
      title="Text Effects"
      description="Animierte Pixel-Texteffekte"
      headerRight={
        <>
          <Button size="sm" variant="ghost" data-testid="button-play-pause" onClick={() => setPlaying(p => !p)} className="text-zinc-300">
            {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-reset" onClick={() => { const c = canvasRef.current; if (c) buildParticles(c.width, c.height); }} className="text-zinc-300">
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
        <div className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-zinc-800"
          style={{ background: `rgb(${COLOR_SCHEMES[colorScheme].bg.join(",")})` }}>
          <canvas ref={canvasRef} width={W} height={H} data-testid="canvas-output" className="block max-w-full" />
        </div>

        <div className="flex gap-2 items-center max-w-lg w-full">
          <Input
            data-testid="input-text"
            value={text}
            onChange={e => setText(e.target.value.toUpperCase().slice(0, 12))}
            placeholder="Text eingeben..."
            className="bg-zinc-800 border-zinc-700 text-zinc-100 font-mono"
            maxLength={12}
          />
          <Button
            data-testid="button-apply"
            onClick={() => { const c = canvasRef.current; if (c) buildParticles(c.width, c.height); }}
            className="bg-violet-600 text-white shrink-0"
          >
            <Wand2 className="w-4 h-4 mr-1" />
            Anwenden
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {EFFECTS.map(e => (
            <button key={e.id} data-testid={`button-effect-${e.id}`} onClick={() => setEffect(e.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${effect === e.id ? "bg-violet-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
              {e.name}
            </button>
          ))}
        </div>
      </div>

      {panelOpen && (
        <aside className="w-72 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto">
          <div className="p-5 space-y-6">
            <section>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Farbschema</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_SCHEMES.map((c, i) => (
                  <button key={i} data-testid={`button-colorscheme-${i}`} onClick={() => setColorScheme(i)}
                    className={`py-2 px-3 rounded-md text-xs font-medium transition-all ${colorScheme === i ? "ring-2 ring-violet-500 bg-zinc-800" : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700"}`}
                    style={{ color: `rgb(${c.fg.join(",")})` }}>
                    {c.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Einstellungen</h3>
              {([
                { label: "Schriftgröße", value: fontSize, min: 30, max: 140, step: 5, set: setFontSize, id: "slider-fontsize" },
                { label: "Partikelgröße", value: particleSize, min: 1, max: 6, step: 1, set: setParticleSize, id: "slider-particlesize" },
                { label: "Geschwindigkeit", value: speed, min: 1, max: 15, step: 1, set: setSpeed, id: "slider-speed" },
              ] as { label: string; value: number; min: number; max: number; step: number; set: (v: number) => void; id: string }[]).map(({ label, value, min, max, step, set, id }) => (
                <div key={id} className="space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{label}</span>
                    <span className="font-mono text-zinc-300">{value}</span>
                  </div>
                  <Slider data-testid={id} value={[value]} min={min} max={max} step={step} onValueChange={([v]) => set(v)} />
                </div>
              ))}
            </section>
          </div>
        </aside>
      )}
    </ToolLayout>
  );
}
