// Preserve only the conversation visible in the user's supplied screenshot.
// No full desktop screenshot, unrelated browser tabs, or continuous frames are stored.
const path=require('node:path');
const store=require('../cleantouch-desktop/chat-store.cjs').createChatStore(path.join(process.env.APPDATA,'cleantouch-desktop','conversations.json'));
const history=[
 {role:'user',text:'초록색 광선검 보여? 저거 사고싶어'},
 {role:'model',text:'네, 화면 왼쪽에서 초록색 광선검이 보입니다. 사용자가 한 손으로 들고 있네요. 혹시 특정 브랜드나 가격에 대해 알고 싶으신가요?'},
 {role:'user',text:'ㅇㅇ 저거 다 알려줘. 구매사이트까지 보내'},
 {role:'model',text:'해당 영상에서는 초록색 광선검의 정확한 브랜드나 가격, 구매 사이트 정보가 나오지 않네요. 제가 직접 말씀드리기는 어렵습니다. 다른 정보를 찾아봐드릴까요?'}
];
(async()=>{const id='screenshot-green-lightsaber-1791765025691';if(!await store.load(id))await store.save({id,title:'초록색 광선검 구매',updatedAt:1791765025691,source:'screen',image:'',history,entries:history.map(m=>({...m,cards:[],image:''}))});console.log('Preserved the supplied conversation in local chat history.');})().catch(error=>{console.error(error.message);process.exitCode=1;});
