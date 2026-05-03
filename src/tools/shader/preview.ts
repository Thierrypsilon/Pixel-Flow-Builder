import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    ctx.fillStyle="#050510"; ctx.fillRect(0,0,w,h);
    const imgData = ctx.getImageData(0,0,w,h);
    const d = imgData.data;
    for(let y=0;y<h;y+=2) for(let x=0;x<w;x+=2) {
      const ux=x/w, uy=y/h;
      const v = Math.sin(ux*12+t) + Math.sin(uy*9-t*0.8) + Math.sin((ux+uy)*10+t*1.2) + Math.sin(Math.sqrt(ux*ux+uy*uy)*18-t*2);
      const r=Math.round((Math.sin(v*1.5)+1)/2*255);
      const g2=Math.round((Math.sin(v*1.5+2.094)+1)/2*255);
      const b2=Math.round((Math.sin(v*1.5+4.188)+1)/2*255);
      const i=(y*w+x)*4;
      d[i]=r;d[i+1]=g2;d[i+2]=b2;d[i+3]=255;
      if(x+1<w){d[i+4]=r;d[i+5]=g2;d[i+6]=b2;d[i+7]=255;}
      if(y+1<h){const j=((y+1)*w+x)*4;d[j]=r;d[j+1]=g2;d[j+2]=b2;d[j+3]=255;if(x+1<w){d[j+4]=r;d[j+5]=g2;d[j+6]=b2;d[j+7]=255;}}
    }
    ctx.putImageData(imgData,0,0);
  };
})();

export default drawPreview;
