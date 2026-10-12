package kr.cleantouch.scan.capture

import android.graphics.Bitmap
import android.graphics.Color
import org.opencv.android.OpenCVLoader
import org.opencv.android.Utils
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.Rect
import org.opencv.imgproc.Imgproc
import kotlin.math.*

/** Refines an AI foreground mask at visible image edges using tap/background seeds. */
internal object MaskRefiner {
    private val loaded by lazy { OpenCVLoader.initLocal() }

    fun refine(source: Bitmap, values: FloatArray, width: Int, height: Int, x: Float, y: Float): FloatArray {
        check(loaded) { "Image boundary engine could not be loaded" }
        val scaled = Bitmap.createScaledBitmap(source, width, height, true)
        val rgba = Mat(); val rgb = Mat(); val mask = Mat(height, width, CvType.CV_8UC1)
        val background = Mat(); val foreground = Mat()
        try {
            Utils.bitmapToMat(scaled, rgba)
            Imgproc.cvtColor(rgba, rgb, Imgproc.COLOR_RGBA2RGB)
            val pixels = IntArray(width * height)
            scaled.getPixels(pixels, 0, width, 0, 0, width, height)
            val cx = (x * width).toInt().coerceIn(0, width - 1)
            val cy = (y * height).toInt().coerceIn(0, height - 1)
            val tapped = pixels[cy * width + cx]
            val radius = max(2, (min(width, height) * .025f).toInt())
            val labels = ByteArray(values.size)
            for (py in 0 until height) for (px in 0 until width) {
                val index = py * width + px; val color = pixels[index]
                val difference = abs(Color.red(color) - Color.red(tapped)) +
                    abs(Color.green(color) - Color.green(tapped)) + abs(Color.blue(color) - Color.blue(tapped))
                val nearTap = (px - cx).toLong().let { it * it } + (py - cy).toLong().let { it * it } <= radius * radius
                labels[index] = when {
                    nearTap && difference < 120 -> Imgproc.GC_FGD
                    px == 0 || py == 0 || px == width - 1 || py == height - 1 -> Imgproc.GC_BGD
                    !values[index].isFinite() || values[index] < .1f || difference > 300 -> Imgproc.GC_BGD
                    values[index] >= .2f && difference < 110 &&
                        hypot((px - cx).toFloat() / width, (py - cy).toFloat() / height) < .35f -> Imgproc.GC_PR_FGD
                    else -> Imgproc.GC_PR_BGD
                }.toByte()
            }
            mask.put(0, 0, labels)
            Imgproc.grabCut(rgb, mask, Rect(), background, foreground, 3, Imgproc.GC_INIT_WITH_MASK)
            mask.get(0, 0, labels)
            return FloatArray(values.size) { if (labels[it].toInt() == Imgproc.GC_FGD || labels[it].toInt() == Imgproc.GC_PR_FGD) 1f else 0f }
        } finally {
            rgba.release(); rgb.release(); mask.release(); background.release(); foreground.release()
            if (scaled !== source) scaled.recycle()
        }
    }
}
