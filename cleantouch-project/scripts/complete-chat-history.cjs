const fs=require('node:fs');const file='cleantouch-desktop/place-chat.js';let body=fs.readFileSync(file,'utf8');
const old='getHistory:()=>history,onShopping:';
if(!body.includes(old))throw Error('Expected Live hooks missing');
body=body.replace(old,"getHistory:()=>history,getReferenceImage:()=>{const cards=[...log.querySelectorAll('.chat-shopping-card')].map(n=>JSON.parse(n.dataset.card));return cards.at(-1)?.image||'';},onShopping:");
fs.writeFileSync(file,body);
const htmlFile='cleantouch-desktop/index.html';let html=fs.readFileSync(htmlFile,'utf8');html=html.replace('상품명과 장소는 AI의 추정이므로 구매 전 판매 페이지에서 확인하세요.</p>','대화와 선택한 상품 사진은 이 기기에 최근 40개 대화까지 저장되며 대화 목록에서 삭제할 수 있습니다. 상품명과 장소는 AI의 추정이므로 구매 전 판매 페이지에서 확인하세요.</p>');fs.writeFileSync(htmlFile,html);
