package kr.cleantouch.scan.search

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.util.Base64
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

data class MobileObject(val label:String,val bounds:Rect)
object MobileObjectRepository {
    private val client=MobileAiClient(CoroutineScope(SupervisorJob()+Dispatchers.Default)){}
    suspend fun locate(current:Bitmap,neighbors:List<String>):List<MobileObject> = withContext(Dispatchers.Default) {
        val images=withContext(Dispatchers.Default){neighbors.take(2).mapNotNull {path->BitmapFactory.decodeFile(path)?.let {bitmap->try{encode(bitmap)}finally{bitmap.recycle()}} }+encode(current)}
        val result=client.post(JSONObject().put("task","objects").put("image",images.last()).put("images",JSONArray(images)).put("messages",JSONArray().put(JSONObject().put("role","user").put("text","사진은 앞뒤 장면과 마지막 현재 장면입니다. 현재 장면의 실제 상품 전체를 찾고, 장면 전환·반사·배경·자막은 상품으로 만들지 마세요."))))
        val items=result.optJSONArray("products")?:JSONArray()
        (0 until items.length()).mapNotNull {i->
            val item=items.getJSONObject(i);val box=item.optJSONArray("box")?:return@mapNotNull null
            if(box.length()!=4||item.optString("confidence")=="low")return@mapNotNull null
            val label=item.optString("label").trim().take(30);if(label.isBlank())return@mapNotNull null
            val rect=Rect((box.optDouble(1)/1000*current.width).toInt(),(box.optDouble(0)/1000*current.height).toInt(),(box.optDouble(3)/1000*current.width).toInt(),(box.optDouble(2)/1000*current.height).toInt())
            if(!rect.intersect(0,0,current.width,current.height)||rect.width()<20||rect.height()<20)return@mapNotNull null
            MobileObject(label,rect)
        }
    }
    private fun encode(bitmap:Bitmap):String {
        val scale=minOf(1f,1280f/maxOf(bitmap.width,bitmap.height));val small=Bitmap.createScaledBitmap(bitmap,(bitmap.width*scale).toInt().coerceAtLeast(1),(bitmap.height*scale).toInt().coerceAtLeast(1),true)
        try{var quality=88;var bytes:ByteArray;do{bytes=ByteArrayOutputStream().use{small.compress(Bitmap.CompressFormat.JPEG,quality,it);it.toByteArray()};quality-=12}while(bytes.size>440000&&quality>=40);return Base64.encodeToString(bytes,Base64.NO_WRAP)}finally{if(small!==bitmap)small.recycle()}
    }
}
