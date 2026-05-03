import { useEffect, useRef, useState } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";

// ─── Blip ────────────────────────────────────────────────────────────────────
interface Blip {
  id: number;
  angle: number;   // radians from center
  dist: number;    // 0..1 (normalized radius)
  age: number;     // 0..1 (1=fresh, 0=gone)
  size: number;
}

let blipId = 0;

type ColorTheme = "green" | "amber" | "blue";
const THEMES: Record<ColorTheme, { bg: string; grid: string; sweep: string; blip: string; glow: string }> = {
  green: { bg: "#030d03", grid: "rgba(0,200,0,0.18)", sweep: "#00ff00", blip: "#00ff88", glow: "#00ff00" },
  amber: { bg: "#0d0800", grid: "rgba(220,140,0,0.18)", sweep: "#ffaa00", blip: "#ffcc44", glow: "#ffaa00" },
  blue:  { bg: "#01050f", grid: "rgba(0,140,220,0.18)", sweep: "#00aaff", blip: "#44ddff", glow: "#00aaff" },
};

const CANVAS_W = 620, CANVAS_H = 440;

export default function RadarPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const persistRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const sweepRef = useRef(0);
  const blipsRef = useRef<Blip[]>([]);
  const stateRef = useRef({ speed: 1.0, blipCount: 12, theme: "green" as ColorTheme, noise: true });

  const [speed, setSpeed] = useState(1.0);
  const [blipCount, setBlipCount] = useState(12);
  const [theme, setTheme] = useState<ColorTheme>("green");
  const [noise, setNoise] = useState(true);

  useEffect(() => { stateRef.current = { speed, blipCount, theme, noise }; }, [speed, blipCount, theme, noise]);

  // Generate random blips
  const generateBlips = (count: number) => {
    blipsRef.current = Array.from({ length: count }, () => ({
      id: blipId++,
      angle: Math.random() * Math.PI * 2,
      dist: 0.15 + Math.random() * 0.8,
      age: 0,
      size: 2 + Math.random() * 4,
    }));
  };

  useEffect(() => { generateBlips(blipCount); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = CANVAS_W, H = CANVAS_H;
    const CX = W / 2, CY = H / 2;
    const MAXR = Math.min(W, H) / 2 - 10;

    // Persistent phosphor canvas
    const persist = document.createElement("canvas");
    persist.width = W; persist.height = H;
    persistRef.current = persist;
    const pCtx = persist.getContext("2d")!;

    const draw = () => {
      const s = stateRef.current;
      const blips = blipsRef.current;
      const t = THEMES[s.theme];

      // Advance sweep
      sweepRef.current += 0.012 * s.speed;

      // Fade persistent layer
      pCtx.fillStyle = `${t.bg}22`;
      pCtx.fillRect(0, 0, W, H);

      // Update blip ages (fade old ones)
      for (const b of blips) {
        const angleDiff = Math.abs(((sweepRef.current - b.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
        if (angleDiff < 0.06) {
          b.age = 1.0; // refresh when swept
        } else {
          b.age = Math.max(0, b.age - 0.004 * s.speed);
        }
      }

      // Draw blips on persistent canvas (they persist and fade)
      for (const b of blips) {
        if (b.age < 0.05) continue;
        const bx = CX + Math.cos(b.angle) * b.dist * MAXR;
        const by = CY + Math.sin(b.angle) * b.dist * MAXR;

        // Glow
        const gGrad = pCtx.createRadialGradient(bx, by, 0, bx, by, b.size * 6);
        gGrad.addColorStop(0, `${t.glow}${Math.round(b.age * 0.6 * 255).toString(16).padStart(2,'0')}`);
        gGrad.addColorStop(1, `${t.glow}00`);
        pCtx.fillStyle = gGrad;
        pCtx.beginPath();
        pCtx.arc(bx, by, b.size * 6, 0, Math.PI * 2);
        pCtx.fill();

        // Core dot
        pCtx.fillStyle = t.blip + Math.round(b.age * 255).toString(16).padStart(2, '0');
        pCtx.beginPath();
        pCtx.arc(bx, by, b.size, 0, Math.PI * 2);
        pCtx.fill();
      }

      // ── Main canvas ──
      ctx.fillStyle = t.bg;
      ctx.fillRect(0, 0, W, H);

      // Paste persistent layer
      ctx.drawImage(persist, 0, 0);

      // Outer vignette circle
      const vignette = ctx.createRadialGradient(CX, CY, MAXR * 0.7, CX, CY, MAXR + 20);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = vignette;
      ctx.beginPath();
      ctx.arc(CX, CY, MAXR + 20, 0, Math.PI * 2);
      ctx.fill();

      // Concentric rings
      ctx.strokeStyle = t.grid;
      ctx.lineWidth = 0.8;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(CX, CY, MAXR * (i / 4), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.strokeStyle = t.grid;
      ctx.lineWidth = 0.5;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(CX + Math.cos(a) * MAXR, CY + Math.sin(a) * MAXR);
        ctx.stroke();
      }

      // Clip to radar circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(CX, CY, MAXR, 0, Math.PI * 2);
      ctx.clip();

      // Sweep gradient (wedge)
      const sweepAngle = sweepRef.current;
      const wedgeLen = Math.PI * 0.45;
      for (let i = 0; i < 24; i++) {
        const a0 = sweepAngle - (i / 24) * wedgeLen;
        const alpha = (1 - i / 24) * 0.35;
        ctx.fillStyle = `${t.sweep}${Math.round(alpha * 255).toString(16).padStart(2,'0')}`;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.arc(CX, CY, MAXR, a0 - Math.PI / 24, a0, false);
        ctx.closePath();
        ctx.fill();
      }

      // Sweep line tip
      ctx.strokeStyle = t.sweep;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = t.glow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + Math.cos(sweepAngle) * MAXR, CY + Math.sin(sweepAngle) * MAXR);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();

      // Outer ring border
      ctx.strokeStyle = t.sweep + "80";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CX, CY, MAXR, 0, Math.PI * 2);
      ctx.stroke();

      // Screen noise
      if (s.noise) {
        const noiseData = ctx.getImageData(0, 0, W, H);
        const d = noiseData.data;
        for (let i = 0; i < d.length; i += 16) {
          const v = (Math.random() - 0.5) * 6;
          d[i] = Math.max(0, Math.min(255, d[i] + v));
          d[i+1] = Math.max(0, Math.min(255, d[i+1] + v));
          d[i+2] = Math.max(0, Math.min(255, d[i+2] + v));
        }
        ctx.putImageData(noiseData, 0, 0);
      }

      // Scan line overlay
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      for (let y = 0; y < H; y += 3) {
        ctx.fillRect(0, y, W, 1);
      }

      // Labels
      ctx.fillStyle = t.sweep + "88";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      for (let r = 1; r <= 4; r++) {
        ctx.fillText(`${r * 25}`, CX + 3, CY - MAXR * (r / 4) + 10);
      }
      ctx.font = "10px monospace";
      ctx.fillStyle = t.blip + "aa";
      ctx.textAlign = "left";
      ctx.fillText(`SWEEP ${(sweepRef.current * 180 / Math.PI % 360).toFixed(0)}°`, 10, 22);
      ctx.fillText(`ZIELE ${blips.filter(b => b.age > 0.1).length}`, 10, 36);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <ToolLayout title="Radar" description="Retro-Sonar mit phosphoreszierender Anzeige">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex items-start justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded"
          />
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          {/* Theme */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Farbe</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["green", "amber", "blue"] as ColorTheme[]).map(th => (
                <Button key={th} size="sm"
                  variant={theme === th ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-theme-${th}`}
                  onClick={() => setTheme(th)}>
                  {th === "green" ? "Grün" : th === "amber" ? "Amber" : "Blau"}
                </Button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parameter</p>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Sweep-Geschwindigkeit</Label>
                <span className="text-xs text-muted-foreground">{speed.toFixed(1)}×</span>
              </div>
              <Slider min={0.1} max={5} step={0.1} value={[speed]}
                data-testid="slider-speed"
                onValueChange={([v]) => setSpeed(v)} />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Anzahl Ziele</Label>
                <span className="text-xs text-muted-foreground">{blipCount}</span>
              </div>
              <Slider min={1} max={40} step={1} value={[blipCount]}
                data-testid="slider-blip-count"
                onValueChange={([v]) => { setBlipCount(v); generateBlips(v); }} />
            </div>
          </div>

          {/* Options */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Optionen</p>
            <Button size="sm" variant={noise ? "default" : "outline"} className="w-full text-xs mb-2"
              data-testid="button-toggle-noise"
              onClick={() => setNoise(n => !n)}>
              Rauschen {noise ? "An" : "Aus"}
            </Button>
            <Button size="sm" variant="outline" className="w-full gap-2 text-xs"
              data-testid="button-reset"
              onClick={() => { sweepRef.current = 0; generateBlips(blipCount); }}>
              <RefreshCw className="w-3 h-3" /> Neu
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground/40 px-1 leading-snug">
            Klassische Sonar/Radar-Darstellung mit phosphoreszierendem Nachleuchten.
          </p>
        </div>
      </div>
    </ToolLayout>
  );
}
