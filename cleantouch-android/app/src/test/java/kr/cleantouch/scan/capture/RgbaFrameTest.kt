package kr.cleantouch.scan.capture

import java.nio.ByteBuffer
import org.junit.Assert.*
import org.junit.Test

class RgbaFrameTest {
    @Test fun finalRowWithoutPaddingCopiesRealPixels() {
        val buffer = ByteBuffer.wrap(byteArrayOf(1,2,3,4,5,6,7,8,99,99,99,99,9,10,11,12,13,14,15,16))
        assertArrayEquals(ByteArray(16) { (it + 1).toByte() }, RgbaFrame.copyPixels(buffer, 2, 2, 12, 4))
        assertEquals(0, buffer.position())
    }
    @Test fun nonzeroBufferPositionAndPixelPaddingAreRespected() {
        val buffer = ByteBuffer.wrap(byteArrayOf(99,1,2,3,4,99,99,99,99,5,6,7,8))
        buffer.position(1)
        assertArrayEquals(ByteArray(8) { (it + 1).toByte() }, RgbaFrame.copyPixels(buffer, 2, 1, 12, 8))
        assertEquals(1, buffer.position())
    }
    @Test(expected = IllegalArgumentException::class) fun incompleteFrameIsRejected() {
        RgbaFrame.copyPixels(ByteBuffer.allocate(7), 2, 1, 8, 4)
    }
}
