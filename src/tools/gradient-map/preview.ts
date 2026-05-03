import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (ctx, t, w, h) => {
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w, ny = y / h;
      const v = (Math.sin(nx * 8 + t) * Math.cos(ny * 6 - t * 0.7) + 1) / 2;
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(255 * Math.sin(v * Math.PI));
      img.data[i + 1] = Math.round(255 * Math.sin(v * Math.PI * 0.5 + t * 0.3));
      img.data[i + 2] = Math.round(255 * (1 - v));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
};

export default drawPreview;
