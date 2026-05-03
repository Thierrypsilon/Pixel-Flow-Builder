import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  const bs = Array.from({length: 8}, (_, i) => ({
    x: 0.1 + (i % 4) * 0.25, y: 0.3 + Math.floor(i/4) * 0.4,
    vx: (Math.random()-0.5)*0.006, vy: (Math.random()-0.5)*0.006,
    r: 0.06 + Math.random()*0.07, hue: i * 45,
  }));
  return (ctx: CanvasRenderingContext2D, _t: number, w: number, h: number) => {
    ctx.fillStyle = "#0a0a18"; ctx.fillRect(0,0,w,h);
    for (const b of bs) {
      b.x += b.vx; b.y += b.vy;
      if (b.x - b.r < 0 || b.x + b.r > 1) b.vx *= -1;
      if (b.y - b.r < 0 || b.y + b.r > 1) b.vy *= -1;
      const cx = b.x * w, cy = b.y * h, r = b.r * Math.min(w,h);
      const g = ctx.createRadialGradient(cx - r*0.3, cy - r*0.35, r*0.05, cx, cy, r);
      g.addColorStop(0, `hsla(${b.hue},80%,88%,0.7)`);
      g.addColorStop(0.4, `hsla(${b.hue},80%,55%,0.8)`);
      g.addColorStop(1, `hsla(${b.hue},80%,30%,0.9)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = `hsla(${b.hue},80%,80%,0.5)`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      const hg = ctx.createRadialGradient(cx-r*0.35,cy-r*0.4,0,cx-r*0.35,cy-r*0.4,r*0.4);
      hg.addColorStop(0,"rgba(255,255,255,0.7)"); hg.addColorStop(1,"rgba(255,255,255,0)");
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(cx-r*0.35,cy-r*0.4,r*0.4,0,Math.PI*2); ctx.fill();
    }
  };
})();

export default drawPreview;
