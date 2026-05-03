import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// ─── Piano-Noten (C3 – B4, 2 Oktaven) ────────────────────────────────────────
const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function noteFreq(note: number, octave: number) {
  return 440 * Math.pow(2, (note + (octave - 4) * 12 - 9) / 12);
}
// 24 Tasten: C3..B4
const KEYS: { note: number; octave: number; name: string; sharp: boolean; kbd: string }[] = [];
const KBD_MAP: Record<string, number> = {
  a:0, w:1, s:2, e:3, d:4, f:5, t:6, g:7, y:8, h:9, u:10, j:11,
  k:12, o:13, l:14, p:15,
};
for (let oct = 3; oct <= 4; oct++) {
  for (let n = 0; n < 12; n++) {
    const idx = (oct - 3) * 12 + n;
    const kbdKey = Object.entries(KBD_MAP).find(([,v]) => v === idx)?.[0] ?? "";
    KEYS.push({ note: n, octave: oct, name: NOTE_NAMES[n] + oct, sharp: NOTE_NAMES[n].includes("#"), kbd: kbdKey });
  }
}

type Waveform = "sine" | "square" | "sawtooth" | "triangle";
const WAVEFORMS: Waveform[] = ["sine", "square", "sawtooth", "triangle"];
const WAVE_LABELS: Record<Waveform, string> = { sine: "Sinus", square: "Rechteck", sawtooth: "Sägezahn", triangle: "Dreieck" };

// ─── Canvas Keyboard layout ────────────────────────────────────────────────────
const WHITE_NOTES = [0,2,4,5,7,9,11]; // C D E F G A B
const CANVAS_W = 620, CANVAS_H = 360;
const KEY_AREA_H = 160;
const VIS_H = CANVAS_H - KEY_AREA_H;

function getWhiteKeys() {
  const whites: { keyIdx: number; x: number; w: number }[] = [];
  const totalWhite = 2 * 7; // 2 octaves × 7 white notes
  const kw = (CANVAS_W - 4) / totalWhite;
  let wi = 0;
  for (let i = 0; i < KEYS.length; i++) {
    if (!KEYS[i].sharp) {
      whites.push({ keyIdx: i, x: 2 + wi * kw, w: kw - 1 });
      wi++;
    }
  }
  return { whites, kw };
}
function getBlackKeys(kw: number) {
  const blacks: { keyIdx: number; x: number; w: number }[] = [];
  const bw = kw * 0.65;
  let wi = 0;
  for (let i = 0; i < KEYS.length; i++) {
    if (!KEYS[i].sharp) { wi++; }
    else {
      blacks.push({ keyIdx: i, x: 2 + (wi - 1) * kw + kw - bw / 2, w: bw });
    }
  }
  return blacks;
}

export default function SynthesizerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeNotes = useRef<Map<number, { osc: OscillatorNode; gain: GainNode }>>(new Map());
  const rafRef = useRef<number>(0);

  const [waveform, setWaveform] = useState<Waveform>("sawtooth");
  const [volume, setVolume] = useState(0.5);
  const [attack, setAttack] = useState(0.02);
  const [release, setRelease] = useState(0.3);
  const [reverb, setReverb] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());

  const reverbNodeRef = useRef<ConvolverNode | null>(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      analyser.connect(ctx.destination);

      // Simple reverb via convolver
      const convolver = ctx.createConvolver();
      const rate = ctx.sampleRate;
      const len = rate * 1.5;
      const impulse = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = impulse.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
      convolver.buffer = impulse;
      reverbNodeRef.current = convolver;
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const playNote = useCallback((keyIdx: number) => {
    if (activeNotes.current.has(keyIdx)) return;
    const ctx = getCtx();
    const { note, octave } = KEYS[keyIdx];
    const freq = noteFreq(note, octave);

    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);

    const dest = analyserRef.current!;
    if (reverb && reverbNodeRef.current) {
      const dry = ctx.createGain(); dry.gain.value = 0.7;
      const wet = ctx.createGain(); wet.gain.value = 0.4;
      osc.connect(gain);
      gain.connect(dry); dry.connect(dest);
      gain.connect(reverbNodeRef.current); reverbNodeRef.current.connect(wet); wet.connect(dest);
    } else {
      osc.connect(gain); gain.connect(dest);
    }
    osc.start();
    activeNotes.current.set(keyIdx, { osc, gain });
    setPressedKeys(prev => new Set([...prev, keyIdx]));
  }, [waveform, volume, attack, reverb, getCtx]);

  const releaseNote = useCallback((keyIdx: number) => {
    const node = activeNotes.current.get(keyIdx);
    if (!node) return;
    const ctx = audioCtxRef.current!;
    node.gain.gain.setValueAtTime(node.gain.gain.value, ctx.currentTime);
    node.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + release);
    node.osc.stop(ctx.currentTime + release + 0.05);
    activeNotes.current.delete(keyIdx);
    setPressedKeys(prev => { const s = new Set(prev); s.delete(keyIdx); return s; });
  }, [release]);

  // Keyboard events
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const idx = KBD_MAP[e.key.toLowerCase()];
      if (idx !== undefined) playNote(idx);
    };
    const up = (e: KeyboardEvent) => {
      const idx = KBD_MAP[e.key.toLowerCase()];
      if (idx !== undefined) releaseNote(idx);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [playNote, releaseNote]);

  // Mouse on canvas
  const getPressedKey = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    if (my < VIS_H) return -1;
    const ky = my - VIS_H;
    const { whites, kw } = getWhiteKeys();
    const blacks = getBlackKeys(kw);
    const bh = KEY_AREA_H * 0.62;
    // Check black keys first
    for (const bk of blacks) {
      if (mx >= bk.x && mx <= bk.x + bk.w && ky <= bh) return bk.keyIdx;
    }
    // Then white keys
    for (const wk of whites) {
      if (mx >= wk.x && mx <= wk.x + wk.w) return wk.keyIdx;
    }
    return -1;
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { whites, kw } = getWhiteKeys();
    const blacks = getBlackKeys(kw);
    const bh = KEY_AREA_H * 0.62;

    const draw = () => {
      // Visualiser area
      ctx.fillStyle = "#0a0a14";
      ctx.fillRect(0, 0, CANVAS_W, VIS_H);

      const analyser = analyserRef.current;
      if (analyser && activeNotes.current.size > 0) {
        const bufLen = analyser.frequencyBinCount;
        const timeData = new Uint8Array(bufLen);
        const freqData = new Uint8Array(bufLen);
        analyser.getByteTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        // Spectrum
        const bw = CANVAS_W / 128;
        for (let i = 0; i < 128; i++) {
          const v = freqData[i] / 255;
          const bH = v * VIS_H * 0.9;
          ctx.fillStyle = `hsl(${200 + v * 120},90%,${40 + v * 30}%)`;
          ctx.fillRect(i * bw, VIS_H - bH, bw - 0.5, bH);
        }

        // Waveform
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#8b5cf6";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const sw = CANVAS_W / bufLen;
        for (let i = 0; i < bufLen; i++) {
          const v = (timeData[i] / 128) - 1;
          const x = i * sw, y = VIS_H / 2 + v * VIS_H * 0.4;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Idle: keyboard hint
        ctx.fillStyle = "rgba(100,100,160,0.4)";
        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Klicke Tasten oder nutze QWERTY Tastatur", CANVAS_W / 2, VIS_H / 2 - 10);
        ctx.font = "11px monospace";
        ctx.fillStyle = "rgba(100,100,160,0.25)";
        ctx.fillText("A W S E D F T G Y H U J K O L P", CANVAS_W / 2, VIS_H / 2 + 12);
      }

      // Piano keyboard
      ctx.fillStyle = "#e8e0d0";
      ctx.fillRect(0, VIS_H, CANVAS_W, KEY_AREA_H);

      // White keys
      for (const wk of whites) {
        const pressed = pressedKeys.has(wk.keyIdx);
        ctx.fillStyle = pressed ? "#c8b8f0" : "#f8f4ec";
        ctx.fillRect(wk.x, VIS_H, wk.w, KEY_AREA_H - 2);
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(wk.x, VIS_H, wk.w, KEY_AREA_H - 2);
        // Note name
        ctx.fillStyle = pressed ? "#5b21b6" : "#888";
        ctx.font = "8px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(KEYS[wk.keyIdx].name, wk.x + wk.w / 2, VIS_H + KEY_AREA_H - 4);
        // Kbd shortcut
        if (KEYS[wk.keyIdx].kbd) {
          ctx.fillStyle = pressed ? "#7c3aed" : "#aaa";
          ctx.font = "bold 9px Arial";
          ctx.fillText(KEYS[wk.keyIdx].kbd.toUpperCase(), wk.x + wk.w / 2, VIS_H + KEY_AREA_H - 14);
        }
      }
      // Black keys
      for (const bk of blacks) {
        const pressed = pressedKeys.has(bk.keyIdx);
        ctx.fillStyle = pressed ? "#7c3aed" : "#1a1a2e";
        ctx.fillRect(bk.x, VIS_H, bk.w, bh);
        if (KEYS[bk.keyIdx].kbd) {
          ctx.fillStyle = pressed ? "#e9d5ff" : "#666";
          ctx.font = "bold 8px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(KEYS[bk.keyIdx].kbd.toUpperCase(), bk.x + bk.w / 2, VIS_H + bh - 4);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pressedKeys]);

  return (
    <ToolLayout title="Synthesizer" description="Piano-Synthesizer mit Web Audio API">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex flex-col gap-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded cursor-pointer select-none"
            onMouseDown={e => { const k = getPressedKey(e); if (k >= 0) playNote(k); }}
            onMouseUp={e => { const k = getPressedKey(e); if (k >= 0) releaseNote(k); }}
            onMouseLeave={() => { activeNotes.current.forEach((_, k) => releaseNote(k)); }}
          />
          <p className="text-[10px] text-muted-foreground/50 text-center">
            Maus-Klick auf Tasten · Tastatur: A W S E D F T G Y H U J K O L P
          </p>
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          {/* Waveform */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Wellenform</p>
            <div className="grid grid-cols-2 gap-1.5">
              {WAVEFORMS.map(w => (
                <Button key={w} size="sm" variant={waveform === w ? "default" : "outline"}
                  className="text-xs" data-testid={`button-wave-${w}`}
                  onClick={() => setWaveform(w)}>
                  {WAVE_LABELS[w]}
                </Button>
              ))}
            </div>
          </div>

          {/* ADSR + Volume */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hüllkurve</p>
            <div>
              <div className="flex justify-between mb-1"><Label className="text-xs text-muted-foreground">Lautstärke</Label>
                <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span></div>
              <Slider min={0} max={1} step={0.01} value={[volume]}
                data-testid="slider-volume" onValueChange={([v]) => setVolume(v)} />
            </div>
            <div>
              <div className="flex justify-between mb-1"><Label className="text-xs text-muted-foreground">Attack</Label>
                <span className="text-xs text-muted-foreground">{(attack * 1000).toFixed(0)}ms</span></div>
              <Slider min={0.001} max={0.5} step={0.001} value={[attack]}
                data-testid="slider-attack" onValueChange={([v]) => setAttack(v)} />
            </div>
            <div>
              <div className="flex justify-between mb-1"><Label className="text-xs text-muted-foreground">Release</Label>
                <span className="text-xs text-muted-foreground">{(release * 1000).toFixed(0)}ms</span></div>
              <Slider min={0.01} max={2} step={0.01} value={[release]}
                data-testid="slider-release" onValueChange={([v]) => setRelease(v)} />
            </div>
          </div>

          {/* Reverb */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reverb</Label>
              <Switch checked={reverb} onCheckedChange={setReverb}
                data-testid="switch-reverb" />
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Shortcuts</p>
            <div className="font-mono text-[10px] text-muted-foreground/60 space-y-0.5">
              <p>Weiß: A S D F G H J K L</p>
              <p>Schwarz: W E T Y U O P</p>
              <p>2 Oktaven: C3–B4</p>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
