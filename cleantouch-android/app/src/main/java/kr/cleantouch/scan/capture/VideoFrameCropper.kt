package kr.cleantouch.scan.capture

import android.graphics.Bitmap
import android.graphics.Rect
import kotlin.math.max

data class VideoCrop(val bounds: Rect, val confident: Boolean)
/** Local-only letterbox detection. Uncertain portrait/app boundaries require preview confirmation. */
object VideoFrameCropper {
    fun find(bitmap: Bitmap, topInset: Int = 0, bottomInset: Int = 0): VideoCrop {
        val width = bitmap.width; val height = bitmap.height
        val top = topInset.coerceIn(0, height / 8)
        val bottom = (height - bottomInset.coerceIn(0, height / 8)).coerceAtLeast(top + 1)
        fun blackRow(y: Int): Boolean {
            var black = 0
            for (i in 0 until 40) {
                val pixel = bitmap.getPixel(((i + .5f) * width / 40).toInt().coerceIn(0, width-1), y)
                if (((pixel shr 16) and 255) < 24 && ((pixel shr 8) and 255) < 24 && (pixel and 255) < 24) black++
            }
            return black >= 38
        }
        var first = top; var last = bottom - 1
        while (first < last && blackRow(first)) first++
        while (last > first && blackRow(last)) last--
        val enough = last - first > height / 5 && first - top > height / 12 && bottom - last > height / 12
        return if (enough) VideoCrop(Rect(0,first,width,last+1),true)
        else VideoCrop(Rect(0,top,width,max(top+1,bottom)),false)
    }
}
