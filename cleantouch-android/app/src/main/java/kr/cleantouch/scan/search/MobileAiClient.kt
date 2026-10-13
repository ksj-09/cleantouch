package kr.cleantouch.scan.search

import android.util.Base64
import kr.cleantouch.scan.BuildConfig
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okio.ByteString
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** One ephemeral connection; no API keys, microphone or audio are collected. */
class MobileAiClient(private val scope: CoroutineScope, private val onStatus:(String)->Unit) {
    private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(60,TimeUnit.SECONDS).build()
    private var socket:WebSocket?=null
    private var connected:CompletableDeferred<Unit>?=null
    private var pending:CompletableDeferred<String>?=null
    private var answer=StringBuilder()
    private var openedAt=0L
    private var generation=0
    private var currentImage=""
    private var toolLinks=mutableListOf<ChatLink>()
    private val connectionLock=Mutex()
    val ready get()=socket!=null && connected?.isCompleted==true && connected?.isCancelled!=true

    suspend fun post(body:JSONObject):JSONObject {
        val request=Request.Builder().url("${BuildConfig.PLACE_CHAT_URL}/v1/place-chat")
            .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType())).build()
        return suspendCancellableCoroutine { continuation ->
            val call=http.newCall(request);continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object:Callback {
                override fun onFailure(call:Call,e:java.io.IOException) { if(continuation.isActive)continuation.resumeWithException(e) }
                override fun onResponse(call:Call,response:Response) { response.use {
                    val result=runCatching { val data=JSONObject(it.body?.string()?:"{}");check(it.isSuccessful){data.optString("message","AI 연결이 지연되고 있어요. 잠시 뒤 다시 시도해 주세요.")};data }
                    if(continuation.isActive)result.fold({data->continuation.resume(data)},{error->continuation.resumeWithException(error)})
                } }
            })
        }
    }
    suspend fun prepare()=connect()
    private suspend fun connect() = connectionLock.withLock {
        if(ready && System.currentTimeMillis()-openedAt<8*60_000)return@withLock
        close();onStatus("AI와 연결하고 있어요…")
        val auth=post(JSONObject().put("task","live-token").put("shoppingTools",true))
        val id=generation;val wait=CompletableDeferred<Unit>();connected=wait
        val request=Request.Builder().url("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${java.net.URLEncoder.encode(auth.getString("token"),"UTF-8")}").build()
        socket=http.newWebSocket(request,object:WebSocketListener(){
            override fun onOpen(webSocket:WebSocket,response:Response){if(id==generation)webSocket.send(JSONObject().put("setup",auth.getJSONObject("setup")).toString())else webSocket.cancel()}
            override fun onMessage(webSocket:WebSocket,text:String){scope.launch { if(id==generation) receive(webSocket,text) }}
            override fun onMessage(webSocket:WebSocket,bytes:ByteString){onMessage(webSocket,bytes.utf8())}
            override fun onFailure(webSocket:WebSocket,t:Throwable,response:Response?){scope.launch {if(id==generation) fail("AI 연결이 끊겼어요. 인터넷 연결을 확인하고 다시 시도해 주세요.")}}
            override fun onClosed(webSocket:WebSocket,code:Int,reason:String){scope.launch {if(id==generation) fail("AI 연결이 종료됐어요. 다시 질문하면 연결합니다.")}}
        })
        try { withTimeout(20000){wait.await()};openedAt=System.currentTimeMillis() }
        catch(e:Exception){close();throw e}
    }
    private fun fail(message:String){connected?.completeExceptionally(IllegalStateException(message));pending?.completeExceptionally(IllegalStateException(message));socket?.cancel();socket=null;onStatus(message)}
    private suspend fun receive(ws:WebSocket,text:String){
        val data=runCatching { JSONObject(text) }.getOrNull()?:return
        if(data.has("error")){fail(data.getJSONObject("error").optString("message","AI에 연결하지 못했어요."));return}
        if(data.has("setupComplete"))connected?.complete(Unit)
        val calls=data.optJSONObject("toolCall")?.optJSONArray("functionCalls")
        if(calls!=null && pending!=null){
            val turn=pending;val responses=JSONArray()
            for(i in 0 until minOf(calls.length(),3)){
                val call=calls.getJSONObject(i);val args=call.optJSONObject("args")?:JSONObject()
                val query=MobileInputPolicy.query(args.optString("query"))
                val result=try {
                    if(currentImage.isBlank()||query.isBlank())JSONObject().put("notice","현재 사진이 없어 상품의 외형은 확인하지 않았습니다.")
                    else similar(currentImage,query).also { toolLinks+=links(it,query) }
                }catch(e:Exception){if(e is CancellationException)throw e;JSONObject().put("notice","판매처 검색이 지연됩니다. 쇼핑 검색 버튼에서 비교하세요.").also {if(query.isNotBlank())toolLinks+=shopping(query)}}
                if(socket!==ws||pending!==turn)return
                responses.put(JSONObject().put("id",call.getString("id")).put("name",call.getString("name")).put("response",result))
            }
            ws.send(JSONObject().put("toolResponse",JSONObject().put("functionResponses",responses)).toString())
        }
        val content=data.optJSONObject("serverContent")
        if(pending!=null&&content!=null){
            val transcript=content.optJSONObject("outputTranscription")?.optString("text").orEmpty()
            if(transcript.isNotEmpty())answer.append(transcript)
            else { val parts=content.optJSONObject("modelTurn")?.optJSONArray("parts");if(parts!=null)for(i in 0 until parts.length()){val part=parts.getJSONObject(i);if(!part.optBoolean("thought"))answer.append(part.optString("text"))} }
            if(content.optBoolean("interrupted"))pending?.completeExceptionally(IllegalStateException("답변이 중단됐어요. 다시 시도해 주세요."))
            if(content.optBoolean("turnComplete")){if(answer.toString().isBlank())pending?.completeExceptionally(IllegalStateException("답변이 비어 있어요. 다시 질문해 주세요.")) else pending?.complete(answer.toString().take(6000))}
        }
        if(data.has("goAway")){socket?.close(1000,"Renew session");socket=null;onStatus("AI 연결을 새로 준비하고 있어요. 다음 질문 때 대화를 이어갑니다.")}
    }
    fun frame(image:String){if(ready && pending==null){currentImage=image;sendParts(JSONArray().put(JSONObject().put("inlineData",JSONObject().put("data",image).put("mimeType","image/jpeg"))),false)}}
    fun endVisual(){currentImage="";if(ready)sendText("화면 공유가 종료되었습니다. 새로운 화면을 보고 있다고 말하지 마세요. 이전 장면은 과거 문맥으로만 참고하세요.",false)}
    private fun sendParts(parts:JSONArray,complete:Boolean){check(socket?.send(JSONObject().put("clientContent",JSONObject().put("turns",JSONArray().put(JSONObject().put("role","user").put("parts",parts))).put("turnComplete",complete)).toString())==true){"AI 연결이 끊겼어요."}}
    private fun sendText(text:String,complete:Boolean)=sendParts(JSONArray().put(JSONObject().put("text",text)),complete)
    suspend fun ask(question:String,history:List<MobileMessage>,image:String,sharing:Boolean,newTitle:Boolean):MobileMessage {
        connect();toolLinks.clear();answer=StringBuilder();currentImage=image
        val turn=CompletableDeferred<String>();pending=turn
        try {
            val context=MobileChatStore.context(history,question)
            val prompt="이전 대화 기록(과거 사진은 현재 화면이 아닙니다):\n$context\n\n현재 입력: ${if(sharing) "사용자가 허용한 실시간 공유의 최근 장면" else if(image.isNotBlank()) "사용자가 첨부한 사진; 화면 공유는 꺼져 있습니다" else "텍스트만. 사진·화면·마이크는 보내지 않습니다"}. 마지막 사용자 정정을 우선하고 이전 조건을 유지하세요. 질문 전에 설명하지 마세요. " +
                (if(newTitle) "답변 끝에 이 대화를 2~24자 한국어 주제로 요약한 <cleantouch-title>제목</cleantouch-title>을 붙이세요. 똑같은 일반 제목은 피하세요. " else "") +"\n사용자 질문: $question"
            val parts=JSONArray();if(image.isNotBlank())parts.put(JSONObject().put("inlineData",JSONObject().put("data",image).put("mimeType","image/jpeg")))
            parts.put(JSONObject().put("text",prompt));sendParts(parts,true)
            val result=withTimeout(60000){turn.await()};onStatus(if(sharing)"AI와 화면을 함께 보고 있어요" else "답변을 완료했어요")
            return MobileMessage("model",result,toolLinks.distinctBy { it.url })
        }catch(e:Exception){close();throw e}finally{if(pending===turn)pending=null}
    }
    suspend fun similar(image:String,query:String)=post(JSONObject().put("task","similar").put("target",query).put("image",image).put("messages",JSONArray().put(JSONObject().put("role","user").put("text",query))))
    private fun links(result:JSONObject,query:String):List<ChatLink> {
        val candidates=result.optJSONArray("candidates")?:JSONArray()
        return (0 until candidates.length()).map { val c=candidates.getJSONObject(it);ChatLink(c.optString("name"),MobileInputPolicy.safeUrl(c.optString("url"))) }.filter { it.url.isNotBlank() } + shopping(query)
    }
    companion object { fun shopping(query:String)=MobileInputPolicy.shopping(query) }
    fun close(){generation++;pending?.cancel();pending=null;connected?.cancel();connected=null;socket?.cancel();socket=null;currentImage=""}
}
