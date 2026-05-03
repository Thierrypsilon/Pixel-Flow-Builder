import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let sweep = 0;
  const blips = Array.from({length:6}, () => ({
    a: Math.random()*Math.PI*2, d: 0.2+Math.random()*0.7, age: Math.random(),
  }));
  return (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => {
    sweep = t * 0.8;
    ctx.fillStyle = "#030d03"; ctx.fillRect(0,0,w,h);
    const cx=w/2, cy=h/2, R=Math.min(w,h)*0.44;
    // Rings
    ctx.strokeStyle = "rgba(0,200,0,0.2)"; ctx.lineWidth=0.8;
    for(let i=1;i<=3;i++){ctx.beginPath();ctx.arc(cx,cy,R*i/3,0,Math.PI*2);ctx.stroke();}
    // Wedge
    for(let i=0;i<16;i++){
      const a0=sweep-(i/16)*Math.PI*0.5;
      ctx.fillStyle=`rgba(0,255,0,${(1-i/16)*0.25})`;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,R,a0-Math.PI/16,a0,false);ctx.closePath();ctx.fill();
    }
    // Blips
    for (const b of blips) {
      b.age=Math.max(0,b.age-0.012);
      const ad=Math.abs(((sweep-b.a)%(Math.PI*2)+Math.PI*2)%(Math.PI*2));
      if(ad<0.08) b.age=1;
      if(b.age<0.05) continue;
      const bx=cx+Math.cos(b.a)*b.d*R, by=cy+Math.sin(b.a)*b.d*R;
      ctx.fillStyle=`rgba(0,255,136,${b.age})`;
      ctx.beginPath();ctx.arc(bx,by,3+b.age*2,0,Math.PI*2);ctx.fill();
    }
    // Sweep line
    ctx.strokeStyle="#00ff00"; ctx.lineWidth=1.5;
    ctx.shadowColor="#00ff00"; ctx.shadowBlur=6;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(sweep)*R,cy+Math.sin(sweep)*R);ctx.stroke();
    ctx.shadowBlur=0;
    ctx.strokeStyle="rgba(0,200,0,0.5)"; ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.stroke();
  };
})();

export default drawPreview;
