import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let prev: ImageData | null = null;
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    ctx.fillStyle=`hsl(${t*20%360},60%,15%)`; ctx.fillRect(0,0,w,h);
    for(let i=0;i<5;i++){
      const x=Math.random()*w, y=Math.random()*h, bw=20+Math.random()*40, bh=8+Math.random()*20;
      const dx=(Math.random()-0.5)*w*0.4, dy=(Math.random()-0.5)*h*0.2;
      if(prev){
        try{ctx.drawImage(ctx.canvas,x,y,bw,bh,x+dx,y+dy,bw,bh);}catch{}
      }
    }
    // RGB shift
    const imgData=ctx.getImageData(0,0,w,h);
    const d=imgData.data;
    const shift=Math.floor(8+Math.sin(t)*5);
    for(let y2=0;y2<h;y2++) for(let x2=shift;x2<w;x2++){
      const i=(y2*w+x2)*4, si=(y2*w+x2-shift)*4;
      d[i]=d[si];
    }
    ctx.putImageData(imgData,0,0);
    prev=imgData;
    // Scanlines
    ctx.fillStyle="rgba(0,0,0,0.15)";
    for(let y3=0;y3<h;y3+=4) ctx.fillRect(0,y3,w,2);
  };
})();

export default drawPreview;
