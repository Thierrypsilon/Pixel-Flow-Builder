import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  const blobs = [
    { x: 0.28, y: 0.42, vx: 0.006, vy: 0.004 },
    { x: 0.72, y: 0.35, vx: -0.005, vy: 0.006 },
    { x: 0.5, y: 0.72, vx: 0.007, vy: -0.005 },
    { x: 0.18, y: 0.65, vx: -0.004, vy: -0.006 },
  ];
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    ctx.fillStyle = "#030a06";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,180,80,0.07)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(0,255,100,0.12)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        ctx.beginPath();
        ctx.moveTo(blobs[i].x * w, blobs[i].y * h);
        ctx.lineTo(blobs[j].x * w, blobs[j].y * h);
        ctx.stroke();
      }
    }
    for (const b of blobs) {
      b.x += b.vx * 0.7; b.y += b.vy * 0.7;
      if (b.x < 0.08 || b.x > 0.92) b.vx *= -1;
      if (b.y < 0.08 || b.y > 0.92) b.vy *= -1;
      const bx = b.x * w, by = b.y * h;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 25);
      grad.addColorStop(0, "rgba(0,255,100,0.45)");
      grad.addColorStop(1, "rgba(0,255,100,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(bx, by, 25, 0, Math.PI * 2); ctx.fill();
      const r = 18 + 3 * Math.sin(t * 3 + blobs.indexOf(b));
      ctx.strokeStyle = "#00ff66";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.stroke();
      const cs = r * 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - cs, by); ctx.lineTo(bx - r * 0.3, by);
      ctx.moveTo(bx + r * 0.3, by); ctx.lineTo(bx + cs, by);
      ctx.moveTo(bx, by - cs); ctx.lineTo(bx, by - r * 0.3);
      ctx.moveTo(bx, by + r * 0.3); ctx.lineTo(bx, by + cs);
      ctx.stroke();
      ctx.fillStyle = "#00ff66";
      ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.fill();
    }
  };
})();

export default drawPreview;
