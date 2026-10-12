(()=>{
 const el=id=>document.getElementById(id),list=el('chat-history-list'),drawer=el('chat-history');
 let id='',summary='',contextMessages=[],hooks=null,ready=null,serial=Promise.resolve(),switching=false;
 function report(error){el('chat-memory-status').textContent=String(error?.message||error).replace(/^Error invoking remote method[^:]*:\s*(Error:\s*)?/,'');}
 function entries(){return [...el('chat-messages').children].filter(p=>!p.classList.contains('pending')).map(p=>({role:p.classList.contains('user')?'user':'model',text:[...p.childNodes].filter(n=>n.nodeType===3||n.classList?.contains('chat-answer-text')).map(n=>n.textContent).join(''),failed:p.classList.contains('failed'),image:p.querySelector(':scope > img')?.src?.startsWith('data:image/')?p.querySelector(':scope > img').src.split(',')[1]:'',cards:[...p.querySelectorAll('.chat-shopping-card')].map(c=>JSON.parse(c.dataset.card))}));}
 function record(){const snapshot=hooks?.snapshot();const messages=entries();if(!snapshot||!messages.some(m=>m.role==='user'))return null;
  if(!id)id=crypto.randomUUID();
  const title=summary||cleanTouchChatTitle.fallback(messages);
  contextMessages=cleanTouchConversationContext.merge(contextMessages,messages);
  return {...snapshot,id,title,titleGenerated:Boolean(summary),updatedAt:Date.now(),entries:messages,contextMessages};
 }
 function commit(){const value=record();if(!value||!bridge.saveChat)return Promise.resolve();
  const task=serial.then(()=>bridge.saveChat(value));serial=task.catch(report);task.then(()=>refresh(),()=>{});return serial;
 }
 function newConversation(){id='';summary='';contextMessages=[];el('chat-conversation-title').textContent='새 대화';refresh();}
 async function select(chatId){if(switching)return;switching=true;try{await commit();const saved=await bridge.loadChat(chatId);if(!saved)throw Error('이 대화가 삭제되었어요.');await hooks.restore(saved);id=saved.id;summary=saved.titleGenerated?saved.title:'';contextMessages=cleanTouchConversationContext.clean(saved.contextMessages||saved.entries);el('chat-conversation-title').textContent=saved.title;await hooks.open();await commit();await refresh();}catch(error){report(error);}finally{switching=false;}}
 async function refresh(){if(!bridge.listChats)return;try{const chats=await bridge.listChats();list.replaceChildren();if(!chats.length){const p=document.createElement('p');p.className='chat-history-empty';p.textContent='대화를 시작하면 여기에 저장돼요.';list.append(p);}
  for(const chat of chats){const row=document.createElement('div');row.className='chat-history-row'+(chat.id===id?' selected':'');const b=document.createElement('button');b.className='chat-history-select';b.textContent=chat.title;b.title=chat.title;b.onclick=()=>select(chat.id);const date=document.createElement('small');date.textContent=new Date(chat.updatedAt).toLocaleDateString('ko-KR',{month:'short',day:'numeric'});b.append(date);const remove=document.createElement('button');remove.className='chat-history-delete';remove.textContent='×';remove.title='이 대화 삭제';remove.setAttribute('aria-label',chat.title+' 대화 삭제');remove.onclick=()=>{const confirm=document.createElement('div');confirm.className='chat-delete-confirm';confirm.textContent='이 대화를 삭제할까요?';const yes=document.createElement('button');yes.className='danger';yes.textContent='삭제';yes.onclick=async()=>{try{if(switching)return;switching=true;await serial;await bridge.deleteChat(chat.id);if(id===chat.id){hooks.clear();id='';summary='';contextMessages=[];}await refresh();}catch(error){report(error);}finally{switching=false;}};const cancel=document.createElement('button');cancel.className='secondary';cancel.textContent='취소';cancel.onclick=()=>confirm.remove();confirm.append(yes,cancel);row.append(confirm);};row.append(b,remove);list.append(row);}
  if(id){const active=chats.find(c=>c.id===id);if(active){if(active.titleGenerated&&(!summary||cleanTouchChatTitle.isGeneric(summary)))summary=active.title;el('chat-conversation-title').textContent=active.title;}}el('chat-memory-status').textContent='이 기기에 최근 40개 대화가 저장돼요.';
 }catch(error){report(error);}}
 function toggle(){drawer.hidden=!drawer.hidden;el('chat-history-toggle').setAttribute('aria-expanded',String(!drawer.hidden));if(!drawer.hidden)refresh();}
 el('chat-history-toggle').onclick=toggle;el('chat-history-close').onclick=toggle;el('chat-history-new').onclick=()=>el('chat-reset').click();
 bridge.onChatsChanged?.(()=>{void refresh();});
 window.cleanTouchChatMemory={commit,newConversation,select,refresh,memo(question,limit){return cleanTouchConversationContext.memo(cleanTouchConversationContext.merge(contextMessages,entries()),question,limit);},setSummary(value){summary=value;},get needsSummary(){return !summary||summary==='가벼운 대화';},get currentId(){return id;},attach(next){hooks=next;ready=refresh();return ready;}};
})();
