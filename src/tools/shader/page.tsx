import { useEffect, useRef, useState } from "react";
import { ToolLayout } from "@/components/tool-layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

// ─── GLSL Shaders ─────────────────────────────────────────────────────────────
const VERT = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const SHADERS: Record<string, string> = {
  plasma: `
    precision mediump float;
    uniform float time; uniform vec2 resolution; uniform float param;
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution;
      float s = param * 0.5 + 0.5;
      float v = sin(uv.x * 12.0 * s + time) + sin(uv.y * 9.0 * s - time * 0.8)
              + sin((uv.x + uv.y) * 10.0 * s + time * 1.2)
              + sin(sqrt(dot(uv, uv)) * 18.0 * s - time * 2.0);
      vec3 col = 0.5 + 0.5 * cos(v * 1.5 + vec3(0.0, 2.094, 4.188) + time * 0.3);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  mandelbrot: `
    precision mediump float;
    uniform float time; uniform vec2 resolution; uniform float param;
    void main() {
      vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / min(resolution.x, resolution.y) * 3.2;
      float zoom = pow(2.0, sin(time * 0.12) * 2.0);
      uv /= zoom;
      uv += vec2(-0.7269, 0.1889);
      vec2 z = vec2(0.0), c = uv;
      float iter = 0.0;
      for (int i = 0; i < 80; i++) {
        if (dot(z,z) > 4.0) break;
        z = vec2(z.x*z.x - z.y*z.y + c.x, 2.0*z.x*z.y + c.y);
        iter++;
      }
      float t = iter / 80.0;
      vec3 col = iter >= 80.0 ? vec3(0.0) : 0.5 + 0.5 * cos(t * 8.0 + time * 0.4 + vec3(0.0, 2.0, 4.5));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  voronoi: `
    precision mediump float;
    uniform float time; uniform vec2 resolution; uniform float param;
    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p) * 43758.5453);
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution * (4.0 + param * 4.0);
      vec2 i = floor(uv), f = fract(uv);
      float minD = 10.0; vec2 minCell = vec2(0.0);
      for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
        vec2 nb = vec2(float(x), float(y));
        vec2 pt = 0.5 + 0.5 * sin(time * 0.4 + 6.28 * hash(i + nb));
        float d = length(nb + pt - f);
        if (d < minD) { minD = d; minCell = i + nb; }
      }
      float edge = smoothstep(0.04, 0.07, minD);
      vec3 base = 0.5 + 0.5 * sin(vec3(hash(minCell).x * 6.0 + time * 0.2,
                                       hash(minCell).y * 6.0 + time * 0.3,
                                       (hash(minCell).x + hash(minCell).y) * 3.0 - time * 0.15));
      gl_FragColor = vec4(base * edge, 1.0);
    }
  `,
  fire: `
    precision mediump float;
    uniform float time; uniform vec2 resolution; uniform float param;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                 mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      return noise(p) * 0.5 + noise(p * 2.0 + vec2(1.3, 2.7)) * 0.25
           + noise(p * 4.0 + vec2(5.1, 1.3)) * 0.125;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution;
      float h = 1.0 - uv.y;
      float n = fbm(vec2(uv.x * 3.0 + time * 0.3, h * 3.0 - time * 1.8)) * (0.5 + param * 0.5);
      float fire = smoothstep(0.0, 1.0, (n - h * 0.7 + 0.15) * 3.0);
      float flicker = fbm(vec2(uv.x * 8.0, time * 4.0)) * 0.1;
      fire = clamp(fire + flicker, 0.0, 1.0);
      vec3 col = vec3(0.0);
      col = mix(col, vec3(0.8, 0.1, 0.0), smoothstep(0.0, 0.3, fire));
      col = mix(col, vec3(1.0, 0.4, 0.0), smoothstep(0.2, 0.6, fire));
      col = mix(col, vec3(1.0, 0.9, 0.0), smoothstep(0.5, 0.9, fire));
      col = mix(col, vec3(1.0, 1.0, 1.0), smoothstep(0.85, 1.0, fire));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  tunnel: `
    precision mediump float;
    uniform float time; uniform vec2 resolution; uniform float param;
    void main() {
      vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / resolution.y;
      uv.x += sin(time * 0.2) * 0.3; uv.y += cos(time * 0.15) * 0.2;
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      float depth = 0.4 / (r + 0.001);
      float t = depth + time * (0.5 + param * 0.5);
      float s = a / 3.14159;
      vec3 col = 0.5 + 0.5 * cos(t * 4.0 + vec3(0.0, 2.094, 4.188) + s * 3.0);
      col *= 0.6 + 0.4 * sin(t * 12.0);
      col *= smoothstep(1.5, 0.05, r);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
  acid: `
    precision mediump float;
    uniform float time; uniform vec2 resolution; uniform float param;
    void main() {
      vec2 uv = (gl_FragCoord.xy / resolution) * 2.0 - 1.0;
      uv.x *= resolution.x / resolution.y;
      float t = time * (0.3 + param * 0.5);
      vec2 z = uv;
      for (int i = 0; i < 6; i++) {
        z = vec2(z.x*z.x - z.y*z.y + cos(t + float(i)), 2.0*z.x*z.y + sin(t*0.7 + float(i)));
        z = fract(z) * 2.0 - 1.0;
      }
      float v = length(z);
      vec3 col = 0.5 + 0.5 * sin(vec3(v * 5.0, v * 7.0 + 2.094, v * 3.0 + 4.188) + t);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const PRESET_LABELS: Record<string, string> = {
  plasma: "Plasma", mandelbrot: "Mandelbrot", voronoi: "Voronoi",
  fire: "Feuer", tunnel: "Tunnel", acid: "Acid",
};

const CANVAS_W = 620, CANVAS_H = 440;

// ─── WebGL helpers ─────────────────────────────────────────────────────────────
function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("Shader compile error:", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function createProgram(gl: WebGLRenderingContext, frag: string) {
  const vs = createShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("Link error"); return null; }
  return prog;
}

export default function ShaderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const progRef = useRef<WebGLProgram | null>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef(performance.now());

  const [preset, setPreset] = useState<string>("plasma");
  const [param, setParam] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);
  const paramRef = useRef(0.5);
  const speedRef = useRef(1.0);
  const timeAccRef = useRef(0);
  const lastTimestampRef = useRef(0);

  useEffect(() => { paramRef.current = param; }, [param]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl) return;
    glRef.current = gl;

    const prog = createProgram(gl, SHADERS[preset]);
    if (!prog) return;
    progRef.current = prog;

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    gl.viewport(0, 0, CANVAS_W, CANVAS_H);
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "time");
    const uRes  = gl.getUniformLocation(prog, "resolution");
    const uParam = gl.getUniformLocation(prog, "param");
    gl.uniform2f(uRes, CANVAS_W, CANVAS_H);

    timeAccRef.current = 0;
    lastTimestampRef.current = performance.now();

    const render = (ts: number) => {
      const dt = (ts - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = ts;
      timeAccRef.current += dt * speedRef.current;

      gl.uniform1f(uTime, timeAccRef.current);
      gl.uniform1f(uParam!, paramRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(prog);
    };
  }, [preset]);

  return (
    <ToolLayout title="Shader Player" description="Echtzeit GLSL Fragment-Shader">
      <div className="flex flex-col lg:flex-row gap-4 w-full p-4">
        <div className="flex-1 flex items-start justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            data-testid="canvas-output"
            className="max-w-full rounded bg-black"
          />
        </div>

        <div className="w-full lg:w-60 flex flex-col gap-4">
          {/* Presets */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Shader</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.keys(SHADERS).map(key => (
                <Button key={key} size="sm"
                  variant={preset === key ? "default" : "outline"}
                  className="text-xs"
                  data-testid={`button-shader-${key}`}
                  onClick={() => setPreset(key)}>
                  {PRESET_LABELS[key]}
                </Button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parameter</p>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Geschwindigkeit</Label>
                <span className="text-xs text-muted-foreground">{speed.toFixed(1)}×</span>
              </div>
              <Slider min={0.0} max={5} step={0.1} value={[speed]}
                data-testid="slider-speed"
                onValueChange={([v]) => setSpeed(v)} />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <Label className="text-xs text-muted-foreground">Parameter</Label>
                <span className="text-xs text-muted-foreground">{param.toFixed(2)}</span>
              </div>
              <Slider min={0} max={1} step={0.01} value={[param]}
                data-testid="slider-param"
                onValueChange={([v]) => setParam(v)} />
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Info</p>
            <div className="text-[10px] text-muted-foreground/60 leading-snug space-y-1">
              <p><span className="text-muted-foreground font-mono">{preset}.glsl</span></p>
              <p>WebGL 1.0 · GLSL ES 1.0</p>
              <p>Canvas: {CANVAS_W}×{CANVAS_H}px</p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/40 px-1 leading-snug">
            Echtzeit Fragment-Shader direkt im Browser via WebGL. Alle Berechnungen auf der GPU.
          </p>
        </div>
      </div>
    </ToolLayout>
  );
}
