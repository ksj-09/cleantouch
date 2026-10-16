function reconcileMedia(media,scene){
 const matched=Boolean(scene.available&&typeof media.title==='string'&&media.title.length>=4&&scene.title?.includes(media.title));
 const consistent=typeof scene.paused!=='boolean'||typeof media.paused!=='boolean'||scene.paused===media.paused;
 // The platform media clock carries an advancing timestamp. The accessible
 // seek slider is sampled less often and is quantized, so use it only as a
 // fallback when the platform clock is missing or stale.
 if(matched&&consistent&&(media.timelineValid||media.available)&&Number.isFinite(media.seconds)&&media.seconds>=0)return {...media,available:true,matched,estimated:false,paused:scene.paused??media.paused,scene};
 if(matched&&Number.isFinite(scene.progress)&&scene.progress>=0&&scene.progress<=1&&Number.isFinite(media.duration)&&media.duration>0)return {...media,available:true,matched,seconds:scene.progress*media.duration,estimated:true,paused:scene.paused??media.paused,scene};
 return {...media,available:Boolean((media.timelineValid||media.available)&&matched&&consistent),matched,scene};
}
module.exports={reconcileMedia};
