import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let melt: Uint8ClampedArray | null = null;
  let t = 0;
  let sc: HTMLCanvasElement | null = null;
  let sx: CanvasRenderingContext2D | null = null;
  return (ctx: CanvasRenderingContext2D, time: number, w: number, h: number) => {
    if (!sc) {
      sc = document.createElement("canvas");
      sc.width = 80; sc.height = 56;
      sx = sc.getContext("2d")!;
    }
    if (!sx) return;
    t = time;
    sx.fillStyle = `rgba(4,0,12,0.5)`; sx.fillRect(0,0,80,56);
    const blobs = [
      {fx:0.5+0.4*Math.sin(t*0.3),fy:0.5+0.3*Math.cos(t*0.4),r:30,h:(t*50)%360},
      {fx:0.3+0.25*Math.cos(t*0.5),fy:0.4+0.25*Math.sin(t*0.35),r:20,h:(t*50+120)%360},
      {fx:0.7+0.2*Math.sin(t*0.6),fy:0.6+0.2*Math.cos(t*0.45),r:18,h:(t*50+240)%360},
    ];
    for(const b of blobs){
      const g=sx.createRadialGradient(b.fx*80,b.fy*56,0,b.fx*80,b.fy*56,b.r);
      g.addColorStop(0,`hsla(${b.h},100%,70%,0.9)`); g.addColorStop(1,`hsla(${b.h},80%,30%,0)`);
      sx.fillStyle=g; sx.fillRect(0,0,80,56);
    }
    const id = sx.getImageData(0,0,80,56);
    const c = id.data;
    if(!melt) melt = new Uint8ClampedArray(c);
    const alpha=0.07;
    for(let y2=0;y2<56;y2++) for(let x2=0;x2<80;x2++){
      const i=(y2*80+x2)*4;
      const wx=Math.min(79,Math.max(0,x2+Math.round(Math.sin(y2*0.08+t)*4)));
      const wi=(y2*80+wx)*4;
      melt[i]=melt[wi]*(1-alpha)+c[i]*alpha;
      melt[i+1]=melt[wi+1]*(1-alpha)+c[i+1]*alpha;
      melt[i+2]=melt[wi+2]*(1-alpha)+c[i+2]*alpha;
      melt[i+3]=255;
    }
    ctx.fillStyle="#060012"; ctx.fillRect(0,0,w,h);
    const sw=w/80, sh=h/56;
    for(let y2=0;y2<56;y2++) for(let x2=0;x2<80;x2++){
      const i=(y2*80+x2)*4;
      ctx.fillStyle=`rgb(${melt[i]},${melt[i+1]},${melt[i+2]})`;
      ctx.fillRect(Math.floor(x2*sw), Math.floor(y2*sh), Math.ceil(sw)+1, Math.ceil(sh)+1);
    }
  };
})();

export default drawPreview;
