import jpeg from 'jpeg-js';

// Positive optical evidence, not a colour-name blacklist. Ordinary pale plastic
// cannot establish emission; uncertain exposure is deliberately left unconfirmed.
export function whiteEmissionEvidence(image:Buffer,box:number[]):boolean {
  try {
    const decoded=jpeg.decode(image,{maxResolutionInMP:8,maxMemoryUsageInMB:64,tolerantDecoding:false});
    if(box.length!==4||!box.every(Number.isFinite))return false;
    const top=box[0]!/1000,left=box[1]!/1000,bottom=box[2]!/1000,right=box[3]!/1000;
    const x0=Math.max(0,Math.floor(left*decoded.width)),y0=Math.max(0,Math.floor(top*decoded.height));
    const x1=Math.min(decoded.width,Math.ceil(right*decoded.width)),y1=Math.min(decoded.height,Math.ceil(bottom*decoded.height));
    const total=(x1-x0)*(y1-y0);if(total<=0)return false;
    let count=0,bright=0,sx=0,sy=0,sxx=0,syy=0,sxy=0,minX=x1,maxX=x0,minY=y1,maxY=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const i=(y*decoded.width+x)*4,r=decoded.data[i]!,g=decoded.data[i+1]!,b=decoded.data[i+2]!;
      const low=Math.min(r,g,b),high=Math.max(r,g,b);
      if(low>=235&&high-low<=25)bright++;
      if(low<248)continue;
      count++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    if(count<Math.max(12,total*.008)||bright/total<.025)return false;
    const xx=sxx/count-(sx/count)**2,yy=syy/count-(sy/count)**2,xy=sxy/count-sx*sy/count**2;
    const d=Math.sqrt((xx-yy)**2+4*xy*xy),major=(xx+yy+d)/2,minor=(xx+yy-d)/2;
    return major/Math.max(1,minor)>=8&&Math.hypot(maxX-minX,maxY-minY)>=Math.max(x1-x0,y1-y0)*.4;
  }catch{return false;}
}

export function colouredEmissionEvidence(image:Buffer,box:number[]):boolean {
  try{
    const d=jpeg.decode(image,{maxResolutionInMP:8,maxMemoryUsageInMB:64,tolerantDecoding:false});
    if(box.length!==4)return false;
    const x0=Math.max(0,Math.floor(box[1]!/1000*d.width)),y0=Math.max(0,Math.floor(box[0]!/1000*d.height));
    const x1=Math.min(d.width,Math.ceil(box[3]!/1000*d.width)),y1=Math.min(d.height,Math.ceil(box[2]!/1000*d.height));
    const total=(x1-x0)*(y1-y0);if(total<=0)return false;
    let n=0,sx=0,sy=0,sxx=0,syy=0,sxy=0,minX=x1,maxX=x0,minY=y1,maxY=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const i=(y*d.width+x)*4,r=d.data[i]!,g=d.data[i+1]!,b=d.data[i+2]!;
      if(Math.max(r,g,b)<210||Math.max(r,g,b)-Math.min(r,g,b)<110)continue;
      n++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    if(n<Math.max(12,total*.025))return false;
    const xx=sxx/n-(sx/n)**2,yy=syy/n-(sy/n)**2,xy=sxy/n-sx*sy/n**2,disc=Math.sqrt((xx-yy)**2+4*xy*xy);
    return ((xx+yy+disc)/2)/Math.max(1,(xx+yy-disc)/2)>=3&&Math.hypot(maxX-minX,maxY-minY)>=Math.max(x1-x0,y1-y0)*.4;
  }catch{return false;}
}
