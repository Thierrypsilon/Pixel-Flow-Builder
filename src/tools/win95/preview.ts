import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  const wins = [
    { x: 0.08, y: 0.06, vx: 0.003, vy: 0.002, w: 0.38, h: 0.4 },
    { x: 0.55, y: 0.12, vx: -0.002, vy: 0.003, w: 0.36, h: 0.38 },
    { x: 0.15, y: 0.52, vx: 0.003, vy: -0.002, w: 0.34, h: 0.36 },
  ];
  const C = { gray:"#c0c0c0", white:"#ffffff", dark:"#808080", darker:"#404040",
              navy:"#000080", blue:"#1084d0", black:"#000000", desktop:"#008080" };
  function raisedBorder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = C.white;  ctx.fillRect(x,y,w,1); ctx.fillRect(x,y,1,h);
    ctx.fillStyle = C.darker; ctx.fillRect(x,y+h-1,w,1); ctx.fillRect(x+w-1,y,1,h);
    ctx.fillStyle = "#dfdfdf"; ctx.fillRect(x+1,y+1,w-2,1); ctx.fillRect(x+1,y+1,1,h-2);
    ctx.fillStyle = C.dark;   ctx.fillRect(x+1,y+h-2,w-2,1); ctx.fillRect(x+w-2,y+1,1,h-2);
  }
  return (ctx: CanvasRenderingContext2D, t: number, cw: number, ch: number) => {
    ctx.fillStyle = C.desktop; ctx.fillRect(0, 0, cw, ch - 22);
    const tbH = 22;
    ctx.fillStyle = C.gray; ctx.fillRect(0, ch - tbH, cw, tbH);
    ctx.fillStyle = C.white; ctx.fillRect(0, ch - tbH, cw, 1);
    ctx.fillStyle = C.gray; ctx.fillRect(3, ch - tbH + 3, 48, tbH - 6); raisedBorder(ctx, 3, ch - tbH + 3, 48, tbH - 6);
    ctx.fillStyle = C.black; ctx.font = "bold 9px Arial"; ctx.textAlign = "center";
    ctx.textBaseline = "middle"; ctx.fillText("▶ Start", 27, ch - tbH / 2);
    const now = new Date();
    const ts = now.toLocaleTimeString("de-DE", {hour:"2-digit",minute:"2-digit"});
    ctx.fillStyle = C.dark; ctx.fillRect(cw-54, ch-tbH+3, 50, tbH-6);
    ctx.fillStyle = C.gray; ctx.fillRect(cw-53, ch-tbH+4, 48, tbH-8);
    ctx.fillStyle = C.black; ctx.font = "9px Arial"; ctx.fillText(ts, cw-29, ch-tbH/2);
    for (const b of wins) {
      b.x += b.vx * 0.5; b.y += b.vy * 0.5;
      if (b.x < 0.01 || b.x + b.w > 0.99) b.vx *= -1;
      if (b.y < 0.01 || b.y + b.h > 0.88) b.vy *= -1;
      const wx = b.x * cw, wy = b.y * ch, ww = b.w * cw, wh = b.h * ch;
      ctx.fillStyle = C.gray; ctx.fillRect(wx, wy, ww, wh);
      raisedBorder(ctx, wx, wy, ww, wh);
      const g = ctx.createLinearGradient(wx+2, 0, wx+ww-50, 0);
      g.addColorStop(0, C.navy); g.addColorStop(1, C.blue);
      ctx.fillStyle = g; ctx.fillRect(wx+2, wy+2, ww-4, 14);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 9px Arial"; ctx.textAlign = "left";
      ctx.textBaseline = "middle"; ctx.fillText("Video Fenster", wx+5, wy+9);
      ctx.fillStyle = C.gray;
      ctx.fillRect(wx+ww-18, wy+3, 14, 12); raisedBorder(ctx, wx+ww-18, wy+3, 14, 12);
      ctx.fillStyle = C.black; ctx.font = "bold 8px Arial"; ctx.textAlign = "center";
      ctx.fillText("✕", wx+ww-11, wy+9);
      const contentHues = [200, 280, 20];
      const ci = wins.indexOf(b);
      const cx = wx+2, cy = wy+16, cw2 = ww-4, ch2 = wh-18;
      ctx.fillStyle = C.dark; ctx.fillRect(cx, cy, cw2, 1); ctx.fillRect(cx, cy, 1, ch2);
      ctx.fillStyle = C.white; ctx.fillRect(cx, cy+ch2-1, cw2, 1); ctx.fillRect(cx+cw2-1, cy, 1, ch2);
      ctx.fillStyle = `hsl(${contentHues[ci]},40%,12%)`;
      ctx.fillRect(cx+1, cy+1, cw2-2, ch2-2);
      const blob1x = cx + (cw2/2) + (cw2/3)*Math.sin(t*0.9+ci);
      const blob1y = cy + (ch2/2) + (ch2/3)*Math.cos(t*0.7+ci);
      const gr = ctx.createRadialGradient(blob1x, blob1y, 0, blob1x, blob1y, Math.min(cw2,ch2)*0.3);
      gr.addColorStop(0, `hsla(${contentHues[ci]},80%,55%,0.9)`);
      gr.addColorStop(1, `hsla(${contentHues[ci]},80%,40%,0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(blob1x, blob1y, Math.min(cw2,ch2)*0.3, 0, Math.PI*2); ctx.fill();
    }
  };
})();

export default drawPreview;
