package kr.cleantouch.scan.capture

import java.nio.ByteBuffer

/** ImageReader may omit the padding after the final row. Copy only actual RGBA pixels. */
internal object RgbaFrame {
    fun copyPixels(input: ByteBuffer, width: Int, height: Int, rowStride: Int, pixelStride: Int): ByteArray {
        require(width > 0 && height > 0 && pixelStride >= 4)
        require(rowStride.toLong() >= (width - 1L) * pixelStride + 4)
        val bytes = width.toLong() * height * 4
        require(bytes <= Int.MAX_VALUE)
        val buffer = input.duplicate()
        val start = buffer.position()
        val needed = start.toLong() + (height - 1L) * rowStride + (width - 1L) * pixelStride + 4
        require(needed <= buffer.limit()) { "Incomplete screen frame" }
        val output = ByteArray(bytes.toInt())
        for (y in 0 until height) {
            val row = start + y * rowStride
            if (pixelStride == 4) {
                buffer.position(row)
                buffer.get(output, y * width * 4, width * 4)
            } else {
                for (x in 0 until width) for (channel in 0..3) {
                    output[(y * width + x) * 4 + channel] = buffer.get(row + x * pixelStride + channel)
                }
            }
        }
        return output
    }
}
