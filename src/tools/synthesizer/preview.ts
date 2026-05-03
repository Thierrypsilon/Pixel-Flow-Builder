import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, w, h);
    // Waveform
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#7c3aed";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const v = Math.sin(x * 0.07 + t * 3) * 0.4 + Math.sin(x * 0.14 + t * 5) * 0.2 + Math.sin(x * 0.21 - t * 2) * 0.15;
      const y = h * 0.38 + v * h * 0.28;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Piano keys
    const keyY = h * 0.62;
    const keyH = h * 0.34;
    const numWhite = 14;
    const kw2 = (w - 4) / numWhite;
    const blackPos = [1,2,4,5,6,8,9,11,12,13];
    // White keys
    for (let i = 0; i < numWhite; i++) {
      const pressed = (i === 0 || i === 7) && Math.sin(t * 2) > 0.6;
      ctx.fillStyle = pressed ? "#c8b8f0" : "#f8f4ec";
      ctx.fillRect(2 + i * kw2, keyY, kw2 - 1, keyH);
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(2 + i * kw2, keyY, kw2 - 1, keyH);
    }
    // Black keys
    const bw2 = kw2 * 0.65;
    const bh2 = keyH * 0.62;
    for (let i = 0; i < blackPos.length; i++) {
      const bp = blackPos[i];
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(2 + (bp - 0.35) * kw2, keyY, bw2, bh2);
    }
  };
})();

export default drawPreview;
