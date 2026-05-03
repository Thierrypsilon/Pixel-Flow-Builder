import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Play, Pause, RefreshCw, Volume2 } from "lucide-react";

// ─── Preset-Formeln ───────────────────────────────────────────────────────────
const PRESETS = [
  { name: "Classic",      formula: "t>>4|t&t>>5" },
  { name: "Ode to Joy",   formula: "(t*(t>>5|t>>8))>>(t>>16)" },
  { name: "Dubstep",      formula: "(t*9&t>>4|t*5&t>>7|t*3&t/10)>>1" },
  { name: "Techno",       formula: "t*(t>>11&t>>8&123&t>>3)" },
  { name: "Harmony",      formula: "t*(((t>>12)|(t>>8))&63&(t>>4))" },
  { name: "Chaos",        formula: "(t^t%255)-(t>>13&t)" },
  { name: "Melody",       formula: "(t>>10^t>>11)%5*((t>>14&3^t>>15&1)+1)*t%99" },
  { name: "Bach",         formula: "((t>>6)|(t>>8)|(t>>10)|(t>>12))" },
  { name: "Acid",         formula: "(t&t>>8)*(t%16|t>>3)>>5" },
  { name: "Industrial",   formula: "t>>7^t>>4^t>>2" },
];

const SAMPLE_RATE = 8000;
const BUFFER_SECS = 3;
const BUFFER_SIZE = SAMPLE_RATE * BUFFER_SECS;

// ─── Hilfs: Buffer aus Formel bauen ──────────────────────────────────────────
function buildSamples(formula: string, offset: number, speed: number): Float32Array | null {
  try {
    const fn = new Function("t", `"use strict"; return ((${formula}) & 255)`);
    const data = new Float32Array(BUFFER_SIZE);
    for (let i = 0; i < BUFFER_SIZE; i++) {
      const t = Math.floor((i + offset) * speed);
      const raw = fn(t);
      data[i] = (typeof raw === "number" && isFinite(raw) ? raw : 0) / 128 - 1;
    }
    return data;
  } catch {
    return null;
  }
}

// ─── Farb-Palette je Formel ────────────────────────────────────────────────────
const PALETTE_HUES = [145, 200, 280, 30, 60, 0, 330, 170, 240, 310];

export default function ByteBeatPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);
  const offsetRef = useRef(0);

  const [selectedPreset, setSelectedPreset] = useState(0);
  const [formula, setFormula] = useState(PRESETS[0].formula);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [speed, setSpeed] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  const hue = PALETTE_HUES[selectedPreset % PALETTE_HUES.length];

  const stopAudio = useCallback(() => {
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current?.disconnect();
    sourceRef.current = null;
  }, []);

  const startAudio = useCallback((f: string) => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    stopAudio();

    const samples = buildSamples(f, offsetRef.current, speed);
    if (!samples) { setError("Ungültige Formel"); return; }
    setError(null);

    const buffer = ctx.createBuffer(1, BUFFER_SIZE, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const gain = ctx.createGain();
    gain.gain.value = volume;
    gainRef.current = gain;

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    sourceRef.current = source;
    setPlaying(true);
  }, [stopAudio, volume, speed]);

  const handlePlay = useCallback(() => {
    if (playing) { stopAudio(); analyserRef.current = null; setPlaying(false); }
    else startAudio(formula);
  }, [playing, formula, stopAudio, startAudio]);

  useEffect(() => { if (gainRef.current) gainRef.current.gain.value = volume; }, [volume]);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    let t = 0;

    const draw = () => {
      t += 0.016;
      ctx.fillStyle = "#060810";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = `hsla(${hue},80%,50%,0.07)`;
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      const analyser = analyserRef.current;
      if (analyser) {
        const bufLen = analyser.frequencyBinCount;
        const timeData = new Uint8Array(bufLen);
        const freqData = new Uint8Array(bufLen);
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        // Spectrum bars (bottom half)
        const barW = W / 256;
        for (let i = 0; i < 256; i++) {
          const v = freqData[i] / 255;
          const barH = v * (H * 0.52);
          const h2 = (hue + (i / 256) * 60) % 360;
          const brightness = 40 + v * 40;
          ctx.fillStyle = `hsl(${h2},90%,${brightness}%)`;
          ctx.fillRect(i * barW, H - barH - 2, barW - 0.5, barH);
        }

        // Waveform (top half)
        ctx.shadowColor = `hsl(${hue},100%,60%)`;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = `hsl(${hue},100%,65%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const sliceW = W / bufLen;
        for (let i = 0; i < bufLen; i++) {
          const v = timeData[i] / 128.0;
          const x = i * sliceW;
          const y = (H * 0.25) - (v - 1) * (H * 0.22);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Center divider
        ctx.strokeStyle = `hsla(${hue},60%,50%,0.3)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, H * 0.5); ctx.lineTo(W, H * 0.5); ctx.stroke();
        ctx.setLineDash([]);

      } else {
        // Idle animation
        ctx.strokeStyle = `hsl(${hue},80%,50%)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
          const v = Math.sin(x * 0.04 + t * 2) * 0.5 + Math.sin(x * 0.09 - t) * 0.3;
          const y = H * 0.5 + v * H * 0.15;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = `hsl(${hue},70%,60%)`;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("▶ Play drücken", W / 2, H * 0.5 - 32);
        ctx.fillStyle = `hsla(${hue},60%,50%,0.7)`;
        ctx.font = "12px monospace";
        ctx.fillText(formula.length > 48 ? formula.slice(0, 45) + "…" : formula, W / 2, H * 0.5 - 10);
      }

      // Formula label
      ctx.fillStyle = `hsla(${hue},60%,70%,0.4)`;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`f(t) = ${formula.slice(0, 55)}`, 8, H - 8);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); stopAudio(); };
  }, [formula, hue, stopAudio]);

  return (
    <ToolLayout title="ByteBeat" description="Prozeduraler Klang aus mathematischen Formeln">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        {/* Canvas */}
        <div className="flex-1 flex items-start justify-center">
          <canvas
            ref={canvasRef}
            width={620}
            height={380}
            data-testid="canvas-output"
            className="max-w-full rounded bg-[#060810]"
          />
        </div>

        {/* Controls */}
        <div className="w-full lg:w-64 flex flex-col gap-4">
          {/* Play */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <Button
              size="lg"
              variant={playing ? "destructive" : "default"}
              className="w-full gap-2"
              data-testid="button-play"
              onClick={handlePlay}
            >
              {playing ? <><Pause className="w-4 h-4" /> Stop</> : <><Play className="w-4 h-4" /> Play</>}
            </Button>
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          </div>

          {/* Presets */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Presets</p>
            <div className="grid grid-cols-2 gap-1">
              {PRESETS.map((p, i) => (
                <Button
                  key={p.name}
                  size="sm"
                  variant={selectedPreset === i ? "default" : "outline"}
                  className="text-xs h-7"
                  data-testid={`button-preset-${i}`}
                  onClick={() => {
                    setSelectedPreset(i);
                    setFormula(p.formula);
                    if (playing) startAudio(p.formula);
                  }}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom formula */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Formel <span className="text-[10px] normal-case">(nutzt Variable t)</span>
            </Label>
            <textarea
              value={formula}
              onChange={e => setFormula(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (playing) startAudio(formula); }}}
              data-testid="input-formula"
              className="w-full h-16 bg-zinc-900 border border-zinc-700 rounded p-2 text-xs font-mono text-green-400 resize-none focus:outline-none focus:border-green-500"
              placeholder="t>>4|t&t>>5"
              spellCheck={false}
            />
            <Button size="sm" variant="outline" className="w-full mt-1.5 text-xs gap-1.5"
              data-testid="button-apply-formula"
              onClick={() => { if (playing) startAudio(formula); }}>
              <RefreshCw className="w-3 h-3" /> Formel anwenden
            </Button>
          </div>

          {/* Volume & Speed */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-3">
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Lautstärke
                </Label>
                <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
              </div>
              <Slider min={0} max={1} step={0.01} value={[volume]}
                data-testid="slider-volume"
                onValueChange={([v]) => setVolume(v)} />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Geschwindigkeit</Label>
                <span className="text-xs text-muted-foreground">{speed.toFixed(1)}×</span>
              </div>
              <Slider min={0.25} max={4} step={0.25} value={[speed]}
                data-testid="slider-speed"
                onValueChange={([v]) => { setSpeed(v); if (playing) startAudio(formula); }} />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/40 leading-snug px-1">
            ByteBeat: Jeder Sample wird durch <code className="text-green-500/60">f(t) &amp; 255</code> berechnet.
            t ist der Sample-Zeitindex bei 8000Hz.
          </p>
        </div>
      </div>
    </ToolLayout>
  );
}
