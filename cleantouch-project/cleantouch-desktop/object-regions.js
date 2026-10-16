(function(root){
  const area=r=>Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top);
  function overlap(a,b){return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));}
  function sameObject(a,b){
    if(a.category!==b.category)return false;
    const intersection=overlap(a,b),small=Math.min(area(a),area(b));
    const union=area(a)+area(b)-intersection;
    return small>0&&(intersection/union>.5||(intersection/small>=.8&&intersection/union>.2));
  }
  function select(hits){
    // Prefer an uncut full-frame observation to a fragment seen at a tile edge.
    const ranked=hits.slice().sort((a,b)=>Number(Boolean(a.clipped))-Number(Boolean(b.clipped))||Number(Boolean(b.fullFrame))-Number(Boolean(a.fullFrame))||b.score-a.score||area(b)-area(a));
    const kept=[];
    for(const hit of ranked)if(!kept.some(other=>sameObject(hit,other)))kept.push(hit);
    return kept;
  }
  const api={select,sameObject};if(typeof module!=='undefined')module.exports=api;else root.objectRegions=api;
})(globalThis);
