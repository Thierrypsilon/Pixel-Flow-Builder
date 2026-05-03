import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (ctx, t, w, h) => {
  const img = ctx.createImageData(w, h);
  const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (Math.sin(x / 10 + t) + Math.cos(y / 8 - t * 0.7) + 2) / 4;
    const on = v > bayer[y % 4][x % 4] / 16 ? 255 : 0;
    const i = (y * w + x) * 4;
    img.data[i] = on; img.data[i + 1] = on; img.data[i + 2] = on; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
};

export default drawPreview;
