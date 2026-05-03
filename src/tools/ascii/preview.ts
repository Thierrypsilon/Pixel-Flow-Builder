import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  const CHARS = " .:-=+*#%@";
  let t = 0;
  let sc: HTMLCanvasElement | null = null;
  let sx: CanvasRenderingContext2D | null = null;
  return (ctx: CanvasRenderingContext2D, time: number, w: number, h: number) => {
    if (!sc) {
      sc = document.createElement("canvas");
      sc.width = 40; sc.height = 28;
      sx = sc.getContext("2d")!;
    }
    t = time;
    if (!sx) return;
    // Draw mini demo to srcCanvas
    sx.fillStyle = "#000010"; sx.fillRect(0, 0, 40, 28);
    const g = sx.createRadialGradient(20 + Math.sin(t)*8, 14 + Math.cos(t*0.7)*5, 0, 20, 14, 20);
    g.addColorStop(0, `hsl(${t*30%360},90%,70%)`);
    g.addColorStop(0.6, `hsl(${(t*30+120)%360},80%,40%)`);
    g.addColorStop(1, "#000");
    sx.fillStyle = g; sx.fillRect(0, 0, 40, 28);
    const id = sx.getImageData(0, 0, 40, 28);
    // Render ASCII
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    const cw = w / 40, ch = h / 28;
    ctx.font = `${Math.min(cw, ch) * 0.85}px monospace`;
    ctx.textBaseline = "top";
    for (let row = 0; row < 28; row++) {
      for (let col = 0; col < 40; col++) {
        const i = (row * 40 + col) * 4;
        const l = id.data[i] * 0.299 + id.data[i+1] * 0.587 + id.data[i+2] * 0.114;
        const ci = Math.floor((l / 255) * (CHARS.length - 1));
        const ch2 = CHARS[ci];
        if (ch2 === " ") continue;
        ctx.fillStyle = `rgb(${id.data[i]},${id.data[i+1]},${id.data[i+2]})`;
        ctx.fillText(ch2, col * cw, row * ch);
      }
    }
  };
})();

export default drawPreview;
