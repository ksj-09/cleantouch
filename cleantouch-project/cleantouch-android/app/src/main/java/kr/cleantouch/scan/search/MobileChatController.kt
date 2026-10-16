package kr.cleantouch.scan.search

import android.content.Context
import android.graphics.*
import android.net.Uri
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.*
import java.io.ByteArrayOutputStream
import java.io.File

data class MobileChatState(val loaded:Boolean=false,val chats:List<MobileConversation> = emptyList(),val current:String="",val busy:Boolean=false,val error:String="",val status:String="",val sharing:Boolean=false,val frameAt:Long=0) {
    val conversation get()=chats.find { it.id==current } ?: MobileConversation(id=current)
}
/** Application-owned session survives closing the chat; the foreground share service owns capture. */
object MobileChatController {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
    private val mutable=MutableStateFlow(MobileChatState())
    val state=mutable.asStateFlow()
    private lateinit var context:Context
    private lateinit var store:MobileChatStore
    private lateinit var client:MobileAiClient
    private val saves=Channel<List<MobileConversation>>(Channel.CONFLATED)
    private var operation:Job?=null
    private var sharingConnection:Job?=null
    private var generation=0
    private var image=""
    fun initialize(value:Context) {
        if(::store.isInitialized)return
        context=value.applicationContext;store=MobileChatStore(context);client=MobileAiClient(scope){status->mutable.update { it.copy(status=status) }}
        scope.launch(Dispatchers.IO){for(chats in saves)runCatching { store.save(chats) }.onFailure {scope.launch {mutable.update {it.copy(error="대화를 저장하지 못했어요. 기기의 여유 공간을 확인해 주세요.")}}}}
        scope.launch {
            val chats=withContext(Dispatchers.IO){store.load()}.ifEmpty { listOf(MobileConversation()) }
            mutable.value=MobileChatState(loaded=true,chats=chats,current=chats.first().id)
            restorePhoto(chats.first().photo)
        }
    }
    private fun change(transform:(MobileConversation)->MobileConversation) {
        mutable.update { s->s.copy(chats=s.chats.map { if(it.id==s.current)transform(it) else it }) }
        saves.trySend(state.value.chats)
    }
    fun draft(text:String)=change { it.copy(draft=text.take(1500)) }
    fun clearError(){mutable.update {it.copy(error="")}}
    fun cancel(){generation++;operation?.cancel();operation=null;client.close();mutable.update {it.copy(busy=false)}}
    fun choose(id:String) {
        if(id==state.value.current)return
        cancel();stopSharing();image="";mutable.update {it.copy(current=id,error="",status="")}
        scope.launch { restorePhoto(state.value.conversation.photo) }
    }
    fun newConversation(){cancel();stopSharing();image="";val chat=MobileConversation();mutable.update {it.copy(chats=(listOf(chat)+it.chats).take(40),current=chat.id,error="",status="")};saves.trySend(state.value.chats)}
    fun delete(id:String){val removed=state.value.chats.find{it.id==id}?.photo;if(state.value.current==id){cancel();stopSharing();image=""};val chats=state.value.chats.filter {it.id!=id}.ifEmpty {listOf(MobileConversation())};mutable.update {it.copy(chats=chats,current=if(it.current==id)chats.first().id else it.current)};saves.trySend(chats);scope.launch {if(!removed.isNullOrBlank()&&chats.none{it.photo==removed})withContext(Dispatchers.IO){store.safePhoto(removed)?.delete()};restorePhoto(state.value.conversation.photo)}}
    fun forgetPhoto(){stopSharing();image="";client.endVisual();change {it.copy(photo="")}}
    private suspend fun restorePhoto(path:String){
        val id=state.value.current
        val data=withContext(Dispatchers.IO){runCatching {store.safePhoto(path)?.takeIf {it.exists()}?.readBytes()?.let {Base64.encodeToString(it,Base64.NO_WRAP)}}.getOrNull().orEmpty()}
        if(id==state.value.current && !state.value.sharing)image=data
    }
    fun attach(uri:Uri){
        if(state.value.busy)return
        stopSharing();val id=state.value.current;val token=++generation;mutable.update {it.copy(busy=true,error="",status="사진을 준비하고 있어요…")}
        operation=scope.launch {try {
            val bitmap=withContext(Dispatchers.IO){decodePhoto(uri)}
            val result=withContext(Dispatchers.IO){try {storeBitmap(bitmap)}finally{bitmap.recycle()}}
            if(id!=state.value.current||token!=generation)return@launch
            image=result.second;client.endVisual();change {it.copy(photo=result.first,updated=System.currentTimeMillis())}
            mutable.update {it.copy(status="사진을 첨부했어요. 같은 대화에서 질문해 보세요.")}
        }catch(e:OutOfMemoryError){if(token==generation)mutable.update{it.copy(error="사진이 너무 커요. 다른 사진을 선택해 주세요.")}}
        catch(e:Exception){if(e is CancellationException)throw e;if(token==generation)mutable.update {it.copy(error=e.message?:"사진을 열지 못했어요.")}}finally{if(id==state.value.current&&token==generation)mutable.update {it.copy(busy=false)}}}
    }
    fun attachPrivate(path:String,product:Boolean=false) {
        val file=File(path);if(!file.canonicalPath.startsWith(context.filesDir.canonicalPath+File.separator)){mutable.update{it.copy(error="이 사진을 열 수 없어요.")};return}
        val id=state.value.current
        scope.launch {while(!state.value.loaded)delay(30);val actual=state.value.current;attach(Uri.fromFile(file));operation?.join();if(actual==state.value.current&&state.value.error.isBlank()&&product)send("선택한 상품의 종류와 색·형태를 분석하고, 외형이 가까운 구매 후보를 찾아줘.")}
    }
    private fun decodePhoto(uri:Uri):Bitmap {
        val resolver=context.contentResolver;val info=BitmapFactory.Options().apply {inJustDecodeBounds=true}
        resolver.openInputStream(uri)?.use {BitmapFactory.decodeStream(it,null,info)}
        require(info.outWidth>0&&info.outHeight>0){"읽을 수 있는 사진 파일을 선택해 주세요."}
        var sample=1;while(maxOf(info.outWidth,info.outHeight)/sample>2048)sample*=2
        val bitmap=resolver.openInputStream(uri)?.use {BitmapFactory.decodeStream(it,null,BitmapFactory.Options().apply{inSampleSize=sample})}?:error("사진을 읽지 못했어요.")
        val orientation=runCatching{resolver.openInputStream(uri)?.use {ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION,1)}?:1}.getOrDefault(1)
        val matrix=Matrix();when(orientation){2->matrix.setScale(-1f,1f);3->matrix.setRotate(180f);4->matrix.setScale(1f,-1f);5->{matrix.setRotate(90f);matrix.postScale(-1f,1f)};6->matrix.setRotate(90f);7->{matrix.setRotate(270f);matrix.postScale(-1f,1f)};8->matrix.setRotate(270f)}
        if(matrix.isIdentity)return bitmap
        return Bitmap.createBitmap(bitmap,0,0,bitmap.width,bitmap.height,matrix,true).also {if(it!==bitmap)bitmap.recycle()}
    }
    private fun storeBitmap(bitmap:Bitmap):Pair<String,String> {
        val scale=minOf(1f,1280f/maxOf(bitmap.width,bitmap.height));val small=Bitmap.createScaledBitmap(bitmap,(bitmap.width*scale).toInt().coerceAtLeast(1),(bitmap.height*scale).toInt().coerceAtLeast(1),true)
        val bytes=try {ByteArrayOutputStream().use {check(small.compress(Bitmap.CompressFormat.JPEG,90,it));it.toByteArray()}}finally{if(small!==bitmap)small.recycle()}
        val file=store.photoFile();file.writeBytes(bytes);return file.absolutePath to Base64.encodeToString(bytes,Base64.NO_WRAP)
    }
    fun selected(bitmap:Bitmap){val id=state.value.current;scope.launch {try {val result=withContext(Dispatchers.IO){storeBitmap(bitmap)};if(id==state.value.current){image=result.second;change{it.copy(photo=result.first)};send("이 상품의 종류와 실제 보이는 특징을 알려주고 비슷한 상품을 살 수 있게 도와줘.")}}catch(e:Exception){mutable.update{it.copy(error=e.message?:"상품 사진을 준비하지 못했어요.")}}finally{bitmap.recycle()}}}
    fun send(text:String=state.value.conversation.draft){
        val question=MobileInputPolicy.question(text);if(question.isBlank()||state.value.busy||!state.value.loaded)return
        val id=state.value.current;val token=++generation;val history=state.value.conversation.messages
        val wantsTitle=history.none {it.role=="model"};val visual=image;val sharing=state.value.sharing
        change {it.copy(messages=MobileChatStore.bounded(it.messages+MobileMessage("user",question)),draft="",updated=System.currentTimeMillis())}
        mutable.update {it.copy(busy=true,error="",status="답변을 준비하고 있어요…")}
        operation=scope.launch {try {
            val response=client.ask(question,history,visual,sharing,wantsTitle)
            if(token!=generation||id!=state.value.current)return@launch
            val parsed=MobileChatStore.title(response.text,question)
            change {it.copy(messages=MobileChatStore.bounded(it.messages+response.copy(text=parsed.second)),title=if(wantsTitle)parsed.first else it.title,updated=System.currentTimeMillis())}
        }catch(e:Exception){if(e is CancellationException)throw e;if(token==generation)mutable.update {it.copy(error=when(e){is TimeoutCancellationException->"답변이 오래 걸리고 있어요. 다시 시도해 주세요.";is java.io.IOException->"인터넷 연결을 확인해 주세요. 질문과 대화는 보관되어 있어요.";else->e.message?:"답변을 받지 못했어요."})}}
        finally {if(token==generation)mutable.update {it.copy(busy=false)}}}
    }
    fun retry(){if(state.value.busy)return;val messages=state.value.conversation.messages;val last=messages.lastOrNull()?.takeIf {it.role=="user"}?:return;change {it.copy(messages=it.messages.dropLast(1))};send(last.text)}
    fun beginSharing(){image="";mutable.update {it.copy(sharing=true,frameAt=0,status="공유할 앱을 열어 주세요. AI를 연결하고 있어요.",error="")};sharingConnection=scope.launch {try{client.prepare()}catch(e:Exception){if(e is CancellationException)throw e;mutable.update{it.copy(error=e.message?:"AI 연결을 확인해 주세요.")}}}}
    fun acceptFrame(data:String,at:Long){if(!state.value.sharing)return;image=data;mutable.update {it.copy(frameAt=at,status=if(it.busy)it.status else "AI와 화면을 함께 보고 있어요")};runCatching{client.frame(data)}}
    fun sharingStatus(text:String){if(state.value.sharing&&!state.value.busy)mutable.update {it.copy(status=text)}}
    fun stopSharing(){if(!state.value.sharing)return;sharingConnection?.cancel();sharingConnection=null;mutable.update {it.copy(sharing=false,frameAt=0,status="화면 공유를 종료했어요. 대화는 이어집니다.")};image="";client.endVisual();kr.cleantouch.scan.capture.AiScreenShareService.stop(context);scope.launch {restorePhoto(state.value.conversation.photo)}}
}
