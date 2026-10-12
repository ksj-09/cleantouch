(function(root){
  function intersection(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);return {x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};}
  function planCapture(width,height,geometry={}){
    const monitor=geometry.monitor||{x:0,y:0,width,height};
    const validRect=rect=>rect&&['x','y','width','height'].every(key=>Number.isFinite(rect[key]))&&rect.width>0&&rect.height>0;
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||!validRect(monitor))return {blocked:true,reason:'화면 크기를 확인하지 못했어요. 화면 공유를 다시 시작해 주세요.'};
    const linked=Boolean(geometry.scene?.available&&geometry.scene.rect);
    if(geometry.trackVideo&&!linked)return {blocked:true,reason:'영상 위치를 아직 찾지 못했어요. Edge나 Chrome에서 영상을 띄운 채 잠시 기다려 주세요.'};
    if(linked&&!validRect(geometry.scene.rect))return {blocked:true,reason:'영상 영역을 확인하지 못했어요. 영상을 화면에 띄워 주세요.'};
    if(linked&&geometry.scene.occluded)return {blocked:true,reason:'다른 창이 영상을 가리고 있어요. 영상을 화면에 띄워 주세요.'};
    const target=intersection(monitor,linked?geometry.scene.rect:monitor);
    if(target.width<16||target.height<16)return {blocked:true,reason:'영상이 캡처 중인 모니터에 없어요.'};
    if(linked&&(target.width<geometry.scene.rect.width-2||target.height<geometry.scene.rect.height-2))return {blocked:true,reason:'영상이 화면 밖으로 잘렸어요. 영상 전체를 한 화면 안으로 옮겨 주세요.'};
    const rx=width/monitor.width,ry=height/monitor.height;
    const source={x:(target.x-monitor.x)*rx,y:(target.y-monitor.y)*ry,width:target.width*rx,height:target.height*ry};
    const masks=[];
    for(const excluded of geometry.excluded||[]){
      if(!validRect(excluded))continue;
      const overlap=intersection(target,excluded);
      if(!overlap.width||!overlap.height)continue;
      if(linked&&overlap.width>2&&overlap.height>2)return {blocked:true,reason:'위젯이 영상과 겹쳐 있어요. 위젯을 영상 밖으로 옮기면 자동으로 계속합니다.'};
      if(overlap.width*overlap.height/(target.width*target.height)>.25)return {blocked:true,reason:'CleanTouch 창이 영상을 가리고 있어요. 위젯을 영상 밖으로 옮겨 주세요.'};
      masks.push({x:(overlap.x-target.x)*rx,y:(overlap.y-target.y)*ry,width:overlap.width*rx,height:overlap.height*ry});
    }
    return {blocked:false,source,masks,linked,scene:geometry.scene,trackVideo:Boolean(geometry.trackVideo)};
  }
  function drawFrame(ctx,image,plan,width,height){
    const r=plan.source;ctx.drawImage(image,r.x,r.y,r.width,r.height,0,0,width,height);
    ctx.fillStyle='#000';for(const mask of plan.masks)ctx.fillRect(mask.x*width/r.width,mask.y*height/r.height,mask.width*width/r.width,mask.height*height/r.height);
  }
  const api={planCapture,drawFrame};if(typeof module!=='undefined')module.exports=api;else root.sceneCapture=api;
})(globalThis);
