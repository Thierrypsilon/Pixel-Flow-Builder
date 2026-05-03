import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RefreshCw, Plus } from "lucide-react";

// ─── Bubble ───────────────────────────────────────────────────────────────────
interface Bubble {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  hue: number;
  sat: number;
  alpha: number;
}

let _id = 0;
function makeBubble(x: number, y: number, r: number): Bubble {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.5 + Math.random() * 2;
  return {
    id: _id++,
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 1.5,
    r,
    hue: Math.random() * 360,
    sat: 70 + Math.random() * 30,
    alpha: 0.75 + Math.random() * 0.2,
  };
}

const CANVAS_W = 620, CANVAS_H = 440;

export default function BubblesPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const rafRef = useRef<number>(0);
  const stateRef = useRef({ gravity: 0.06, damping: 0.85, maxCount: 80, popSmall: true });

  const [gravity, setGravity] = useState(0.06);
  const [damping, setDamping] = useState(0.85);
  const [maxCount, setMaxCount] = useState(80);

  useEffect(() => { stateRef.current = { gravity, damping, maxCount, popSmall: true }; }, [gravity, damping, maxCount]);

  const spawnBurst = useCallback((cx: number, cy: number, count = 6) => {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      if (bubblesRef.current.length >= s.maxCount) break;
      const r = 12 + Math.random() * 40;
      const offsetX = (Math.random() - 0.5) * 40;
      const offsetY = (Math.random() - 0.5) * 40;
      bubblesRef.current.push(makeBubble(cx + offsetX, cy + offsetY, r));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = CANVAS_W, H = CANVAS_H;

    // Start with some bubbles
    for (let i = 0; i < 12; i++) {
      bubblesRef.current.push(makeBubble(
        50 + Math.random() * (W - 100),
        H / 2 + Math.random() * H * 0.3,
        14 + Math.random() * 50
      ));
    }

    const draw = () => {
      const s = stateRef.current;
      const bs = bubblesRef.current;

      // Background
      ctx.fillStyle = "#0a0a18";
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = "rgba(100,100,255,0.04)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Update physics
      for (const b of bs) {
        b.vy += s.gravity;
        b.x += b.vx;
        b.y += b.vy;

        // Wall bounce
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * s.damping; }
        if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * s.damping; }
        if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * s.damping; }
        if (b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * s.damping; b.vx *= 0.98; }

        b.vx *= 0.999;
      }

      // Bubble-bubble soft repulsion
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const dx = bs[j].x - bs[i].x, dy = bs[j].y - bs[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = bs[i].r + bs[j].r;
          if (dist < minDist && dist > 0.01) {
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            bs[i].x -= nx * overlap; bs[i].y -= ny * overlap;
            bs[j].x += nx * overlap; bs[j].y += ny * overlap;
            const relVx = bs[j].vx - bs[i].vx, relVy = bs[j].vy - bs[i].vy;
            const dot = relVx * nx + relVy * ny;
            if (dot < 0) {
              const restitution = 0.5;
              const impulse = -dot * restitution;
              bs[i].vx -= impulse * nx; bs[i].vy -= impulse * ny;
              bs[j].vx += impulse * nx; bs[j].vy += impulse * ny;
            }
          }
        }
      }

      // Draw bubbles (back to front by radius)
      const sorted = [...bs].sort((a, b) => b.r - a.r);
      for (const b of sorted) {
        const { x, y, r, hue, sat, alpha } = b;

        // Glow
        const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.5);
        glow.addColorStop(0, `hsla(${hue},${sat}%,60%,0.06)`);
        glow.addColorStop(1, `hsla(${hue},${sat}%,50%,0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Bubble body
        const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
        grad.addColorStop(0, `hsla(${hue},${sat}%,90%,${alpha * 0.6})`);
        grad.addColorStop(0.4, `hsla(${hue},${sat}%,55%,${alpha * 0.8})`);
        grad.addColorStop(1, `hsla(${hue},${sat}%,30%,${alpha})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Rim
        ctx.strokeStyle = `hsla(${hue},${sat}%,80%,0.5)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Specular highlight
        const hiGrad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x - r * 0.35, y - r * 0.4, r * 0.45);
        hiGrad.addColorStop(0, "rgba(255,255,255,0.65)");
        hiGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = hiGrad;
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Small bottom reflection
        const refGrad = ctx.createRadialGradient(x + r * 0.2, y + r * 0.6, 0, x + r * 0.2, y + r * 0.6, r * 0.2);
        refGrad.addColorStop(0, "rgba(255,255,255,0.2)");
        refGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = refGrad;
        ctx.beginPath();
        ctx.arc(x + r * 0.2, y + r * 0.6, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bubble count
      ctx.fillStyle = "rgba(100,100,200,0.4)";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${bs.length} Blasen`, 8, H - 8);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); bubblesRef.current = []; };
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const cy = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    spawnBurst(cx, cy, 4);
  }, [spawnBurst]);

  return (
    <ToolLayout title="Bubbles" description="Interaktive Physik-Blasen-Simulation">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex flex-col items-start gap-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded bg-[#0a0a18] cursor-crosshair select-none"
            onClick={handleCanvasClick}
          />
          <p className="text-[10px] text-muted-foreground/40 px-1">Klicken zum Erzeugen neuer Blasen</p>
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Physik</p>

            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Schwerkraft</Label>
                <span className="text-xs text-muted-foreground">{gravity.toFixed(2)}</span>
              </div>
              <Slider min={-0.1} max={0.3} step={0.005} value={[gravity]}
                data-testid="slider-gravity"
                onValueChange={([v]) => setGravity(v)} />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Dämpfung</Label>
                <span className="text-xs text-muted-foreground">{damping.toFixed(2)}</span>
              </div>
              <Slider min={0.3} max={1.0} step={0.01} value={[damping]}
                data-testid="slider-damping"
                onValueChange={([v]) => setDamping(v)} />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Max. Blasen</Label>
                <span className="text-xs text-muted-foreground">{maxCount}</span>
              </div>
              <Slider min={10} max={200} step={5} value={[maxCount]}
                data-testid="slider-max-count"
                onValueChange={([v]) => setMaxCount(v)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button size="sm" variant="outline" className="gap-2 text-xs"
              data-testid="button-spawn"
              onClick={() => spawnBurst(CANVAS_W / 2, CANVAS_H / 2, 10)}>
              <Plus className="w-3.5 h-3.5" /> 10 Blasen hinzufügen
            </Button>

            <Button size="sm" variant="outline" className="gap-2 text-xs"
              data-testid="button-reset"
              onClick={() => { bubblesRef.current = []; }}>
              <RefreshCw className="w-3.5 h-3.5" /> Alle entfernen
            </Button>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Schnellstart</p>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: "Schweben", g: -0.02, d: 0.9 },
                { label: "Normal",  g: 0.06,  d: 0.85 },
                { label: "Regen",   g: 0.15,  d: 0.6 },
              ].map(p => (
                <Button key={p.label} size="sm" variant="outline" className="text-xs"
                  data-testid={`button-preset-${p.label.toLowerCase()}`}
                  onClick={() => { setGravity(p.g); setDamping(p.d); }}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
