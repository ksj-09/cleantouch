package kr.cleantouch.scan.search

import android.content.Intent
import android.graphics.*
import android.net.Uri
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import kr.cleantouch.scan.capture.FloatingScanService
import kr.cleantouch.scan.capture.VideoFrameCropper
import kr.cleantouch.scan.capture.PointObjectMasker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class PlaceChatActivity : ComponentActivity() {
    private var restoreWidget=false
    override fun onResume(){super.onResume();FloatingScanService.hide(this)}
    override fun onDestroy(){if(isFinishing&&restoreWidget&&FloatingScanService.running)FloatingScanService.show(this);super.onDestroy()}
    override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);restoreWidget=intent.getBooleanExtra("restoreWidget",false)
        setContent { MaterialTheme(colorScheme=darkColorScheme(primary=Color(0xFF73DFC1),background=Color(0xFF10242D),surface=Color(0xFF19313C))){Chat()} }
    }
    @Composable private fun Chat(){
        var source by remember { mutableStateOf<Bitmap?>(null) };var crop by remember { mutableStateOf<Bitmap?>(null) }
        var bounds by remember { mutableStateOf<Rect?>(null) };var preview by remember { mutableStateOf(false) }
        var busy by remember { mutableStateOf(false) };var error by remember { mutableStateOf("") };var input by remember { mutableStateOf("") }
        val history=remember { mutableStateListOf<PlaceChatMessage>() };val answers=remember { mutableStateMapOf<Int,List<PlaceCandidate>>() }
        val listState=rememberLazyListState()
        LaunchedEffect(history.size,busy){if(history.isNotEmpty()){withFrameNanos{};listState.animateScrollToItem(history.size+if(busy)1 else 0)}}
        val scope=rememberCoroutineScope()
        var productMode by remember { mutableStateOf(intent.getBooleanExtra("product",false)) }
        var picking by remember { mutableStateOf(false) }
        var shoppingQuery by remember { mutableStateOf("") }
        var selectionGeneration by remember { mutableStateOf(0) }
        fun productTap(x:Float,y:Float){val bitmap=source?:return;if(busy)return;val token=++selectionGeneration;busy=true;error=""
            scope.launch {try{
                val selected=withContext(Dispatchers.Default){PointObjectMasker(this@PlaceChatActivity).use { it.isolate(bitmap,x,y) }}?:kotlin.error("상품 경계를 찾지 못했어요. 상품 가운데를 다시 눌러 주세요.")
                if(token!=selectionGeneration){selected.recycle();return@launch}
                val white=Bitmap.createBitmap(selected.width,selected.height,Bitmap.Config.ARGB_8888);Canvas(white).apply {drawColor(android.graphics.Color.WHITE);drawBitmap(selected,0f,0f,null)};selected.recycle()
                crop=white;picking=false;preview=false;history.clear();answers.clear();shoppingQuery=""
                history.add(PlaceChatMessage("user","이 선택 상품을 분석하고 검색을 도와줘."))
                val result=PlaceChatRepository.identifyProduct(white);shoppingQuery=result.query
                history.add(PlaceChatMessage("model","${result.label} · ${result.reason}"))
            }catch(e:Exception){if(e is kotlinx.coroutines.CancellationException)throw e;if(token==selectionGeneration)error=e.message?:"상품 분석에 실패했어요."}finally{if(token==selectionGeneration)busy=false}}
        }
        fun request(){if(busy||crop==null||history.lastOrNull()?.role!="user")return
            busy=true;error=""
            scope.launch { try { val result=PlaceChatRepository.reply(crop!!,history.toList());history.add(PlaceChatMessage("model",result.answer.take(3000)));answers[history.lastIndex]=result.places }
                catch(e:Exception){if(e is kotlinx.coroutines.CancellationException)throw e;error=if(e is java.net.ConnectException||e is java.net.UnknownHostException)"AI 분석에 연결하지 못했어요. 인터넷과 서비스 상태를 확인해 주세요." else e.message?:"분석에 실패했어요."}
                finally{busy=false} }
        }
        fun select(){val bitmap=source?:return;val box=bounds?:return
            crop=Bitmap.createBitmap(bitmap,box.left,box.top,box.width(),box.height());preview=false
            if(productMode){history.clear();answers.clear();shoppingQuery="";history.add(PlaceChatMessage("user","이 선택 상품을 분석하고 검색을 도와줘."));busy=true;error=""
                scope.launch {try{val result=PlaceChatRepository.identifyProduct(crop!!);shoppingQuery=result.query;history.add(PlaceChatMessage("model","${result.label} · ${result.reason}"))}catch(e:Exception){if(e is kotlinx.coroutines.CancellationException)throw e;error=e.message?:"상품 분석에 실패했어요."}finally{busy=false}};return
            }
            history.clear();answers.clear();history.add(PlaceChatMessage("user",if(productMode)"이 상품을 분석하고 검색을 도와줘." else "이 장소 분석해줘. 사진에 실제로 보이는 단서와 장소 후보를 설명해줘."));request()
        }
        LaunchedEffect(Unit){try {
            val path=intent.getStringExtra("scene")?:kotlin.error("분석할 영상 장면이 없어요. 위젯에서 장소 분석을 눌러 주세요.")
            val file=File(path);require(file.canonicalPath.startsWith(filesDir.canonicalPath+File.separator)){"영상 장면을 읽을 수 없어요."}
            val bitmap=withContext(Dispatchers.IO){BitmapFactory.decodeFile(file.absolutePath)}?:kotlin.error("영상 이미지를 읽지 못했어요.")
            source=bitmap
            if(intent.getBooleanExtra("product",false)){
                crop=bitmap;bounds=Rect(0,0,bitmap.width,bitmap.height);preview=false
                history.add(PlaceChatMessage("user","이 선택 상품을 분석하고 검색을 도와줘."))
                history.add(PlaceChatMessage("model","${intent.getStringExtra("productLabel").orEmpty().take(30)} · ${intent.getStringExtra("productReason").orEmpty().take(350)}"))
            }else{
                val detected=withContext(Dispatchers.Default){VideoFrameCropper.find(bitmap,intent.getIntExtra("topInset",0),intent.getIntExtra("bottomInset",0))}
                bounds=detected.bounds;if(detected.confident&&!intent.getBooleanExtra("chooseMode",false))select() else preview=true
            }
        }catch(e:Exception){error=e.message?:"영상 장면을 읽지 못했어요."}}
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding().padding(16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("✦ CleanTouch AI",fontSize=21.sp);TextButton(onClick={finish()}){Text("영상으로 돌아가기")}}
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                    OutlinedButton(onClick={productMode=true;picking=true;preview=false;error=""},enabled=!busy&&source!=null){Text("상품 분석")}
                    OutlinedButton(onClick={productMode=false;picking=false;preview=true;shoppingQuery="";error=""},enabled=!busy&&source!=null){Text("장소 분석")}
                }
                Text(if(productMode)"선택한 상품 사진으로 AI에게 질문합니다. 실제 가격·재고는 판매 페이지에서 확인하세요." else "선택한 영상 영역만 Gemini로 전송합니다. 실제 위치 정보는 보내지 않으며 장소는 사진 기반 추정입니다.",fontSize=12.sp)
                if(picking&&source!=null){
                    Text("사진에서 궁금한 상품 가운데를 눌러 주세요. AI가 상품 부분을 분리해 분석합니다.")
                    Box(Modifier.fillMaxWidth().weight(1f).semantics {contentDescription="상품 터치 선택 화면"}.pointerInput(source){
                        detectTapGestures {point->val bitmap=source?:return@detectTapGestures
                            val scale=minOf(size.width.toFloat()/bitmap.width,size.height.toFloat()/bitmap.height)
                            val x=(point.x-(size.width-bitmap.width*scale)/2)/scale/bitmap.width
                            val y=(point.y-(size.height-bitmap.height*scale)/2)/scale/bitmap.height
                            if(x in 0f..1f&&y in 0f..1f)productTap(x,y)
                        }
                    }){Image(source!!.asImageBitmap(),null,Modifier.fillMaxSize(),contentScale=ContentScale.Fit)}
                    OutlinedButton(onClick={selectionGeneration++;busy=false;picking=false;preview=true;error=""}){Text("경계 인식이 느리면 상품 영역 직접 선택")}
                    if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
                    if(error.isNotBlank())Text(error,color=Color(0xFFFFC57D))
                }else if(preview&&source!=null){
                    Text("영상 영역을 확인해 주세요",fontSize=18.sp)
                    Text("정확한 영상 경계를 자동으로 확인하지 못했어요. 영상만 남도록 드래그한 뒤 분석하세요.",fontSize=12.sp)
                    AndroidView(factory={CropView(this@PlaceChatActivity,source!!,bounds!!){bounds=it}},modifier=Modifier.fillMaxWidth().weight(1f))
                    Button(onClick={select()},modifier=Modifier.fillMaxWidth()){Text(if(productMode)"선택한 상품 AI 분석" else "이 영상 영역으로 장소 분석")}
                }else{
                    LazyColumn(Modifier.weight(1f),state=listState,verticalArrangement=Arrangement.spacedBy(12.dp)) {
                        if(crop!=null)item {Image(crop!!.asImageBitmap(),"전송한 영상 영역",Modifier.fillMaxWidth().height(180.dp),contentScale=ContentScale.Fit)}
                        items(history.indices.toList()){index->val m=history[index]
                            Surface(color=if(m.role=="user")Color(0xFF214B45) else Color(0xFF203744),shape=MaterialTheme.shapes.medium){Column(Modifier.fillMaxWidth().padding(12.dp)){
                                Text(if(m.role=="user")"나" else "CleanTouch AI",fontSize=11.sp,color=Color(0xFF73DFC1));Text(m.text,fontSize=15.sp)
                                answers[index]?.forEach { p->Text(p.evidence,fontSize=12.sp);TextButton(onClick={startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.google.com/maps/search/?api=1&query=${Uri.encode(p.name)}")))}){Text("${p.name} · 지도에서 확인")} }
                            }}
                        }
                        if(busy)item {Text("사진과 질문을 분석하고 있어요…");LinearProgressIndicator(Modifier.fillMaxWidth())}
                    }
                    if(shoppingQuery.isNotBlank())OutlinedButton(onClick={startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.google.com/search?tbm=shop&q=${Uri.encode(shoppingQuery)}")))}){Text("$shoppingQuery · 쇼핑 검색")}
                    if(error.isNotBlank())Text(error,color=Color(0xFFFFC57D),fontSize=13.sp)
                    if(!busy&&history.lastOrNull()?.role=="user")TextButton(onClick={request()}){Text("다시 시도")}
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        OutlinedTextField(input,{input=it.take(1500)},Modifier.weight(1f),placeholder={Text("궁금한 내용을 더 물어보세요")},enabled=!busy&&crop!=null&&history.lastOrNull()?.role=="model",maxLines=3)
                        Button(onClick={if(history.size>=13){error="대화가 길어졌어요. 새 대화를 시작해 주세요."}else if(input.isNotBlank()){history.add(PlaceChatMessage("user",input.trim()));input="";request()}},enabled=!busy&&input.isNotBlank()&&history.lastOrNull()?.role=="model"){Text("전송")}
                    }
                    TextButton(onClick={if(!busy&&source!=null){history.clear();answers.clear();preview=true;error=""}},enabled=!busy&&source!=null){Text("영역 다시 선택 · 새 대화")}
                }
            }
        }
    }
    private class ProductTapView(context:android.content.Context,val image:Bitmap,val tapped:(Float,Float)->Unit):View(context){
        init { contentDescription="상품 터치 선택 화면" }
        private val paint=Paint(Paint.ANTI_ALIAS_FLAG)
        private fun scale()=minOf(width.toFloat()/image.width,height.toFloat()/image.height)
        override fun onDraw(canvas:Canvas){val s=scale();canvas.save();canvas.clipRect(0,0,width,height);canvas.drawColor(android.graphics.Color.BLACK);canvas.save();canvas.translate((width-image.width*s)/2,(height-image.height*s)/2);canvas.scale(s,s);canvas.drawBitmap(image,0f,0f,paint);canvas.restore();canvas.restore()}
        override fun onTouchEvent(event:MotionEvent):Boolean{if(event.actionMasked==MotionEvent.ACTION_UP){val s=scale();val x=(event.x-(width-image.width*s)/2)/s/image.width;val y=(event.y-(height-image.height*s)/2)/s/image.height;if(x in 0f..1f&&y in 0f..1f)tapped(x,y)};return true}
    }
    private class CropView(context:android.content.Context,val image:Bitmap,initial:Rect,val changed:(Rect)->Unit):View(context){
        init {contentDescription="분석 영역 선택 화면"}
        private var box=Rect(initial);private val paint=Paint(Paint.ANTI_ALIAS_FLAG);private var start=PointF()
        private fun scale()=minOf(width.toFloat()/image.width,height.toFloat()/image.height)
        private fun point(event:MotionEvent):PointF{val s=scale();return PointF(((event.x-(width-image.width*s)/2)/s).coerceIn(0f,image.width.toFloat()-1),((event.y-(height-image.height*s)/2)/s).coerceIn(0f,image.height.toFloat()-1))}
        override fun onDraw(canvas:Canvas){val s=scale();canvas.save();canvas.clipRect(0,0,width,height);canvas.drawColor(android.graphics.Color.BLACK);canvas.save();canvas.translate((width-image.width*s)/2,(height-image.height*s)/2);canvas.scale(s,s);canvas.drawBitmap(image,0f,0f,paint);paint.color=android.graphics.Color.rgb(115,223,193);paint.style=Paint.Style.STROKE;paint.strokeWidth=3/s;canvas.drawRect(box,paint);paint.style=Paint.Style.FILL;canvas.restore();canvas.restore()}
        override fun onTouchEvent(event:MotionEvent):Boolean{when(event.actionMasked){MotionEvent.ACTION_DOWN->{start=point(event);parent.requestDisallowInterceptTouchEvent(true)};MotionEvent.ACTION_MOVE,MotionEvent.ACTION_UP->{val p=point(event);val next=Rect(minOf(start.x,p.x).toInt(),minOf(start.y,p.y).toInt(),maxOf(start.x,p.x).toInt()+1,maxOf(start.y,p.y).toInt()+1);if(next.width()>20&&next.height()>20){box=next;changed(Rect(next));invalidate()}}};return true}
    }
}
