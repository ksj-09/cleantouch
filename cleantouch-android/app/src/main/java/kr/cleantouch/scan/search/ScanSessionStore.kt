package kr.cleantouch.scan.search

import android.content.Context
import android.util.AtomicFile
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

enum class ScanPhase { IDLE, RECORDING, ANALYZING, COMPLETE, INTERRUPTED }
data class RecordedProduct(val id: String, val label: String, val thumbnail: String, val firstSeenMs: Long, val matches: List<ProductMatch>)
data class ScanSnapshot(
    val id: String = "", val phase: ScanPhase = ScanPhase.IDLE,
    val directory: String = "", val startedAt: Long = 0, val durationMs: Long = 0,
    val completedFrames: Set<Long> = emptySet(), val totalFrames: Int = 0,
    val products: List<RecordedProduct> = emptyList(), val message: String = "",
    val retryAtMillis: Long = 0,
) {
    val recording get() = File(directory, "recording.mp4")
    val busy get() = phase == ScanPhase.RECORDING || phase == ScanPhase.ANALYZING
}

/** Disk-backed results survive activity recreation and process restarts. No retained bitmaps. */
object ScanSessionStore {
    private val mutable = MutableStateFlow(ScanSnapshot())
    val state = mutable.asStateFlow()
    private var loaded = false
    private lateinit var appContext: Context

    @Synchronized fun initialize(context: Context) {
        if (loaded) return
        appContext = context.applicationContext
        loaded = true
        val id = appContext.getSharedPreferences("scan", 0).getString("latest", null) ?: return
        val file = File(appContext.filesDir, "sessions/$id/session.json")
        val restored = runCatching { decode(JSONObject(AtomicFile(file).openRead().bufferedReader().use { it.readText() })) }.getOrNull() ?: return
        mutable.value = if (restored.busy) restored.copy(phase = ScanPhase.INTERRUPTED, message = "작업이 중단됐어요. 저장된 녹화에서 분석을 다시 이어갈 수 있어요.") else restored
    }

    @Synchronized fun begin(): ScanSnapshot {
        check(!mutable.value.busy)
        val id = UUID.randomUUID().toString()
        val folder = File(appContext.filesDir, "sessions/$id").apply { mkdirs() }
        val snapshot = ScanSnapshot(id, ScanPhase.RECORDING, folder.absolutePath, System.currentTimeMillis())
        save(snapshot)
        appContext.getSharedPreferences("scan", 0).edit().putString("latest", id).apply()
        return snapshot
    }

    @Synchronized fun update(transform: (ScanSnapshot) -> ScanSnapshot) { save(transform(mutable.value)) }

    private fun save(value: ScanSnapshot) {
        if (value.id.isNotEmpty()) {
            val atomic = AtomicFile(File(value.directory, "session.json"))
            val output = atomic.startWrite()
            try { output.write(encode(value).toString().toByteArray(Charsets.UTF_8)); atomic.finishWrite(output) }
            catch (error: Exception) { atomic.failWrite(output); throw error }
        }
        mutable.value = value
    }

    private fun encode(value: ScanSnapshot) = JSONObject().apply {
        put("id", value.id); put("phase", value.phase.name); put("directory", value.directory)
        put("startedAt", value.startedAt); put("durationMs", value.durationMs); put("totalFrames", value.totalFrames)
        put("completedFrames", JSONArray(value.completedFrames.toList())); put("message", value.message)
        put("retryAtMillis", value.retryAtMillis)
        put("products", JSONArray(value.products.map { product -> JSONObject().apply {
            put("id", product.id); put("label", product.label); put("thumbnail", product.thumbnail); put("firstSeenMs", product.firstSeenMs)
            put("matches", JSONArray(product.matches.map(::matchJson)))
        } }))
    }

    private fun decode(json: JSONObject) = ScanSnapshot(
        id = json.getString("id"), phase = ScanPhase.valueOf(json.getString("phase")), directory = json.getString("directory"),
        startedAt = json.optLong("startedAt"), durationMs = json.optLong("durationMs"), totalFrames = json.optInt("totalFrames"), message = json.optString("message"),
        retryAtMillis = json.optLong("retryAtMillis"),
        completedFrames = json.getJSONArray("completedFrames").let { array -> (0 until array.length()).map { array.getLong(it) }.toSet() },
        products = json.getJSONArray("products").let { array -> (0 until array.length()).map { index ->
            val item = array.getJSONObject(index)
            RecordedProduct(item.getString("id"), item.getString("label"), item.getString("thumbnail"), item.getLong("firstSeenMs"), parseMatches(item.optJSONArray("matches")))
        } },
    )
}

internal fun matchJson(value: ProductMatch) = JSONObject().apply {
    put("id", value.id); put("title", value.title); put("source", value.source); put("url", value.url)
    put("imageUrl", value.imageUrl); put("price", value.price); put("matchKind", value.matchKind)
}

internal fun parseMatches(array: JSONArray?): List<ProductMatch> = buildList {
    if (array == null) return@buildList
    for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: continue
        val url = item.optString("url")
        if (!runCatching { java.net.URI(url).scheme?.lowercase() in setOf("http", "https") }.getOrDefault(false)) continue
        add(ProductMatch(item.optString("id"), item.optString("title"), item.optString("source"), url,
            item.optString("imageUrl").takeIf { it.startsWith("http") }, item.optString("price").takeIf { it.isNotBlank() }, item.optString("matchKind", "search_link")))
    }
}
