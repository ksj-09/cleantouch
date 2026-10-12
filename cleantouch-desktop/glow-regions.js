(function(root) {
  // Generate extra candidates for narrow glowing props absent from COCO's
  // object classes. The visual classifier still decides what each crop is.
  function findGlowRegions(pixels, width, height) {
    const size=width*height, active=new Uint8Array(size), visited=new Uint8Array(size), queue=new Int32Array(size);
    for(let i=0;i<size;i++) {
      const p=i*4, r=pixels[p],g=pixels[p+1],b=pixels[p+2];
      const high=Math.max(r,g,b),low=Math.min(r,g,b);
      if(pixels[p+3]>128) {
        if(high>=180 && high-low>=95) active[i]=1;
        else if(low>=220) active[i]=2;
      }
    }
    const regions=[];
    for(let seed=0;seed<size;seed++) {
      // Neutral bright walls, captions and window edges are not glowing props.
      // A coloured shaft still includes its surrounding white core via padding.
      if(active[seed]!==1 || visited[seed]) continue;
      let head=0,tail=1,left=width,top=height,right=0,bottom=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
      const colors=[0,0,0,0];
      queue[0]=seed;visited[seed]=1;
      while(head<tail) {
        const i=queue[head++],x=i%width,y=Math.floor(i/width);
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
        const p=i*4,r=pixels[p],g=pixels[p+1],b=pixels[p+2];
        if(r>g*1.35 && b>g*1.35 && Math.min(r,b)>100) colors[0]++;
        else if(r>g*1.35 && r>b*1.2) colors[1]++;
        else if(b>r*1.2 && b>g*1.15) colors[2]++;
        else if(g>r*1.2 && g>b*1.15) colors[3]++;
        for(let ny=Math.max(0,y-1);ny<=Math.min(height-1,y+1);ny++) for(let nx=Math.max(0,x-1);nx<=Math.min(width-1,x+1);nx++) {
          const next=ny*width+nx;if(active[next]===active[seed] && !visited[next]) {visited[next]=1;queue[tail++]=next;}
        }
      }
      const span=Math.hypot(right-left,bottom-top);
      if(tail<12 || tail>size*.08 || span<(active[seed]===1?12:18) || (right-left+1)*(bottom-top+1)>size*.12) continue;
      const xx=sxx/tail-(sx/tail)**2,yy=syy/tail-(sy/tail)**2,xy=sxy/tail-sx*sy/tail**2;
      const discriminant=Math.sqrt((xx-yy)**2+4*xy*xy),major=(xx+yy+discriminant)/2,minor=(xx+yy-discriminant)/2;
      if(major/Math.max(1,minor)<(active[seed]===1?3:8)) continue;
      const padding=Math.max(7,Math.round(span*.12));
      const colorTotal=colors.reduce((a,b)=>a+b,0),winner=colors.indexOf(Math.max(...colors));
      const color=colorTotal>tail*.2 && colors[winner]>colorTotal*.7 ? ['purple','red','blue','green'][winner] : '';
      regions.push({left:Math.max(0,left-padding),top:Math.max(0,top-padding),right:Math.min(width,right+padding+1),bottom:Math.min(height,bottom+padding+1),span,color});
    }
    return regions.sort((a,b)=>b.span-a.span).filter((a,index,list)=>!list.slice(0,index).some(b=>{
      const overlap=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      return overlap/Math.min((a.right-a.left)*(a.bottom-a.top),(b.right-b.left)*(b.bottom-b.top))>.5;
    })).slice(0,12);
  }
  const api={findGlowRegions};if(typeof module!=='undefined')module.exports=api;else root.glowProducts=api;
})(globalThis);
