import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  const strokes = [
    { x1:0.15,y1:0.3,x2:0.85,y2:0.3,c:"#ff0000",w:3},
    { x1:0.15,y1:0.5,x2:0.85,y2:0.5,c:"#0000ff",w:3},
    { x1:0.15,y1:0.7,x2:0.85,y2:0.7,c:"#008000",w:3},
  ];
  let prevT = 0;
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    if (t < 0.1 || prevT > t) { ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,w,h); }
    prevT = t;
    ctx.fillStyle="#d4d0c8"; ctx.fillRect(0,0,w,14);
    ctx.fillStyle="#000000"; ctx.font="bold 9px Arial"; ctx.textAlign="left"; ctx.textBaseline="middle";
    ctx.fillText("Paint", 4, 7);
    const prog = Math.min(1, (t % 6)/6);
    for (let i=0;i<3;i++) {
      const s = strokes[i];
      const startF = i/3;
      if (prog < startF) continue;
      const pf = Math.min(1,(prog-startF)/(1/3));
      ctx.strokeStyle=s.c; ctx.lineWidth=s.w; ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(s.x1*w, s.y1*h+14);
      ctx.lineTo(s.x1*w + (s.x2-s.x1)*w*pf, s.y1*h+14);
      ctx.stroke();
    }
    // Color palette strip
    const pal=["#000","#f00","#0f0","#00f","#ff0","#f0f","#0ff","#fff","#888","#f80","#08f","#f08"];
    const cw2=Math.floor((w-4)/pal.length);
    for (let i=0;i<pal.length;i++) {
      ctx.fillStyle=pal[i];
      ctx.fillRect(2+i*cw2, h-12, cw2-1, 10);
    }
  };
})();

export default drawPreview;
