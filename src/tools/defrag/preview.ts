import type { PreviewDrawFn } from "../types";

const drawPreview: PreviewDrawFn = (() => {
  let grid: Uint8Array | null = null;
  let cols = 0, rows = 0, defragPos = 0, done = false;
  const BS = 5;
  const COLORS2 = ["#ffffff","#99ccff","#cc3333","#0000aa","#ffff00"];
  return (ctx: CanvasRenderingContext2D, _t: number, w: number, h: number) => {
    void defragPos;
    const nc = Math.floor((w-4)/BS), nr = Math.floor((h-20-4)/BS);
    if (!grid || cols !== nc || rows !== nr) {
      cols = nc; rows = nr; defragPos = 0; done = false;
      grid = new Uint8Array(nc * nr);
      const sys = Math.floor(nc*nr*0.15);
      for (let i=0;i<sys;i++) grid[i]=1;
      for (let i=sys;i<nc*nr;i++) grid[i]=Math.random()<0.55 ? 2 : 0;
    }
    if (!done) {
      const moves = 8;
      for (let m=0;m<moves;m++) {
        let ff=-1,frag=-1;
        for (let i=0;i<grid.length;i++) {
          if (grid[i]===0 && ff<0) ff=i;
          if (grid[i]===2 && ff>=0 && ff<i) { frag=i; break; }
        }
        if (ff<0||frag<0) { done=true; break; }
        grid[ff]=3; grid[frag]=0;
      }
    }
    ctx.fillStyle = "#c0c0c0"; ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#808080"; ctx.fillRect(0,h-18,w,18);
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,h-18,w,1);
    const pct = done ? 100 : Math.round((1 - Array.from(grid).filter(c=>c===2).length/(grid.length*0.55))*100);
    const bw = Math.floor((w-4)*Math.min(pct,100)/100);
    ctx.fillStyle="#000080"; ctx.fillRect(2,h-15,bw,11);
    ctx.fillStyle="#000"; ctx.font="9px Arial"; ctx.textAlign="center";
    ctx.textBaseline="middle"; ctx.fillText(pct+"%", w/2, h-9);
    for (let r=0;r<nr;r++) for (let c=0;c<nc;c++) {
      ctx.fillStyle = COLORS2[grid[r*nc+c]];
      ctx.fillRect(2+c*BS, 2+r*BS, BS-1, BS-1);
    }
  };
})();

export default drawPreview;
