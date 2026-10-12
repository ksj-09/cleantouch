function protectLogs(streams,logger){
 for(const stream of streams)stream?.on('error',error=>{if(error.code!=='EPIPE')throw error;});
 for(const name of ['log','warn','error','info','debug']){const original=logger[name]?.bind(logger);if(original)logger[name]=(...args)=>{try{return original(...args);}catch(error){if(error.code!=='EPIPE')throw error;}};}
}
module.exports={protectLogs};
