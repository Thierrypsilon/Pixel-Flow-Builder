import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let phase = 0;
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    phase = t;
    ctx.fillStyle = "#060810";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,255,136,0.05)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    // Simulated spectrum bars
    for (let i = 0; i < 30; i++) {
      const v = (Math.sin(i * 0.4 + phase * 1.3) * 0.5 + 0.5) * (Math.sin(i * 0.2 - phase * 0.9) * 0.3 + 0.7);
      const bh2 = v * h * 0.52;
      const hue = 130 + (i / 30) * 50;
      ctx.fillStyle = `hsl(${hue},90%,${40 + v*30}%)`;
      ctx.fillRect(2 + i * (w - 4) / 30, h - bh2 - 2, (w - 4) / 30 - 1, bh2);
    }
    // Waveform
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const tv = (x / w) * 300;
      const sample = (((tv & (tv >> 8)) * Math.sin(phase * 2 + tv * 0.02)) + 1) / 2;
      const y = h * 0.28 - sample * h * 0.22;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
})();

export default drawPreview;
