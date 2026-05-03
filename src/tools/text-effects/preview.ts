import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let particles: { x: number; y: number; tx: number; ty: number; vx: number; vy: number }[] = [];
  let init = false;
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    if (!init || t < 0.1) {
      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      const tc = tmp.getContext("2d")!;
      tc.fillStyle = "#fff";
      tc.font = `bold ${Math.floor(h * 0.32)}px monospace`;
      tc.textAlign = "center"; tc.textBaseline = "middle";
      tc.fillText("TOOLS", w / 2, h / 2);
      const data = tc.getImageData(0, 0, w, h).data;
      particles = [];
      for (let py = 0; py < h; py += 3) for (let px = 0; px < w; px += 3) {
        if (data[(py * w + px) * 4 + 3] > 128)
          particles.push({ tx: px, ty: py, x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0 });
      }
      init = true;
    }
    ctx.fillStyle = "rgba(10,10,10,0.3)"; ctx.fillRect(0, 0, w, h);
    for (const p of particles) {
      p.vx += (p.tx - p.x) * 0.12; p.vy += (p.ty - p.y) * 0.12;
      p.vx *= 0.7; p.vy *= 0.7; p.x += p.vx; p.y += p.vy;
      ctx.fillStyle = `hsl(${40 + t * 10},90%,60%)`;
      ctx.fillRect(p.x, p.y, 2, 2);
    }
  };
})();

export default drawPreview;
