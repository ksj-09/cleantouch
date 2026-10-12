package kr.cleantouch.scan.capture

import android.graphics.Bitmap
import android.os.SystemClock
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions

/** Bundled recognition; no upload and at most one small bitmap in flight. */
class ScreenPlaybackObserver(private val timeline: WatchTimeline) : AutoCloseable {
    private val recognizer = TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
    var busy = false
        private set
    private var closed = false
    fun observe(source: Bitmap) {
        if (busy || closed) return
        busy = true
        var owned: Bitmap? = null
        try {
        val scale = minOf(1f, 960f / maxOf(source.width, source.height))
        val bitmap = Bitmap.createScaledBitmap(source, (source.width * scale).toInt().coerceAtLeast(1), (source.height * scale).toInt().coerceAtLeast(1), true)
            .let { if (it === source) source.copy(Bitmap.Config.ARGB_8888, false) else it }
        owned = bitmap
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener { if (!closed) timeline.observe(WatchTimeline.parse(it.text), SystemClock.uptimeMillis()) }
            .addOnCompleteListener { bitmap.recycle(); busy = false }
        } catch (error: Exception) { owned?.recycle(); busy = false; android.util.Log.w("CleanTouchTime", "Time recognition skipped", error) }
        catch (error: OutOfMemoryError) { owned?.recycle(); busy = false; android.util.Log.w("CleanTouchTime", "Time recognition skipped: memory") }
    }
    override fun close() { closed = true; recognizer.close() }
}
