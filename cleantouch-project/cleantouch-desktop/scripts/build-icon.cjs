const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');

async function main(){
  const root=path.resolve(__dirname,'..');
  const svg=fs.readFileSync(path.join(root,'icon.svg'));
  const sizes=[16,24,32,48,64,128,256];
  const images=await Promise.all(sizes.map(size=>sharp(svg).resize(size,size).png().toBuffer()));
  const header=Buffer.alloc(6+16*images.length);
  header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
  let offset=header.length;
  for(let i=0;i<images.length;i++){
    const at=6+i*16,size=sizes[i],image=images[i];
    header[at]=size===256?0:size;header[at+1]=size===256?0:size;header[at+2]=0;header[at+3]=0;
    header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(image.length,at+8);header.writeUInt32LE(offset,at+12);
    offset+=image.length;
  }
  fs.writeFileSync(path.join(root,'icon.ico'),Buffer.concat([header,...images]));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
