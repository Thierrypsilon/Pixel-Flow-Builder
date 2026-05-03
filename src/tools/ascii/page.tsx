import { useEffect, useRef, useState, useCallback } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Camera, Monitor, Upload, Download } from "lucide-react";

// ─── Character sets ────────────────────────────────────────────────────────────
const CHAR_SETS: Record<string, string> = {
  standard:  " .:-=+*#%@",
  blocks:    " ░▒▓█",
  simple:    " .oO0@",
  binary:    " 1",
  dense:     " .,;!?+*#$%&@",
  minimal:   " ·•",
  retro:     " .+*xX$#@",
  symbols:   " +-|/\\*#@",
};

const CHAR_SET_LABELS: Record<string, string> = {
  standard: "Standard", blocks: "Blöcke", simple: "Einfach",
  binary: "Binär", dense: "Dicht", minimal: "Minimal",
  retro: "Retro", symbols: "Symbole",
};

const FONTS = ["monospace", "Courier New", "Consolas", "Lucida Console"];
const BASE_FONT_SIZE = 9; // px

type SourceMode = "demo" | "image" | "camera";
type ColorMode = "original" | "grayscale" | "green" | "amber" | "white";

const CANVAS_W = 620, CANVAS_H = 440;

// ─── Sobel edge detection ─────────────────────────────────────────────────────
function applySobel(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    luma[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
  }
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = (i: number, j: number) => luma[(y + i) * w + (x + j)];
      const gx = -p(-1,-1) + p(-1,1) - 2*p(0,-1) + 2*p(0,1) - p(1,-1) + p(1,1);
      const gy = -p(-1,-1) - 2*p(-1,0) - p(-1,1) + p(1,-1) + 2*p(1,0) + p(1,1);
      edges[y * w + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return edges;
}

// ─── Demo animation ───────────────────────────────────────────────────────────
function drawDemo(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  ctx.fillStyle = "#000010";
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2 + Math.sin(t * 0.3) * w * 0.15;
  const cy = h / 2 + Math.cos(t * 0.2) * h * 0.1;
  // Concentric gradient rings
  for (let r = 0; r < 5; r++) {
    const radius = (0.1 + r * 0.22 + Math.sin(t * 0.5 + r) * 0.04) * Math.min(w, h);
    const hue = (t * 20 + r * 72) % 360;
    const g = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius);
    g.addColorStop(0, `hsla(${hue},90%,60%,0)`);
    g.addColorStop(0.5, `hsla(${hue},90%,50%,0.35)`);
    g.addColorStop(1, `hsla(${hue},80%,30%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Moving blobs
  const blobs = [
    { ox: 0.25, oy: 0.3, r: 0.22, h: 200 + t * 30 },
    { ox: -0.2, oy: -0.25, r: 0.18, h: 80 + t * 20 },
    { ox: 0.1, oy: 0.4, r: 0.15, h: 300 + t * 40 },
  ];
  for (const b of blobs) {
    const bx = cx + Math.sin(t * 0.4 + b.h) * w * b.ox;
    const by = cy + Math.cos(t * 0.35 + b.h * 0.5) * h * b.oy;
    const gr = ctx.createRadialGradient(bx, by, 0, bx, by, b.r * Math.min(w, h));
    gr.addColorStop(0, `hsla(${b.h % 360},100%,70%,0.7)`);
    gr.addColorStop(1, `hsla(${b.h % 360},80%,40%,0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }
  // Scanlines for texture variety
  for (let y = 0; y < h; y += 6) {
    if (Math.sin(y * 0.3 + t * 1.5) > 0.5) {
      ctx.fillStyle = `rgba(0,0,0,${0.3 + 0.2 * Math.sin(t * 2 + y)})`;
      ctx.fillRect(0, y, w, 3);
    }
  }
}

export default function AsciiPage() {
  const srcRef = useRef<HTMLCanvasElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);
  const demoTRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<SourceMode>("demo");
  const [charSetKey, setCharSetKey] = useState("standard");
  const [customChars, setCustomChars] = useState(" .:-=+*#%@");
  const [useCustom, setUseCustom] = useState(false);
  const [fontFamily, setFontFamily] = useState("monospace");
  const [fontScale, setFontScale] = useState(1.0);
  const [charSpacing, setCharSpacing] = useState(1.0);
  const [lineHeight, setLineHeight] = useState(1.2);
  const [contrast, setContrast] = useState(1.0);
  const [brightness, setBrightness] = useState(0.0);
  const [invert, setInvert] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>("original");
  const [edgeDetect, setEdgeDetect] = useState(false);
  const [bgColor, setBgColor] = useState("#000000");
  const [cameraError, setCameraError] = useState(false);
  const [imageName, setImageName] = useState<string | null>(null);

  const stateRef = useRef({
    source: "demo" as SourceMode, charSetKey: "standard", customChars: " .:-=+*#%@",
    useCustom: false, fontFamily: "monospace", fontScale: 1.0, charSpacing: 1.0,
    lineHeight: 1.2, contrast: 1.0, brightness: 0.0, invert: false,
    colorMode: "original" as ColorMode, edgeDetect: false, bgColor: "#000000",
  });

  useEffect(() => {
    stateRef.current = {
      source, charSetKey, customChars, useCustom, fontFamily, fontScale, charSpacing,
      lineHeight, contrast, brightness, invert, colorMode, edgeDetect, bgColor,
    };
  }, [source, charSetKey, customChars, useCustom, fontFamily, fontScale, charSpacing,
      lineHeight, contrast, brightness, invert, colorMode, edgeDetect, bgColor]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) videoRef.current = document.createElement("video");
      videoRef.current.srcObject = stream;
      videoRef.current.autoplay = true;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      await videoRef.current.play();
    } catch { setCameraError(true); setSource("demo"); }
  }, []);

  useEffect(() => {
    if (source === "camera") startCamera();
    else { stopCamera(); if (source !== "image") setImageName(null); }
  }, [source]);

  const handleImageFile = useCallback((file: File) => {
    setImageName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { imgRef.current = img; setSource("image"); };
    img.src = url;
  }, []);

  useEffect(() => {
    const src = srcRef.current;
    const out = outRef.current;
    if (!src || !out) return;
    const sc = src.getContext("2d", { willReadFrequently: true })!;
    const oc = out.getContext("2d")!;

    const loop = () => {
      const s = stateRef.current;
      const W = CANVAS_W, H = CANVAS_H;

      // Compute char cell dimensions
      const fontSize = BASE_FONT_SIZE * s.fontScale;
      const cellW = fontSize * 0.62 * s.charSpacing;
      const cellH = fontSize * s.lineHeight;
      const cols = Math.max(1, Math.floor(W / cellW));
      const rows = Math.max(1, Math.floor(H / cellH));

      // Draw source into src canvas at cols × rows
      src.width = cols;
      src.height = rows;

      if (s.source === "demo") {
        demoTRef.current += 0.016;
        drawDemo(sc, demoTRef.current, cols, rows);
      } else if (s.source === "camera" && videoRef.current && (videoRef.current.readyState ?? 0) >= 2) {
        sc.drawImage(videoRef.current, 0, 0, cols, rows);
      } else if (s.source === "image" && imgRef.current) {
        sc.drawImage(imgRef.current, 0, 0, cols, rows);
      } else {
        sc.fillStyle = "#111"; sc.fillRect(0, 0, cols, rows);
      }

      const imgData = sc.getImageData(0, 0, cols, rows);
      const d = imgData.data;

      // Apply brightness/contrast to pixel data (for luma computation)
      const brt = s.brightness * 128;
      const con = s.contrast;

      // Compute luma array with adjustments
      const luma = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const p = i * 4;
        let r = d[p], g = d[p + 1], b = d[p + 2];
        // Contrast
        r = Math.min(255, Math.max(0, (r - 128) * con + 128 + brt));
        g = Math.min(255, Math.max(0, (g - 128) * con + 128 + brt));
        b = Math.min(255, Math.max(0, (b - 128) * con + 128 + brt));
        let l = r * 0.299 + g * 0.587 + b * 0.114;
        if (s.invert) l = 255 - l;
        luma[i] = l;
      }

      // Edge detection
      let edgeMap: Float32Array | null = null;
      if (s.edgeDetect) {
        edgeMap = applySobel(d, cols, rows);
      }

      // Character set
      const chars = s.useCustom && s.customChars.length > 0
        ? s.customChars
        : CHAR_SETS[s.charSetKey] ?? CHAR_SETS.standard;

      // Draw output canvas
      oc.fillStyle = s.bgColor;
      oc.fillRect(0, 0, W, H);

      oc.font = `${fontSize}px ${s.fontFamily}`;
      oc.textBaseline = "top";

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          let l = luma[idx];
          if (s.edgeDetect && edgeMap) l = Math.min(255, edgeMap[idx]);

          // Map luma to char
          const charIdx = Math.floor((l / 255) * (chars.length - 1));
          const ch = chars[Math.max(0, Math.min(chars.length - 1, charIdx))];

          const px = col * cellW;
          const py = row * cellH;

          // Color
          const p = idx * 4;
          let cr = d[p], cg = d[p + 1], cb = d[p + 2];
          // Apply adjustments to color too
          const brtAdj = s.brightness * 128;
          cr = Math.min(255, Math.max(0, (cr - 128) * con + 128 + brtAdj));
          cg = Math.min(255, Math.max(0, (cg - 128) * con + 128 + brtAdj));
          cb = Math.min(255, Math.max(0, (cb - 128) * con + 128 + brtAdj));

          switch (s.colorMode) {
            case "original":
              oc.fillStyle = `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
              break;
            case "grayscale": {
              const v = Math.round(l);
              oc.fillStyle = `rgb(${v},${v},${v})`;
              break;
            }
            case "green":
              oc.fillStyle = `rgba(0,${Math.round(80 + l * 0.7)},0,1)`;
              break;
            case "amber":
              oc.fillStyle = `rgba(${Math.round(l * 0.9)},${Math.round(l * 0.55)},0,1)`;
              break;
            case "white":
              oc.fillStyle = `rgba(${Math.round(l)},${Math.round(l)},${Math.round(l)},1)`;
              break;
          }

          if (ch !== " ") oc.fillText(ch, px, py);
        }
      }

      // Resolution info
      oc.fillStyle = "rgba(255,255,255,0.15)";
      oc.font = "9px monospace";
      oc.textBaseline = "bottom";
      oc.fillText(`${cols}×${rows} Zeichen`, 4, H - 2);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); stopCamera(); };
  }, [stopCamera]);

  const handleExport = useCallback(() => {
    const canvas = outRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "ascii-art.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <ToolLayout title="ASCII Kit" description="Echtzeit-Konverter von Bild/Video zu ASCII-Kunst">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        {/* Canvas area */}
        <div className="flex-1 flex flex-col items-start gap-2">
          <canvas ref={srcRef} className="hidden" />
          <canvas
            ref={outRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded font-mono text-xs bg-black"
          />
          {imageName && (
            <p className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-full px-1">
              ▶ {imageName}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="w-full lg:w-64 flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1">

          {/* Source */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quelle</p>
            <div className="grid grid-cols-3 gap-1.5">
              <Button size="sm" variant={source === "demo" ? "default" : "outline"}
                className="gap-1 text-xs" data-testid="button-source-demo"
                onClick={() => setSource("demo")}>
                <Monitor className="w-3 h-3" /> Demo
              </Button>
              <Button size="sm" variant={source === "image" ? "default" : "outline"}
                className="gap-1 text-xs" data-testid="button-source-image"
                onClick={() => imgInputRef.current?.click()}>
                <Upload className="w-3 h-3" /> Bild
              </Button>
              <Button size="sm" variant={source === "camera" ? "default" : "outline"}
                className="gap-1 text-xs" data-testid="button-source-camera"
                onClick={() => setSource("camera")}>
                <Camera className="w-3 h-3" /> Kamera
              </Button>
            </div>
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
            {cameraError && <p className="text-xs text-red-400 mt-1">Kamera nicht verfügbar.</p>}
          </div>

          {/* Character set */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zeichensatz</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.keys(CHAR_SETS).map(key => (
                <Button key={key} size="sm"
                  variant={!useCustom && charSetKey === key ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-charset-${key}`}
                  onClick={() => { setCharSetKey(key); setUseCustom(false); }}>
                  {CHAR_SET_LABELS[key]}
                </Button>
              ))}
            </div>
            <div className="mt-2">
              <Label className="text-xs text-muted-foreground">Eigene Zeichen</Label>
              <div className="flex gap-1 mt-1">
                <Input
                  value={customChars}
                  onChange={e => setCustomChars(e.target.value)}
                  className="text-xs font-mono h-7 flex-1"
                  data-testid="input-custom-chars"
                  placeholder=" .:-=+*#%@"
                />
                <Button size="sm" variant={useCustom ? "default" : "outline"} className="text-xs h-7 px-2"
                  data-testid="button-use-custom"
                  onClick={() => setUseCustom(v => !v)}>
                  {useCustom ? "✓" : "→"}
                </Button>
              </div>
            </div>
          </div>

          {/* Color mode */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Farbe</p>
            <div className="grid grid-cols-3 gap-1">
              {([
                ["original", "Original"],
                ["grayscale", "Graustufen"],
                ["green", "Grün"],
                ["amber", "Amber"],
                ["white", "Weiß"],
              ] as [ColorMode, string][]).map(([mode, label]) => (
                <Button key={mode} size="sm"
                  variant={colorMode === mode ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-color-${mode}`}
                  onClick={() => setColorMode(mode)}>
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Hintergrund</Label>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                data-testid="input-bg-color"
                className="w-8 h-6 rounded cursor-pointer border border-border/50 bg-transparent" />
              <div className="flex gap-1 ml-auto">
                <Button size="sm" variant={bgColor === "#000000" ? "default" : "outline"}
                  className="text-xs h-6 px-2" onClick={() => setBgColor("#000000")}>Schwarz</Button>
                <Button size="sm" variant={bgColor === "#ffffff" ? "default" : "outline"}
                  className="text-xs h-6 px-2" onClick={() => setBgColor("#ffffff")}>Weiß</Button>
              </div>
            </div>
          </div>

          {/* Font */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Schrift</p>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {FONTS.map(f => (
                <Button key={f} size="sm"
                  variant={fontFamily === f ? "default" : "outline"}
                  className="text-xs truncate"
                  data-testid={`button-font-${f.replace(/\s/g,'')}`}
                  style={{ fontFamily: f }}
                  onClick={() => setFontFamily(f)}>
                  {f === "monospace" ? "Monospace" : f.split(" ")[0]}
                </Button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Schriftgröße</Label>
                  <span className="text-xs text-muted-foreground">{fontScale.toFixed(2)}×</span>
                </div>
                <Slider min={0.3} max={3.0} step={0.05} value={[fontScale]}
                  data-testid="slider-font-scale"
                  onValueChange={([v]) => setFontScale(v)} />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Zeichenabstand</Label>
                  <span className="text-xs text-muted-foreground">{charSpacing.toFixed(1)}</span>
                </div>
                <Slider min={0.5} max={2.5} step={0.05} value={[charSpacing]}
                  data-testid="slider-char-spacing"
                  onValueChange={([v]) => setCharSpacing(v)} />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Zeilenhöhe</Label>
                  <span className="text-xs text-muted-foreground">{lineHeight.toFixed(1)}</span>
                </div>
                <Slider min={0.8} max={2.5} step={0.05} value={[lineHeight]}
                  data-testid="slider-line-height"
                  onValueChange={([v]) => setLineHeight(v)} />
              </div>
            </div>
          </div>

          {/* Image adjustments */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bildkorrektur</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Kontrast</Label>
                  <span className="text-xs text-muted-foreground">{contrast.toFixed(1)}</span>
                </div>
                <Slider min={0.0} max={3.0} step={0.05} value={[contrast]}
                  data-testid="slider-contrast"
                  onValueChange={([v]) => setContrast(v)} />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <Label className="text-xs text-muted-foreground">Helligkeit</Label>
                  <span className="text-xs text-muted-foreground">{brightness > 0 ? "+" : ""}{brightness.toFixed(1)}</span>
                </div>
                <Slider min={-1.0} max={1.0} step={0.05} value={[brightness]}
                  data-testid="slider-brightness"
                  onValueChange={([v]) => setBrightness(v)} />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant={invert ? "default" : "outline"} className="flex-1 text-xs"
                data-testid="button-toggle-invert"
                onClick={() => setInvert(v => !v)}>
                Invertiert {invert ? "An" : "Aus"}
              </Button>
              <Button size="sm" variant={edgeDetect ? "default" : "outline"} className="flex-1 text-xs"
                data-testid="button-toggle-edge"
                onClick={() => setEdgeDetect(v => !v)}>
                Kanten {edgeDetect ? "An" : "Aus"}
              </Button>
            </div>
          </div>

          {/* Export */}
          <Button className="gap-2 text-xs" data-testid="button-export" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Als PNG exportieren
          </Button>

        </div>
      </div>
    </ToolLayout>
  );
}
