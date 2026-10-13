import express from 'express';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import {ChatError,type PlaceChatProvider} from './place-provider.js';
import {cleanMessages,cleanShoppingQuery} from './request-policy.js';
export {GeminiPlaceChat,type PlaceChatProvider} from './place-provider.js';
export function createPlaceChatRouter(provider: PlaceChatProvider) {
  const router=express.Router();let active=0,daily=0,day='';
  router.get('/health',(_req,res)=>res.json({ok:true,configured:provider.configured}));
  router.post('/',rateLimit({windowMs:60_000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'질문이 너무 많아요. 잠시 후 다시 시도해 주세요.'}}),express.json({limit:'3mb'}),async(req,res)=>{
    res.setHeader('cache-control','no-store');
    try {
      if(!provider.configured)throw new ChatError(503,'장소 분석 서비스가 준비 중이에요. 상품 분석은 계속 사용할 수 있습니다.');
      const {image,images,messages:rawMessages,task,target:rawTarget}=req.body||{};
      const messages=cleanMessages(rawMessages),target=rawTarget===undefined?undefined:cleanShoppingQuery(rawTarget);
      if(task!==undefined&&task!=='product'&&task!=='objects'&&task!=='similar')throw new ChatError(400,'지원하지 않는 분석 요청입니다.');
      if(task==='similar'&&(!provider.findSimilarProducts||typeof target!=='string'||!target.trim()))throw new ChatError(400,'찾을 상품을 확인해 주세요.');
      if(images!==undefined&&(!Array.isArray(images)||!images.length||images.length>6||images.some(x=>typeof x!=='string'||x.length>600000||!/^[A-Za-z0-9+/]+={0,2}$/.test(x))||images.reduce((n,x)=>n+x.length,0)>2200000))throw new ChatError(400,'최근 장면이 너무 크거나 형식이 올바르지 않아요.');
      if(rawTarget!==undefined&&(!target||typeof rawTarget!=='string'))throw new ChatError(400,'상품명 형식을 확인해 주세요.');
      if(task==='product'&&!provider.identifyProduct)throw new ChatError(503,'상품 AI 분석을 사용할 수 없어요.');
      if(task==='objects'&&!provider.locateProducts)throw new ChatError(503,'상품 위치 분석을 사용할 수 없어요.');
      if(typeof image!=='string'||image.length>2_800_000||!image.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(image))throw new ChatError(400,'영상 이미지가 필요해요.');
      if(!messages)throw new ChatError(400,'질문 형식을 확인해 주세요. 대화는 사용자부터 시작해야 합니다.');
      const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;daily=0;}
      const max=Number(process.env.PLACE_CHAT_DAILY_LIMIT||500);
      if(daily>=max||active>=2)throw new ChatError(429,'지금 장소 분석 요청이 많아요. 잠시 후 다시 시도해 주세요.');
      let normalized:Buffer;
      try {normalized=await sharp(Buffer.from(image,'base64'),{limitInputPixels:8_000_000,failOn:'error'}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85}).toBuffer();}catch{throw new ChatError(400,'영상 이미지 파일을 읽지 못했어요.');}
      if(active>=2||daily>=max)throw new ChatError(429,'지금 장소 분석 요청이 많아요. 잠시 후 다시 시도해 주세요.');
      const scenes=images?await Promise.all(images.map(async (x:string)=>{try{return await sharp(Buffer.from(x,'base64'),{limitInputPixels:8000000,failOn:'error'}).rotate().resize({width:960,height:960,fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();}catch{throw new ChatError(400,'최근 장면 이미지를 읽지 못했어요.');}})):[];
      if(active>=2)throw new ChatError(429,'잠시 후 다시 시도해 주세요.');
      active++;daily++;
      try {res.json({...await (task==='similar'?provider.findSimilarProducts!(normalized,target!):task==='objects'?provider.locateProducts!(normalized,undefined,scenes):task==='product'?provider.identifyProduct!(normalized,undefined,target||''):provider.reply(normalized,messages,undefined,scenes)),retention:{imageStored:false},disclaimer:task==='product'?'상품명은 사진 기반 AI 추정입니다.':'사진 기반 AI 추정입니다. 동일 상품 여부는 판매 사진으로 확인해 주세요.'});}finally{active--;}
    }catch(error){res.status(error instanceof ChatError?error.status:503).json({message:error instanceof ChatError?error.message:'연결이 지연됐어요. 잠시 후 다시 시도해 주세요.'});}
  });
  router.use((error: unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(400).json({message:'전송할 이미지나 질문이 너무 크거나 형식이 올바르지 않아요.'});});
  return router;
}
