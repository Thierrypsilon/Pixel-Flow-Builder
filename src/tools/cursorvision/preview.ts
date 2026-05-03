import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let t2 = 0;
  // Simple arrow cursor drawing
  function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
    const pts: [number,number][] = [[0,0],[0,s*.76],[s*.22,s*.55],[s*.34,s*.88],[s*.5,s*.8],[s*.38,s*.48],[s*.64,s*.48]];
    ctx.strokeStyle="#000"; ctx.lineWidth=Math.max(1,s*.1); ctx.lineJoin="round"; ctx.fillStyle=fill;
    ctx.save(); ctx.translate(x,y);
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
    for(let j=1;j<pts.length;j++) ctx.lineTo(pts[j][0],pts[j][1]);
    ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
  return (ctx: CanvasRenderingContext2D, time: number, w: number, h: number) => {
    t2 = time;
    // Draw demo silhouette downsampled
    const COLS=28, ROWS=20, cw=w/COLS, ch=h/ROWS;
    // Draw silhouette
    ctx.fillStyle="#000"; ctx.fillRect(0,0,w,h);
    // Person silhouette
    const cx2=COLS/2+Math.sin(t2*.4)*COLS*.1;
    const cy2=ROWS/2;
    const bright: boolean[][] = Array.from({length:ROWS},()=>Array(COLS).fill(false));
    function fillEllipse(bx:number,by:number,bw:number,bh:number){
      for(let ry=0;ry<ROWS;ry++) for(let rx=0;rx<COLS;rx++){
        const dx=(rx-bx)/(bw/2), dy=(ry-by)/(bh/2);
        if(dx*dx+dy*dy<=1) bright[ry][rx]=true;
      }
    }
    fillEllipse(cx2,cy2-ROWS*.26,COLS*.11,ROWS*.1); // head
    fillEllipse(cx2,cy2+ROWS*.02,COLS*.09,ROWS*.16); // body
    fillEllipse(cx2-COLS*.14,cy2+ROWS*.06,COLS*.06,ROWS*.12); // L arm
    fillEllipse(cx2+COLS*.14,cy2+ROWS*.06,COLS*.06,ROWS*.12); // R arm
    fillEllipse(cx2-COLS*.06,cy2+ROWS*.2+Math.sin(t2*2)*ROWS*.04,COLS*.05,ROWS*.12); // L leg
    fillEllipse(cx2+COLS*.06,cy2+ROWS*.2-Math.sin(t2*2)*ROWS*.04,COLS*.05,ROWS*.12); // R leg
    for(let ry=0;ry<ROWS;ry++) for(let rx=0;rx<COLS;rx++){
      if(!bright[ry][rx]) continue;
      const sz=cw*.85;
      arrow(ctx,rx*cw+(cw-sz)/2,ry*ch+(ch-sz)/2,sz,"white");
    }
  };
})();

export default drawPreview;
