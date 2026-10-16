const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../cleantouch-desktop/place-chat.js');let body=fs.readFileSync(file,'utf8');
function replace(from,to){if(!body.includes(from))throw Error('Expected source missing: '+from.slice(0,80));body=body.replace(from,to);}
replace("for(const place of data.places||[]){const b=document.createElement('button');b.className='chat-map secondary';b.textContent=`${place.name} · 지도에서 확인`;b.title=place.evidence; b.onclick=()=>bridge.openLink(place.mapUrl);item.append(b);}","for(const place of data.places||[])cleanTouchShopping.render(item,{kind:'map',label:place.name,url:place.mapUrl,reason:place.evidence});for(const product of data.products||[])cleanTouchShopping.render(item,{kind:'product',label:product.query,query:product.query,reason:product.reason,image});");
replace("photo.src=imageUrl;photo.alt='분석에 전송하는 영상 장면'","photo.src='data:image/jpeg;base64,'+image;photo.alt='분석에 전송하는 영상 장면'");
replace("photo.src=imageUrl;photo.alt='AI로 분석한 선택 상품'","photo.src='data:image/jpeg;base64,'+image;photo.alt='AI로 분석한 선택 상품'");
replace("if(data.shoppingUrl){const button=document.createElement('button');button.className='chat-map secondary';button.textContent=`${data.query} · 쇼핑 검색`;button.onclick=()=>bridge.openLink(data.shoppingUrl);item.append(button);}","if(data.query)cleanTouchShopping.render(item,{kind:'product',query:data.query,label:data.label,reason:data.reason,image});");
replace("상품명은 AI 추정이며 실제 가격·재고는 판매 페이지에서 확인하세요.';controls();","상품명은 AI 추정이며 실제 가격·재고는 판매 페이지에서 확인하세요.';cleanTouchChatMemory.commit();controls();");
replace("장면이 준비됐어요. 질문을 보내면 AI에 함께 전달됩니다.';controls();input.focus();","장면이 준비됐어요. 질문을 보내면 AI에 함께 전달됩니다.';cleanTouchChatMemory.commit();controls();input.focus();");
// Store the first question too, so closing during a request keeps what the user wrote.
replace("message('user',value);input.value='';reply();","message('user',value);input.value='';cleanTouchChatMemory.commit();reply();");
fs.writeFileSync(file,body);
