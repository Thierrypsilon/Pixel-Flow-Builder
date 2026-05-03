import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  const stars = Array.from({length:120}, () => ({
    x: Math.random()*200-100, y: Math.random()*150-75, z: Math.random()*200, pz: 0,
  }));
  return (ctx: CanvasRenderingContext2D, _t: number, w: number, h: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0,0,w,h);
    const cx=w/2, cy=h/2, sp=2;
    for (const s of stars) {
      s.pz=s.z; s.z-=sp;
      if (s.z<=0) { s.x=Math.random()*w-cx; s.y=Math.random()*h-cy; s.z=w; s.pz=s.z; }
      const sx=cx+(s.x/s.z)*w, sy=cy+(s.y/s.z)*h;
      const px=cx+(s.x/s.pz)*w, py=cy+(s.y/s.pz)*h;
      const bright=Math.floor((1-s.z/w)*255);
      ctx.strokeStyle=`rgb(${bright},${bright},${bright})`;
      ctx.lineWidth=Math.max(0.5,(1-s.z/w)*2.5);
      ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(sx,sy); ctx.stroke();
    }
  };
})();

export default drawPreview;
