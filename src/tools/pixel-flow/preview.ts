import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (ctx, t, w, h) => {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, w, h);
  const cols = [[255, 60, 120], [60, 180, 255], [120, 255, 80]];
  cols.forEach(([r, g, b], i) => {
    const x = w * (0.2 + 0.6 * ((Math.sin(t * 0.7 + i * 1.3) + 1) / 2));
    const y = h * (0.2 + 0.6 * ((Math.cos(t * 0.5 + i * 0.9) + 1) / 2));
    const grad = ctx.createRadialGradient(x, y, 0, x, y, w * 0.4);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  });
  const block = 5, tmp = ctx.getImageData(0, 0, w, h);
  ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, w, h);
  for (let py = 0; py < h; py += block) {
    for (let px = 0; px < w; px += block) {
      const idx = (Math.min(py + 2, h - 1) * w + Math.min(px + 2, w - 1)) * 4;
      const r = tmp.data[idx], g = tmp.data[idx + 1], b = tmp.data[idx + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const sz = (luma / 255) * (block - 1) * 0.9 + 0.5;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px + (block - sz) / 2, py + (block - sz) / 2, sz, sz);
    }
  }
};

export default drawPreview;
