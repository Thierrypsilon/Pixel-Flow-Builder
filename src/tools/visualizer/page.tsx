import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Upload, Mic, MicOff, BarChart2, Radio, Circle, Zap } from "lucide-react";

type VizMode = "bars" | "wave" | "circular" | "particles";
type ColorTheme = "neon" | "fire" | "ice" | "rainbow" | "mono";

const CANVAS_W = 620, CANVAS_H = 400;

const THEMES: Record<ColorTheme, (v: number, i: number, total: number) => string> = {
  neon:    (v, i, n) => `hsl(${120 + (i/n)*120},100%,${40+v*40}%)`,
  fire:    (v, i, n) => `hsl(${(i/n)*60},100%,${30+v*50}%)`,
  ice:     (v, i, n) => `hsl(${190+(i/n)*40},90%,${40+v*40}%)`,
  rainbow: (v, i, n) => `hsl(${(i/n)*360},90%,${40+v*30}%)`,
  mono:    (v)       => `rgba(255,255,255,${0.1+v*0.9})`,
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number; hue: number; size: number; }

export default function VisualizerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  const [mode, setMode] = useState<VizMode>("bars");
  const [theme, setTheme] = useState<ColorTheme>("neon");
  const [sensitivity, setSensitivity] = useState(1.5);
  const [micActive, setMicActive] = useState(false);
  const [hasSource, setHasSource] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [micError, setMicError] = useState(false);

  const stopSource = useCallback(() => {
    try { (sourceRef.current as AudioBufferSourceNode)?.stop?.(); } catch {}
    sourceRef.current?.disconnect();
    sourceRef.current = null;
  }, []);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const ctx = getCtx();
    stopSource();
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(buf);
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.loop = true;
    src.connect(analyserRef.current!);
    src.start();
    sourceRef.current = src;
    setHasSource(true);
    setMicActive(false);
  }, [getCtx, stopSource]);

  const toggleMic = useCallback(async () => {
    if (micActive) {
      stopSource();
      setMicActive(false);
      setHasSource(false);
      return;
    }
    setMicError(false);
    try {
      const ctx = getCtx();
      stopSource();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyserRef.current!);
      sourceRef.current = src as unknown as MediaStreamAudioSourceNode;
      setMicActive(true);
      setHasSource(true);
      setFileName(null);
    } catch {
      setMicError(true);
    }
  }, [micActive, getCtx, stopSource]);

  // Canvas draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let angleOffset = 0;

    const draw = () => {
      const analyser = analyserRef.current;
      const bufLen = analyser?.frequencyBinCount ?? 512;
      const freqData = new Uint8Array(bufLen);
      const timeData = new Uint8Array(bufLen);
      if (analyser) { analyser.getByteFrequencyData(freqData); analyser.getByteTimeDomainData(timeData); }

      ctx.fillStyle = "rgba(6,6,14,0.35)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const themeColor = THEMES[theme];

      if (mode === "bars") {
        const numBars = 128;
        const bw = (CANVAS_W - 4) / numBars;
        for (let i = 0; i < numBars; i++) {
          const v = Math.min(1, (freqData[i] / 255) * sensitivity);
          const bh = v * CANVAS_H * 0.9;
          ctx.fillStyle = themeColor(v, i, numBars);
          ctx.fillRect(2 + i * bw, CANVAS_H - bh, bw - 1, bh);
          // Mirror
          ctx.globalAlpha = 0.25;
          ctx.fillRect(2 + i * bw, 0, bw - 1, bh * 0.4);
          ctx.globalAlpha = 1;
        }

      } else if (mode === "wave") {
        ctx.strokeStyle = themeColor(1, 0, 1);
        ctx.lineWidth = 2.5;
        ctx.shadowColor = themeColor(1, 0, 1);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const sw = CANVAS_W / bufLen;
        for (let i = 0; i < bufLen; i++) {
          const v = (timeData[i] / 128) - 1;
          const x = i * sw;
          const y = CANVAS_H / 2 + v * CANVAS_H * 0.45 * sensitivity;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Second harmonic
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < bufLen; i++) {
          const v = (timeData[i] / 128) - 1;
          const x = i * sw;
          const y = CANVAS_H / 2 + v * CANVAS_H * 0.22 * sensitivity * -1;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

      } else if (mode === "circular") {
        angleOffset += 0.005;
        const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
        const numBars = 256;
        const baseR = Math.min(CANVAS_W, CANVAS_H) * 0.22;

        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2 + angleOffset;
          const v = Math.min(1, (freqData[i % bufLen] / 255) * sensitivity);
          const r1 = baseR;
          const r2 = baseR + v * CANVAS_H * 0.28;
          ctx.strokeStyle = themeColor(v, i, numBars);
          ctx.lineWidth = (CANVAS_W * Math.PI * 2) / numBars * 0.85;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
          ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
          ctx.stroke();
        }
        // Center circle
        const avgV = freqData.slice(0, 32).reduce((a, b) => a + b, 0) / 32 / 255;
        ctx.fillStyle = themeColor(avgV, 0, 1);
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * (0.8 + avgV * 0.4), 0, Math.PI * 2);
        ctx.fill();

      } else if (mode === "particles") {
        const avgEnergy = freqData.slice(0, 64).reduce((a, b) => a + b, 0) / 64 / 255;
        // Spawn particles on beats
        if (avgEnergy > 0.3 * sensitivity && particlesRef.current.length < 400) {
          for (let k = 0; k < Math.floor(avgEnergy * 6); k++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + avgEnergy * 4;
            particlesRef.current.push({
              x: CANVAS_W / 2, y: CANVAS_H / 2,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1, hue: Math.random() * 360,
              size: 2 + avgEnergy * 5,
            });
          }
        }
        // Update and draw particles
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);
        for (const p of particlesRef.current) {
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.97; p.vy *= 0.97;
          p.life -= 0.02;
          ctx.globalAlpha = p.life;
          ctx.fillStyle = `hsl(${p.hue},100%,60%)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Bass ring
        const bassV = freqData.slice(0, 8).reduce((a, b) => a + b, 0) / 8 / 255 * sensitivity;
        ctx.strokeStyle = themeColor(bassV, 0, 1);
        ctx.lineWidth = bassV * 10;
        ctx.globalAlpha = bassV * 0.6;
        ctx.beginPath();
        ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 40 + bassV * 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Idle overlay
      if (!hasSource) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText("🎵  Lade eine Audiodatei oder aktiviere das Mikrofon", CANVAS_W / 2, CANVAS_H / 2);
        ctx.font = "12px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillText("MP3 · WAV · OGG · FLAC", CANVAS_W / 2, CANVAS_H / 2 + 28);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); stopSource(); };
  }, [mode, theme, sensitivity, hasSource, stopSource]);

  const MODE_INFO: { id: VizMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "bars",     label: "Spektrum",  icon: BarChart2 },
    { id: "wave",     label: "Welle",     icon: Radio },
    { id: "circular", label: "Kreis",     icon: Circle },
    { id: "particles",label: "Partikel",  icon: Zap },
  ];
  const THEME_LABELS: Record<ColorTheme, string> = { neon:"Neon", fire:"Feuer", ice:"Eis", rainbow:"Regenbogen", mono:"Mono" };

  return (
    <ToolLayout title="Visualizer" description="Audio-Visualisierung im Winamp-Stil">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex flex-col items-start gap-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded bg-[#06060e] cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          />
          {fileName && <p className="text-xs text-muted-foreground font-mono truncate max-w-full px-1">▶ {fileName}</p>}
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          {/* Input */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quelle</p>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" className="gap-2 text-xs"
                data-testid="button-upload-file"
                onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Audiodatei laden
              </Button>
              <Button size="sm"
                variant={micActive ? "destructive" : "outline"}
                className="gap-2 text-xs"
                data-testid="button-mic"
                onClick={toggleMic}>
                {micActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {micActive ? "Mikrofon aus" : "Mikrofon"}
              </Button>
              {micError && <p className="text-xs text-red-400">Mikrofon nicht verfügbar</p>}
            </div>
          </div>

          {/* Mode */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Modus</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MODE_INFO.map(m => (
                <Button key={m.id} size="sm"
                  variant={mode === m.id ? "default" : "outline"}
                  className="gap-1.5 text-xs"
                  data-testid={`button-mode-${m.id}`}
                  onClick={() => setMode(m.id)}>
                  <m.icon className="w-3 h-3" />{m.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Farbe</p>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(THEMES) as ColorTheme[]).map(t => (
                <Button key={t} size="sm"
                  variant={theme === t ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-theme-${t}`}
                  onClick={() => setTheme(t)}>
                  {THEME_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>

          {/* Sensitivity */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <div className="flex justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empfindlichkeit</Label>
              <span className="text-xs text-muted-foreground">{sensitivity.toFixed(1)}×</span>
            </div>
            <Slider min={0.5} max={4} step={0.1} value={[sensitivity]}
              data-testid="slider-sensitivity"
              onValueChange={([v]) => setSensitivity(v)} />
          </div>

          <p className="text-[10px] text-muted-foreground/40 px-1 leading-snug">
            Unterstützt MP3, WAV, OGG, FLAC. Klicke auf den Canvas um eine Datei zu laden.
          </p>
        </div>
      </div>
    </ToolLayout>
  );
}
