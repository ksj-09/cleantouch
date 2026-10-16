const fs=require('fs'),path=require('path');const base=path.resolve(__dirname,'../cleantouch-desktop');
let p=path.join(base,'place-chat.js'),s=fs.readFileSync(p,'utf8');
s=s.replace("document.body.classList.remove('widget-mode');ui.widget.hidden=true;await bridge.setWindowLayout('dashboard');","document.body.classList.add('floating-chat');ui.widget.hidden=true;await bridge.setWindowLayout('widget-panel');");
s=s.replace("if(returnWidget){document.body.classList.add('widget-mode');ui.widget.hidden=false;await bridge.setWindowLayout('widget');}","document.body.classList.remove('floating-chat');if(returnWidget){document.body.classList.add('widget-mode');ui.widget.hidden=false;await bridge.setWindowLayout(document.getElementById('widget-results').open?'widget-panel':'widget');}");
fs.writeFileSync(p,s);
p=path.join(base,'renderer.js');s=fs.readFileSync(p,'utf8');
const marker='function renderProducts() {';
const method=`function renderWidgetProducts(){
 const list=byId('widget-product-list');if(!list)return;list.replaceChildren();byId('widget-result-count').textContent=String(found.size);
 for(const product of [...found.values()].reverse()){
  const row=document.createElement('div');row.className='widget-product';const image=document.createElement('img');image.src=product.thumbnail;image.alt=product.label;
  const info=document.createElement('div'),name=document.createElement('strong');name.textContent=product.label;
  const ai=document.createElement('button');ai.textContent='AI 분석 · 구매 찾기';ai.onclick=()=>cleanTouchPlaceChat.identify(product.imageBlob,product.label);image.onclick=ai.onclick;
  const lens=document.createElement('button');lens.textContent='Lens';lens.onclick=async()=>{try{await bridge.searchVisual(new Uint8Array(await product.imageBlob.arrayBuffer()));}catch(error){ui.widgetStatus.textContent=message(error);}};
  info.append(name,ai,lens);row.append(image,info);list.append(row);
 }
 if(!found.size)list.textContent='상품을 찾으면 여기에 나타납니다.';
}
`;
if(!s.includes(marker))throw Error('Missing render entry');s=s.replace(marker,method+marker+'\n  renderWidgetProducts();');fs.writeFileSync(p,s);
fs.appendFileSync(path.join(base,'styles.css'),`\nbody.widget-mode .widget-panel{max-height:100vh;overflow-y:auto;box-sizing:border-box}#widget-results{margin:12px 0;color:#d9f3ef}#widget-results summary{cursor:pointer;padding:8px 0}#widget-product-list{max-height:260px;overflow-y:auto}.widget-product{display:flex;gap:10px;padding:10px 0;border-top:1px solid #37545d}.widget-product img{width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer}.widget-product strong{display:block;font-size:14px}.widget-product button{font-size:12px;padding:7px;margin:5px 5px 0 0}body.floating-chat .place-chat{inset:8px;width:auto;height:auto;box-sizing:border-box}body.floating-chat .widget-panel{display:none}\n`);
