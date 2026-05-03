import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    ctx.fillStyle = "rgba(6,6,14,0.4)";
    ctx.fillRect(0, 0, w, h);
    const numBars = 32;
    const bw2 = (w - 4) / numBars;
    for (let i = 0; i < numBars; i++) {
      const v = (Math.sin(i * 0.3 + t * 2) * 0.5 + 0.5) * (Math.sin(i * 0.15 - t * 1.5) * 0.3 + 0.7);
      const bh3 = v * h * 0.85;
      const hue = (i / numBars) * 100 + 300 + t * 20;
      ctx.fillStyle = `hsl(${hue % 360},90%,${50 + v * 20}%)`;
      ctx.fillRect(2 + i * bw2, h - bh3, bw2 - 1, bh3);
      ctx.globalAlpha = 0.2;
      ctx.fillRect(2 + i * bw2, 0, bw2 - 1, bh3 * 0.3);
      ctx.globalAlpha = 1;
    }
  };
})();

export default drawPreview;
