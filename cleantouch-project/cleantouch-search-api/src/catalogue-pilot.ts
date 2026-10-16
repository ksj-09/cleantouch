import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {CatalogueError,parseCatalogue,createCatalogueIndex} from './catalogue.js';

// Local validation workstation, not an enterprise authentication service.
// No listening socket is created here; the launcher binds only to loopback.
export function createCataloguePilot(html:string,fixture:unknown){
 const app=express();let index:ReturnType<typeof createCatalogueIndex>|null=null;
 const csrf=randomBytes(32).toString('hex');let trustedOrigin='';
 app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{scriptSrc:["'self'",`'nonce-${csrf}'`],styleSrc:["'self'","'unsafe-inline'"],upgradeInsecureRequests:null}}}));
 app.use((req,res,next)=>{
  res.setHeader('cache-control','no-store');
  const address=req.socket.localAddress,host=req.get('host')||'',port=req.socket.localPort;
  if(!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(address||'')||host!==`127.0.0.1:${port}`){res.status(403).json({message:'로컬 검증실 주소로 접속해 주세요.'});return;}
  trustedOrigin=`http://${host}`;next();
 });
 app.get('/',(_req,res)=>res.type('html').send(html.replaceAll('__CSRF__',csrf)));
 app.use('/v1',rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false}),express.json({limit:'5mb'}));
 app.use('/v1',(req,res,next)=>{
  const supplied=req.get('x-pilot-token')||'';
  if(req.get('origin')!==trustedOrigin||!/^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(csrf))){res.status(403).json({message:'검증실 화면에서 실행해 주세요.'});return;}next();
 });
 app.post('/v1/import',(req,res)=>{try{const next=createCatalogueIndex(parseCatalogue(req.body));index=next;res.json(next.summary());}catch(e){res.status(400).json({message:e instanceof CatalogueError?e.message:'카탈로그를 읽지 못했어요.'});}});
 app.post('/v1/fixture',(_req,res)=>{index=createCatalogueIndex(parseCatalogue(fixture));res.json(index.summary());});
 app.post('/v1/lookup',(req,res)=>{if(!index){res.status(409).json({message:'카탈로그를 먼저 불러오세요.'});return;}try{res.json(index.lookup(index.summary().tenantId,req.body));}catch(e){res.status(400).json({message:e instanceof CatalogueError?e.message:'입력을 확인하세요.'});}});
 app.post('/v1/resolve',(req,res)=>{if(!index){res.status(409).json({message:'카탈로그를 먼저 불러오세요.'});return;}try{res.json(index.resolve(index.summary().tenantId,req.body.contentId,req.body.time,req.body.point,req.body.country));}catch(e){res.status(400).json({message:e instanceof CatalogueError?e.message:'영상 위치를 확인하세요.'});}});
 app.post('/v1/sdk',(req,res)=>{if(!index){res.status(409).json({message:'카탈로그를 먼저 불러오세요.'});return;}try{res.json(index.sdkContent(index.summary().tenantId,req.body.contentId,req.body.country));}catch(e){res.status(400).json({message:e instanceof CatalogueError?e.message:'입력을 확인하세요.'});}});
 app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(400).json({message:'JSON 형식 또는 파일 크기(최대 5MB)를 확인하세요.'});});
 return app;
}
