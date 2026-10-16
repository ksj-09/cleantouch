package kr.cleantouch.scan.search

import android.graphics.Bitmap
import android.util.Base64
import kr.cleantouch.scan.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

data class PlaceChatMessage(val role: String, val text: String)
data class PlaceCandidate(val name: String, val evidence: String)
data class PlaceChatAnswer(val answer: String, val places: List<PlaceCandidate>)
data class ProductSearchAnswer(val label:String,val query:String,val confidence:String,val reason:String)
object PlaceChatRepository {
    suspend fun reply(image:Bitmap,messages:List<PlaceChatMessage>):PlaceChatAnswer {
        val result=request(image,messages)
        val candidates=result.optJSONArray("places")?:JSONArray()
        return PlaceChatAnswer(result.getString("answer"),(0 until minOf(candidates.length(),3)).map{val p=candidates.getJSONObject(it);PlaceCandidate(p.getString("name"),p.optString("evidence"))})
    }
    suspend fun identifyProduct(image:Bitmap):ProductSearchAnswer {
        val result=request(image,listOf(PlaceChatMessage("user","선택한 상품 분석")),"product")
        val label=result.getString("label").take(30);val confidence=result.optString("confidence","low")
        return ProductSearchAnswer(label,if(confidence=="low")"" else label,confidence,result.optString("reason").take(350))
    }
    private suspend fun request(image: Bitmap, messages: List<PlaceChatMessage>,task:String?=null):JSONObject = withContext(Dispatchers.IO) {
        val scale = minOf(1f,1280f/maxOf(image.width,image.height))
        val small = Bitmap.createScaledBitmap(image,(image.width*scale).toInt().coerceAtLeast(1),(image.height*scale).toInt().coerceAtLeast(1),true)
        val bytes = try { ByteArrayOutputStream().use { check(small.compress(Bitmap.CompressFormat.JPEG,85,it));it.toByteArray() } } finally { if(small!==image) small.recycle() }
        val history=JSONArray().apply { messages.forEach { put(JSONObject().put("role",it.role).put("text",it.text.take(3000))) } }
        val body=JSONObject().put("image",Base64.encodeToString(bytes,Base64.NO_WRAP)).put("messages",history).apply{if(task!=null)put("task",task)}.toString().toByteArray(Charsets.UTF_8)
        val connection=URL("${BuildConfig.PLACE_CHAT_URL}/v1/place-chat").openConnection() as HttpURLConnection
        try {
            connection.requestMethod="POST";connection.connectTimeout=12000;connection.readTimeout=55000;connection.doOutput=true
            connection.setRequestProperty("Content-Type","application/json; charset=utf-8");connection.setFixedLengthStreamingMode(body.size)
            connection.outputStream.use { it.write(body) }
            val status=connection.responseCode
            val result=JSONObject((if(status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: "{}")
            if(status !in 200..299) error(result.optString("message","장소 분석에 실패했어요. 잠시 후 다시 시도해 주세요."))
            result
        } finally { connection.disconnect() }
    }
}
