package kr.cleantouch.scan.capture

import android.graphics.Bitmap
import android.media.Image

internal fun Image.toBitmap(cropWidth: Int, cropHeight: Int): Bitmap {
    val plane = planes[0]
    val pixelStride = plane.pixelStride
    val rowStride = plane.rowStride
    val rowPadding = rowStride - pixelStride * width
    val padded = Bitmap.createBitmap(width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888)
    plane.buffer.rewind()
    padded.copyPixelsFromBuffer(plane.buffer)
    val cropped = Bitmap.createBitmap(padded, 0, 0, cropWidth.coerceAtMost(width), cropHeight.coerceAtMost(height))
    if (cropped !== padded) padded.recycle()
    return cropped
}
