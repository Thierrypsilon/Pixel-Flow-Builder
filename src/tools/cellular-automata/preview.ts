import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let grid: Uint8Array | null = null, next: Uint8Array | null = null;
  let cols = 0, rows = 0, lastStep = 0;
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    const cs = 4;
    const nc = Math.floor(w / cs), nr = Math.floor(h / cs);
    if (!grid || cols !== nc || rows !== nr) {
      cols = nc; rows = nr;
      grid = new Uint8Array(nc * nr); next = new Uint8Array(nc * nr);
      for (let i = 0; i < nc * nr; i++) grid[i] = Math.random() > 0.65 ? 1 : 0;
    }
    if (t - lastStep > 0.1) {
      for (let y = 0; y < nr; y++) for (let x = 0; x < nc; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          n += grid![((y + dy + nr) % nr) * nc + (x + dx + nc) % nc];
        }
        const alive = grid![y * nc + x];
        next![y * nc + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
      }
      const tmp = grid; grid = next!; next = tmp; lastStep = t;
    }
    ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < nr; y++) for (let x = 0; x < nc; x++) {
      if (grid![y * nc + x]) {
        ctx.fillStyle = `hsl(${(x / nc * 120 + t * 30) % 360},65%,52%)`;
        ctx.fillRect(x * cs, y * cs, cs - 1, cs - 1);
      }
    }
  };
})();

export default drawPreview;
