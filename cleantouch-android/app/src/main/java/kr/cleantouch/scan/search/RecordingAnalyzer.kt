package kr.cleantouch.scan.search

import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import kr.cleantouch.scan.BuildConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.security.MessageDigest

class RecordingAnalyzer {
    suspend fun analyze(onProgress: (Int, Int) -> Unit) = withContext(Dispatchers.IO) {
        val snapshot = ScanSessionStore.state.value
        require(snapshot.recording.isFile) { "저장된 녹화가 없어요. 새 스캔을 시작해 주세요." }
        val reader = MediaMetadataRetriever()
        try {
            reader.setDataSource(snapshot.recording.absolutePath)
            val duration = reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            require(duration > 0) { "녹화가 너무 짧거나 저장되지 않았어요. 새 스캔을 시작해 주세요." }
            val times = scanTimelineForSession(duration, snapshot.totalFrames)
            ScanSessionStore.update { it.copy(phase = ScanPhase.ANALYZING, durationMs = duration, totalFrames = times.size, message = "") }
            val remainingWait = (snapshot.retryAtMillis - System.currentTimeMillis()).coerceAtLeast(0)
            if (remainingWait > 120_000L) error("AI 서비스의 대기 시간이 남아 있어요. 표시된 시간이 지난 뒤 이어서 분석해 주세요.")
            if (remainingWait > 0) waitForRetry(remainingWait)
            var lastSignature: String? = null
            var lastRequestAt = 0L
            for (time in times) {
                currentCoroutineContext().ensureActive()
                if (time in ScanSessionStore.state.value.completedFrames) continue
                val frame = reader.getFrameAtTime(time * 1000, MediaMetadataRetriever.OPTION_CLOSEST)
                    ?: error("녹화의 일부 장면을 읽지 못했어요. 다시 분석해 주세요.")
                try {
                    val signature = signature(frame)
                    if (signature != lastSignature) {
                        // Stay below the server's per-minute quota, including fast responses.
                        val wait = 2_100L - (android.os.SystemClock.elapsedRealtime() - lastRequestAt)
                        if (wait > 0) delay(wait)
                        val scene = searchWithRetry(frame)
                        lastRequestAt = android.os.SystemClock.elapsedRealtime()
                        currentCoroutineContext().ensureActive()
                        val found = scene.optJSONArray("products") ?: error("검색 서버를 업데이트해 주세요.")
                        for (index in 0 until found.length()) {
                            currentCoroutineContext().ensureActive()
                            val product = found.optJSONObject(index) ?: continue
                            val matches = parseMatches(product.optJSONArray("matches"))
                            val label = product.optString("label").trim()
                            if (label.isEmpty() || matches.isEmpty()) continue
                            // Use normalized search destinations, not per-request IDs.
                            val id = digest(matches.map { it.url }.sorted().joinToString("|"))
                            if (ScanSessionStore.state.value.products.any { it.id == id }) continue
                            val file = File(snapshot.directory, "product-$id.jpg")
                            val box = product.optJSONArray("box")
                            val cropped = if (box != null && box.length() == 4) {
                                val rect = FocusRect(box.optDouble(0).toFloat(), box.optDouble(1).toFloat(), box.optDouble(2).toFloat(), box.optDouble(3).toFloat()).toBitmapRect(frame.width, frame.height)
                                Bitmap.createBitmap(frame, rect.left, rect.top, rect.width(), rect.height())
                            } else frame
                            try {
                                val ratio = minOf(1f, 420f / maxOf(cropped.width, cropped.height))
                                val small = Bitmap.createScaledBitmap(cropped, (cropped.width * ratio).toInt().coerceAtLeast(1), (cropped.height * ratio).toInt().coerceAtLeast(1), true)
                                try { file.outputStream().use { small.compress(Bitmap.CompressFormat.JPEG, 85, it) } }
                                finally { if (small !== cropped) small.recycle() }
                            } finally { if (cropped !== frame) cropped.recycle() }
                            currentCoroutineContext().ensureActive()
                            ScanSessionStore.update { it.copy(products = it.products + RecordedProduct(id, label, file.absolutePath, time, matches)) }
                        }
                        lastSignature = signature
                    }
                    currentCoroutineContext().ensureActive()
                    ScanSessionStore.update { it.copy(completedFrames = it.completedFrames + time) }
                    onProgress(ScanSessionStore.state.value.completedFrames.size, times.size)
                } finally { frame.recycle() }
            }
            currentCoroutineContext().ensureActive()
            ScanSessionStore.update { it.copy(phase = ScanPhase.COMPLETE, retryAtMillis = 0, message = if (it.products.isEmpty()) "인식 가능한 상품이 없어요. 상품이 잘 보이는 화면에서 다시 시도해 주세요." else "") }
            // Only delete our own completed recording; failed/interrupted recordings remain retryable.
            snapshot.recording.delete()
        } catch (error: CancellationException) { throw error }
        finally { reader.release() }
    }

    private suspend fun searchWithRetry(bitmap: Bitmap): JSONObject = retryRateLimited(
        request = {
            try { search(bitmap) }
            catch (error: ScanRateLimitException) {
                currentCoroutineContext().ensureActive()
                val now = System.currentTimeMillis()
                val retryAt = if (error.waitMs > Long.MAX_VALUE - now) Long.MAX_VALUE else now + error.waitMs
                ScanSessionStore.update { it.copy(retryAtMillis = retryAt) }
                throw error
            }
        },
        wait = { waitForRetry(it) },
    )

    private suspend fun waitForRetry(milliseconds: Long) {
        currentCoroutineContext().ensureActive()
        ScanSessionStore.update { it.copy(retryAtMillis = System.currentTimeMillis() + milliseconds,
            message = "AI 처리량 제한으로 잠시 기다리고 있어요. 완료한 장면은 유지하고 남은 장면부터 자동으로 이어갑니다.") }
        delay(milliseconds)
        currentCoroutineContext().ensureActive()
        ScanSessionStore.update { it.copy(retryAtMillis = 0, message = "") }
    }

    private fun search(bitmap: Bitmap): JSONObject {
        val boundary = "CleanTouchScene"
        val bytes = ByteArrayOutputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 86, it); it.toByteArray() }
        val connection = (URL(BuildConfig.SCAN_API_URL + "/v1/scans").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"; connectTimeout = 12_000; readTimeout = 90_000; doOutput = true
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            setRequestProperty("Accept", "application/json")
        }
        try {
            connection.outputStream.use { output ->
                output.write("--$boundary\r\nContent-Disposition: form-data; name=\"image\"; filename=\"frame.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".toByteArray())
                output.write(bytes); output.write("\r\n--$boundary--\r\n".toByteArray())
            }
            val status = connection.responseCode
            val text = (if (status in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val body = runCatching { JSONObject(text) }.getOrNull()
                val message = body?.optString("message")?.takeIf { it.isNotBlank() } ?: "검색 서버 응답 오류 ($status)"
                if (status == 429) {
                    val retryAfter = body?.optLong("retryAfterSeconds", -1)?.takeIf { it >= 0 }
                        ?: connection.getHeaderField("Retry-After")?.toLongOrNull()?.takeIf { it >= 0 }
                    throw ScanRateLimitException(message, retryAfter, body?.optString("limitWindow") == "day")
                }
                if (status == 503 && body?.optString("code") == "PROVIDER_UNAVAILABLE") {
                    val retryAfter = body.optLong("retryAfterSeconds", -1).takeIf { it >= 0 }
                        ?: connection.getHeaderField("Retry-After")?.toLongOrNull()?.takeIf { it >= 0 }
                        ?: 30L
                    val waitMs = retryAfter.coerceIn(1L, Long.MAX_VALUE / 1_000L) * 1_000L
                    val now = System.currentTimeMillis()
                    ScanSessionStore.update { it.copy(retryAtMillis = if (waitMs > Long.MAX_VALUE - now) Long.MAX_VALUE else now + waitMs) }
                }
                error(message)
            }
            return JSONObject(text)
        } catch (error: SocketTimeoutException) {
            throw IllegalStateException("AI 분석 서버 응답이 늦어 연결 시간이 초과됐어요. 완료한 결과와 녹화는 보존되니 잠시 후 이어서 분석해 주세요.", error)
        } catch (error: java.io.IOException) {
            throw IllegalStateException("검색 서버에 연결하지 못했어요. PC와 같은 와이파이에 연결하고 검색 서버가 켜져 있는지 확인해 주세요.", error)
        } finally { connection.disconnect() }
    }

    private fun signature(bitmap: Bitmap): String {
        val small = Bitmap.createScaledBitmap(bitmap, 32, 32, true)
        return try {
            val pixels = IntArray(1024)
            small.getPixels(pixels, 0, 32, 0, 0, 32, 32)
            digest(pixels.joinToString(","))
        } finally { if (small !== bitmap) small.recycle() }
    }
    private fun digest(text: String) = MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }.take(24)
}
