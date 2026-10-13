const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cleanTouch', {
  authorizeCapture:()=>ipcRenderer.invoke('capture:authorize'),
  revokeCapture:()=>ipcRenderer.invoke('capture:revoke'),
  listChats: () => ipcRenderer.invoke('chats:list'),
  loadChat: id => ipcRenderer.invoke('chats:load',id),
  saveChat: record => ipcRenderer.invoke('chats:save',record),
  deleteChat: id => ipcRenderer.invoke('chats:delete',id),
  onChatsChanged:listener=>{const handler=()=>listener();ipcRenderer.on('chats:changed',handler);return ()=>ipcRenderer.removeListener('chats:changed',handler);},
  chooseImages: kind => ipcRenderer.invoke('images:choose',kind),
  loadImage: id => ipcRenderer.invoke('images:load',id),
  placeChat: payload => ipcRenderer.invoke('place:chat',payload),
  cancelPlaceRequests: group => ipcRenderer.invoke('place:cancel',group),
  identifyProduct: (image,target='',_requestGroup='product') => ipcRenderer.invoke('place:chat',{_requestGroup,task:'product',image,target,messages:[{role:'user',text:'선택한 상품 분석'}]}),
  getLiveToken:sessionHandle=>ipcRenderer.invoke('ai:live-token',sessionHandle),
  getVideoTime: () => ipcRenderer.invoke('video:time'),
  getCaptureGeometry: () => ipcRenderer.invoke('capture:geometry'),
  getUpdate: () => ipcRenderer.invoke('updates:get'),
  checkUpdate: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  deferUpdate: () => ipcRenderer.invoke('updates:defer'),
  updateActivity: busy => ipcRenderer.invoke('updates:activity', busy),
  onUpdate: listener => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('updates:state', handler);
    return () => ipcRenderer.removeListener('updates:state', handler);
  },
  setWindowLayout: layout => ipcRenderer.invoke('window:layout', layout),
  openLink: url => ipcRenderer.invoke('links:open', url),
  copyText: text => ipcRenderer.invoke('clipboard:write', text),
  searchVisual: image => ipcRenderer.invoke('visual:search', image),
});
