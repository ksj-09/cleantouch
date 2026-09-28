package kr.cleantouch.scan.search

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import kr.cleantouch.scan.BuildConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONException
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.URI
import java.net.UnknownHostException
import java.net.URL
import java.util.UUID
import kotlin.math.max
import kotlin.math.min

data class ProductMatch(
    val id: String,
    val title: String,
    val source: String,
    val url: String,
    val imageUrl: String?,
    val price: String?,
    val matchKind: String,
)

data class ScanSearchResult(
    val scanId: String,
    val queryLabel: String,
    val matches: List<ProductMatch>,
    val croppedBitmap: Bitmap,
)

/** A product area expressed as fractions of the captured screen. */
data class FocusRect(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
) {
    fun toBitmapRect(width: Int, height: Int): Rect {
        val safeLeft = left.coerceIn(0f, 1f)
        val safeTop = top.coerceIn(0f, 1f)
        val safeRight = right.coerceIn((safeLeft + 0.001f).coerceAtMost(1f), 1f)
        val safeBottom = bottom.coerceIn((safeTop + 0.001f).coerceAtMost(1f), 1f)
        val pixelLeft = (safeLeft * width).toInt().coerceIn(0, max(0, width - 1))
        val pixelTop = (safeTop * height).toInt().coerceIn(0, max(0, height - 1))
        val pixelRight = (safeRight * width).toInt().coerceIn(pixelLeft + 1, width)
        val pixelBottom = (safeBottom * height).toInt().coerceIn(pixelTop + 1, height)
        return Rect(pixelLeft, pixelTop, min(width, pixelRight), min(height, pixelBottom))
    }
}

class ScanRepository {
    suspend fun search(captureFile: File, focusRect: FocusRect? = null): ScanSearchResult {
        val fullBitmap = withContext(Dispatchers.IO) {
            BitmapFactory.decodeFile(captureFile.absolutePath) ?: error("캡처 이미지를 읽지 못했습니다.")
        }
        val crop = cropPrimaryProduct(fullBitmap, focusRect).let { detected ->
            if (detected === fullBitmap) fullBitmap.copy(Bitmap.Config.ARGB_8888, false) else detected
        }
        return try {
            upload(fullBitmap, crop).copy(croppedBitmap = crop)
        } catch (error: CancellationException) {
            crop.recycle()
            throw error
        } catch (error: Exception) {
            crop.recycle()
            throw userFacingSearchError(error)
        } finally {
            if (!fullBitmap.isRecycled) fullBitmap.recycle()
        }
    }

    private fun cropPrimaryProduct(bitmap: Bitmap, focusRect: FocusRect?): Bitmap {
        val box = focusRect?.toBitmapRect(bitmap.width, bitmap.height)
            ?: centeredSearchArea(bitmap.width, bitmap.height)
        return Bitmap.createBitmap(bitmap, box.left, box.top, box.width(), box.height())
    }

    private suspend fun upload(fullBitmap: Bitmap, focusBitmap: Bitmap): ScanSearchResult = withContext(Dispatchers.IO) {
        val boundary = "----CleanTouch${UUID.randomUUID()}"
        val fullBytes = fullBitmap.toJpeg(maxDimension = 1920, quality = 91)
        val focusBytes = focusBitmap.toJpeg(maxDimension = 1400, quality = 92)
        val connection = (URL("${BuildConfig.SCAN_API_URL}/v1/scans").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 40_000
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            setRequestProperty("X-Client-Platform", "android")
        }
        try {
            connection.outputStream.buffered().use { output ->
                output.writeImagePart(boundary, "image", "screen.jpg", fullBytes)
                output.writeImagePart(boundary, "focus", "product-focus.jpg", focusBytes)
                output.write("--$boundary--\r\n".toByteArray())
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(responseText).optString("message") }.getOrNull()
                throw ScanSearchException(message?.takeIf { it.isNotBlank() } ?: "상품 검색 서버 오류 ($status)")
            }
            parseResponse(responseText, focusBitmap)
        } finally {
            connection.disconnect()
        }
    }

    private fun parseResponse(json: String, croppedBitmap: Bitmap): ScanSearchResult {
        try {
            val root = JSONObject(json)
            val matchesJson = root.optJSONArray("matches")
            val matches = buildList {
                if (matchesJson == null) return@buildList
                for (index in 0 until matchesJson.length()) {
                    val item = matchesJson.optJSONObject(index) ?: continue
                    val title = item.optString("title").trim()
                    val source = item.optString("source").trim()
                    val url = item.optString("url").trim()
                    if (title.isBlank() || source.isBlank() || !isWebUrl(url)) continue
                    add(
                        ProductMatch(
                            id = item.optString("id", "match-$index"),
                            title = title,
                            source = source,
                            url = url,
                            imageUrl = item.optString("imageUrl").takeIf { isWebUrl(it) },
                            price = item.optString("price").trim().takeIf { it.isNotBlank() },
                            matchKind = item.optString("matchKind", "partial_image"),
                        ),
                    )
                }
            }
            return ScanSearchResult(
                scanId = root.optString("scanId").takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString(),
                queryLabel = root.optString("queryLabel", "검색한 상품").trim().ifBlank { "검색한 상품" },
                matches = matches,
                croppedBitmap = croppedBitmap,
            )
        } catch (error: JSONException) {
            throw ScanSearchException("검색 서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.", error)
        }
    }
}

private class ScanSearchException(message: String, cause: Throwable? = null) : Exception(message, cause)

private fun userFacingSearchError(error: Exception): Exception = when (error) {
    is ScanSearchException -> error
    is SocketTimeoutException -> ScanSearchException("검색 시간이 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.", error)
    is ConnectException, is UnknownHostException -> ScanSearchException("검색 서버에 연결할 수 없어요. PC와 휴대폰의 와이파이와 서버 실행 상태를 확인해 주세요.", error)
    else -> ScanSearchException(error.message?.takeIf { it.isNotBlank() } ?: "상품 검색을 완료하지 못했어요.", error)
}

private fun isWebUrl(value: String): Boolean = runCatching {
    URI(value).scheme?.lowercase() in setOf("http", "https")
}.getOrDefault(false)

private fun centeredSearchArea(width: Int, height: Int): Rect {
    val cropWidth = (width * .78f).toInt()
    val cropHeight = (height * .62f).toInt()
    val left = (width - cropWidth) / 2
    val top = max(0, (height - cropHeight) / 2)
    return Rect(left, top, left + cropWidth, top + cropHeight)
}

private fun Bitmap.scaleDown(maxDimension: Int): Bitmap {
    val largest = max(width, height)
    if (largest <= maxDimension) return this
    val ratio = maxDimension.toFloat() / largest
    return Bitmap.createScaledBitmap(this, (width * ratio).toInt(), (height * ratio).toInt(), true)
}

private fun Bitmap.toJpeg(maxDimension: Int, quality: Int): ByteArray = ByteArrayOutputStream().use { output ->
    val normalized = scaleDown(maxDimension)
    normalized.compress(Bitmap.CompressFormat.JPEG, quality, output)
    if (normalized !== this) normalized.recycle()
    output.toByteArray()
}

private fun OutputStream.writeImagePart(boundary: String, name: String, filename: String, bytes: ByteArray) {
    write("--$boundary\r\n".toByteArray())
    write("Content-Disposition: form-data; name=\"$name\"; filename=\"$filename\"\r\n".toByteArray())
    write("Content-Type: image/jpeg\r\n\r\n".toByteArray())
    write(bytes)
    write("\r\n".toByteArray())
}
