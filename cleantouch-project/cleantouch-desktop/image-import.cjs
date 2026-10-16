const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const extensions=new Set(['.png','.jpg','.jpeg','.webp','.bmp','.gif']);
function createImageImporter({dialog,nativeImage,getWindow}){
 const files=new Map();
 return {
  async choose(kind){
   if(!['files','folder'].includes(kind))throw Error('가져오기 방식을 확인해 주세요.');
   const result=await dialog.showOpenDialog(getWindow(),{title:kind==='folder'?'분석할 사진 폴더 선택':'분석할 사진 선택',properties:kind==='folder'?['openDirectory']:['openFile','multiSelections'],filters:[{name:'이미지',extensions:[...extensions].map(x=>x.slice(1))}]});
   if(result.canceled)return {canceled:true};
   let paths=result.filePaths;
   if(kind==='folder'){const entries=await fs.readdir(paths[0],{withFileTypes:true});paths=entries.filter(e=>e.isFile()).map(e=>path.join(paths[0],e.name));}
   paths=paths.filter(p=>extensions.has(path.extname(p).toLowerCase())).sort((a,b)=>a.localeCompare(b));
   const truncated=paths.length>100;paths=paths.slice(0,100);const next=new Map(),items=[];
   for(const p of paths){const stat=await fs.stat(p);if(!stat.isFile()||stat.size>12*1024*1024)continue;const id=randomUUID();next.set(id,p);items.push({id,name:path.basename(p)});}
   if(!items.length)throw Error('지원하는 이미지가 없어요. PNG·JPG·WebP·BMP·GIF, 파일당 12MB 이하로 선택해 주세요.');
   files.clear();for(const [id,p] of next)files.set(id,p);
   return {items,truncated};
  },
  async load(id){
   const p=files.get(id);if(!p)throw Error('가져온 사진을 다시 선택해 주세요.');
   const bytes=await fs.readFile(p);if(bytes.length>12*1024*1024)throw Error('사진은 12MB 이하로 선택해 주세요.');
   let image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('사진을 읽지 못했어요. 다른 이미지 파일을 선택해 주세요.');
   const {width,height}=image.getSize();if(width*height>32_000_000)throw Error('사진 해상도가 너무 커요. 크기를 줄여 다시 선택해 주세요.');
   if(Math.max(width,height)>1280){const ratio=1280/Math.max(width,height);image=image.resize({width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio)),quality:'best'});}
   return {name:path.basename(p),image:image.toJPEG(85).toString('base64')};
  }
 };
}
module.exports={createImageImporter};
