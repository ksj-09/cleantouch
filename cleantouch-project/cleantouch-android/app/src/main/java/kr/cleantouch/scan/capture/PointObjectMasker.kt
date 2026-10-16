package kr.cleantouch.scan.capture

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.tasks.components.containers.NormalizedKeypoint
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.interactivesegmenter.InteractiveSegmenter
import com.google.mediapipe.tasks.vision.interactivesegmenter.InteractiveSegmenterOptions
import com.google.mediapipe.tasks.vision.interactivesegmenter.Stroke
import java.nio.ByteOrder
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Creates a transparent still containing the object beneath the user's tap. */
internal class PointObjectMasker(context: Context) : AutoCloseable {
    data class Selection(val bitmap: Bitmap, val bounds: Rect)
    private val appContext = context.applicationContext
    private var segmenter: InteractiveSegmenter? = null

    fun isolate(source: Bitmap, x: Float, y: Float): Bitmap? = isolateWithBounds(source, x, y)?.bitmap

    @Synchronized fun isolateWithBounds(source: Bitmap, x: Float, y: Float): Selection? {
        val regions = try { kr.cleantouch.scan.search.LocalSceneAnalyzer.productRegionsAt(appContext, source, x, y) }
        catch (error: Exception) { Log.w("CleanTouchMask", "Object detection failed", error); emptyList() }
        Log.d("CleanTouchMask", "Detected regions=$regions for ${source.width}x${source.height}")
        for (region in regions) {
            if (region.width() < MIN_OUTPUT_EDGE || region.height() < MIN_OUTPUT_EDGE) continue
            val padding = max(4, (max(region.width(), region.height()) * .35f).toInt())
            region.inset(-padding, -padding)
            region.intersect(0, 0, source.width, source.height)
            val crop = Bitmap.createBitmap(source, region.left, region.top, region.width(), region.height())
            try {
                val selected = try {
                    segment(crop, (x * source.width - region.left) / region.width(), (y * source.height - region.top) / region.height(), cropped = true)
                } catch (error: Exception) { Log.w("CleanTouchMask", "Object crop segmentation failed", error); null }
                if (selected != null) {
                    selected.bounds.offset(region.left, region.top)
                    return selected
                }
            } finally { if (crop !== source) crop.recycle() }
        }
        return segment(source, x, y)
    }

    private fun segment(source: Bitmap, x: Float, y: Float, cropped: Boolean = false): Selection? {
        val task = segmenter ?: run {
            val base = BaseOptions.builder().setModelAssetPath(MODEL_ASSET).build()
            InteractiveSegmenter.createFromOptions(
                appContext,
                InteractiveSegmenterOptions.builder().setBaseOptions(base).build(),
            ).also { segmenter = it }
        }

        // MPImage owns/recycles its bitmap when closed; retain the source for the final crop.
        // Keep native segmentation and GrabCut allocations independent of screen resolution.
        val ratio = min(1f, 512f / max(source.width, source.height))
        val working = Bitmap.createScaledBitmap(source, max(1, (source.width * ratio).toInt()), max(1, (source.height * ratio).toInt()), true)
        val input = BitmapImageBuilder(working.copy(Bitmap.Config.ARGB_8888, false)).build()
        if (working !== source) working.recycle()
        try {
        task.setImage(input)
        val stroke = Stroke.builder()
            .setBrushMode(Stroke.BrushMode.POSITIVE)
            .setPoints(listOf(NormalizedKeypoint.create(x.coerceIn(0f, 1f), y.coerceIn(0f, 1f))))
            .setCompleted(true)
            .build()
        val strokes = mutableListOf(stroke)
        if (cropped) {
            val tapColor = source.getPixel((x * source.width).toInt().coerceIn(0, source.width - 1), (y * source.height).toInt().coerceIn(0, source.height - 1))
            // Contrasting crop corners provide background prompts so a worn item can be
            // separated from its wearer. Similar-color corners remain unconstrained.
            for ((nx, ny) in listOf(.02f to .02f, .98f to .02f, .02f to .98f, .98f to .98f)) {
                val color = source.getPixel((nx * source.width).toInt().coerceIn(0, source.width - 1), (ny * source.height).toInt().coerceIn(0, source.height - 1))
                val distance = kotlin.math.abs(Color.red(color) - Color.red(tapColor)) +
                    kotlin.math.abs(Color.green(color) - Color.green(tapColor)) + kotlin.math.abs(Color.blue(color) - Color.blue(tapColor))
                if (distance > 300 && kotlin.math.abs(nx - x) + kotlin.math.abs(ny - y) > .5f) {
                    strokes += Stroke.builder().setBrushMode(Stroke.BrushMode.NEGATIVE)
                        .setPoints(listOf(NormalizedKeypoint.create(nx, ny))).setCompleted(true).build()
                }
            }
        }
        val mask = task.segment(strokes)
        try {
        val width = mask.width
        val height = mask.height
        if (width <= 0 || height <= 0) return null
        var values = ByteBufferExtractor.extract(mask)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
            .let { buffer -> FloatArray(width * height).also { buffer.rewind(); buffer.get(it) } }

        if (cropped) values = MaskRefiner.refine(source, values, width, height, x, y)
        val connected = TapMask.extract(values, width, height, x, y, cropped)
        Log.d("CleanTouchMask", "Mask ${width}x$height cropped=$cropped selected=${connected != null} range=${values.minOrNull()}..${values.maxOrNull()} foreground=${values.count { it >= .45f }}")
        if (connected == null) return null

        val scaleX = source.width.toFloat() / width
        val scaleY = source.height.toFloat() / height
        val imageBounds = Rect(
            floor(connected.left * scaleX).toInt(),
            floor(connected.top * scaleY).toInt(),
            ceil((connected.right + 1) * scaleX).toInt(),
            ceil((connected.bottom + 1) * scaleY).toInt(),
        )
        val margin = max(4, (max(imageBounds.width(), imageBounds.height()) * CROP_MARGIN).toInt())
        imageBounds.inset(-margin, -margin)
        imageBounds.intersect(0, 0, source.width, source.height)
        if (imageBounds.width() < MIN_OUTPUT_EDGE || imageBounds.height() < MIN_OUTPUT_EDGE) return null

        val original = IntArray(imageBounds.width() * imageBounds.height())
        source.getPixels(original, 0, imageBounds.width(), imageBounds.left, imageBounds.top, imageBounds.width(), imageBounds.height())
        val output = IntArray(imageBounds.width() * imageBounds.height())
        for (py in 0 until imageBounds.height()) {
            val sourceY = imageBounds.top + py
            val maskY = ((sourceY + .5f) / scaleY).toInt().coerceIn(0, height - 1)
            for (px in 0 until imageBounds.width()) {
                val sourceX = imageBounds.left + px
                val maskX = ((sourceX + .5f) / scaleX).toInt().coerceIn(0, width - 1)
                val maskIndex = maskY * width + maskX
                if (!connected.pixels[maskIndex]) continue
                val color = original[py * imageBounds.width() + px]
                output[py * imageBounds.width() + px] = Color.argb(
                    255, Color.red(color), Color.green(color), Color.blue(color),
                )
            }
        }
        val outputBitmap = Bitmap.createBitmap(imageBounds.width(), imageBounds.height(), Bitmap.Config.ARGB_8888).also {
            it.setPixels(output, 0, imageBounds.width(), 0, 0, imageBounds.width(), imageBounds.height())
        }
        return Selection(outputBitmap, imageBounds)
        } finally { mask.close() }
        } finally { input.close() }
    }

    @Synchronized override fun close() {
        segmenter?.close()
        segmenter = null
    }

    private companion object {
        const val MODEL_ASSET = "interactive_segmentation.task"
        const val MIN_OUTPUT_EDGE = 20
        const val CROP_MARGIN = 0.035f
    }
}
