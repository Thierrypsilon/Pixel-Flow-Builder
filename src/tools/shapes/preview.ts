import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (ctx, t, w, h) => {
  ctx.fillStyle = "rgba(10,10,10,0.18)";
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) * 0.36, r = R * 0.35, d = r * 0.6;
  ctx.beginPath();
  let first = true;
  for (let angle = 0; angle < Math.PI * 2 * 20; angle += 0.02) {
    const x = cx + (R - r) * Math.cos(angle + t * 0.3) + d * Math.cos((R - r) / r * (angle + t * 0.3));
    const y = cy + (R - r) * Math.sin(angle + t * 0.3) - d * Math.sin((R - r) / r * (angle + t * 0.3));
    if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = `hsl(${(t * 40) % 360},80%,60%)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

export default drawPreview;
