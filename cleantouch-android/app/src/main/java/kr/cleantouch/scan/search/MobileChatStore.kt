package kr.cleantouch.scan.search

import android.content.Context
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

data class ChatLink(val title: String, val url: String)
data class MobileMessage(val role: String, val text: String, val links: List<ChatLink> = emptyList())
data class MobileConversation(
    val id: String = UUID.randomUUID().toString(), val title: String = "새 대화",
    val updated: Long = System.currentTimeMillis(), val messages: List<MobileMessage> = emptyList(),
    val photo: String = "", val draft: String = "",
)

/** Local, private storage. No chat or selected photo is included in Android backups. */
class MobileChatStore(context: Context) {
    private val directory = File(context.filesDir, "ai-chats").apply { mkdirs() }
    private val file = AtomicFile(File(directory, "conversations.json"))
    private val cipher = SecureChatCipher()
    @Synchronized fun load(): List<MobileConversation> = runCatching {
        val data = JSONArray(cipher.decrypt(file.openRead().use { it.readBytes() }).toString(Charsets.UTF_8))
        (0 until minOf(data.length(),40)).map { index ->
            val c = data.getJSONObject(index); val messages = c.optJSONArray("messages") ?: JSONArray()
            MobileConversation(c.getString("id"), c.optString("title","새 대화"), c.optLong("updated"),
                (0 until minOf(messages.length(),160)).map { i ->
                    val m=messages.getJSONObject(i); val links=m.optJSONArray("links") ?: JSONArray()
                    MobileMessage(m.getString("role"),m.getString("text"), (0 until links.length()).map { j ->
                        val l=links.getJSONObject(j); ChatLink(l.getString("title"),l.getString("url"))
                    }.filter { MobileInputPolicy.safeUrl(it.url).isNotBlank() })
                }.filter { it.role in listOf("user","model") },
                c.optString("photo").takeIf { safePhoto(it)?.exists() == true }.orEmpty(), c.optString("draft").take(1500))
        }
    }.getOrDefault(emptyList())
    fun safePhoto(path: String): File? = runCatching {
        File(path).takeIf { it.canonicalPath.startsWith(directory.canonicalPath+File.separator) }
    }.getOrNull()
    fun photoFile(): File = File(directory,"photo-${UUID.randomUUID()}.jpg")
    @Synchronized fun save(chats: List<MobileConversation>) {
        val data = JSONArray().apply { chats.take(40).forEach { c ->
            put(JSONObject().put("id",c.id).put("title",c.title.take(35)).put("updated",c.updated)
                .put("photo",c.photo).put("draft",c.draft).put("messages",JSONArray().apply {
                    bounded(c.messages).forEach { m -> put(JSONObject().put("role",m.role).put("text",m.text.take(6000))
                        .put("links",JSONArray().apply { m.links.take(8).forEach { put(JSONObject().put("title",it.title).put("url",it.url)) } })) }
                }))
        } }
        var out: java.io.FileOutputStream? = null
        try { out=file.startWrite(); out.write(cipher.encrypt(data.toString().toByteArray(Charsets.UTF_8)));file.finishWrite(out) }
        catch(e:Exception){ if(out!=null) file.failWrite(out);throw e }
        val used=chats.map { it.photo }.toSet()
        directory.listFiles()?.filter { it.name.startsWith("photo-") && it.absolutePath !in used && System.currentTimeMillis()-it.lastModified()>30*60_000 }?.forEach { it.delete() }
    }
    companion object {
        fun bounded(messages:List<MobileMessage>) = if(messages.size<=160) messages else messages.take(32)+messages.takeLast(128)
        fun context(messages:List<MobileMessage>,question:String):String {
            val words=Regex("[가-힣A-Za-z0-9]{2,}").findAll(question).map { it.value.lowercase() }.toSet()
            val selected=messages.indices.filter { it<8 || it>=messages.size-24 || words.any { word->messages[it].text.lowercase().contains(word) } }.takeLast(64)
            return selected.joinToString("\n") { i->"${if(messages[i].role=="user") "사용자" else "AI"}: ${messages[i].text.take(1800)}" }.takeLast(16000)
        }
        fun title(answer:String,question:String):Pair<String,String> {
            val tag=Regex("<cleantouch-title>([^<]{2,35})</cleantouch-title>")
            val proposed=tag.find(answer)?.groupValues?.get(1)?.trim().orEmpty()
            val fallback=question.replace(Regex("[\n\r]+")," ").trim().take(24).ifBlank { "새 대화" }
            val title=proposed.takeUnless { it.isBlank() || it in listOf("궁금한 내용 알아보기","새 대화","일반 질문") } ?: fallback
            return title to answer.replace(tag,"").trim()
        }
    }
}
