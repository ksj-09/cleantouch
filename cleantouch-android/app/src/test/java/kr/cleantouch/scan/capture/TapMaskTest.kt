package kr.cleantouch.scan.capture

import org.junit.Assert.*
import org.junit.Test

class TapMaskTest {
    @Test fun faintTappedObjectSurvivesWithoutDisconnectedBackground() {
        val values = FloatArray(100 * 100)
        for (y in 40..60) for (x in 40..60) values[y * 100 + x] = .35f
        for (y in 0..20) for (x in 0..20) values[y * 100 + x] = .95f
        val mask = TapMask.extract(values, 100, 100, .5f, .5f)!!
        assertTrue(mask.pixels[50 * 100 + 50])
        assertFalse(mask.pixels[10 * 100 + 10])
        assertEquals(40, mask.left)
        assertEquals(60, mask.right)
    }

    @Test fun wholeFrameAndNoiseDoNotBecomeProducts() {
        assertNull(TapMask.extract(FloatArray(10000) { .9f }, 100, 100, .5f, .5f))
        val noise = FloatArray(10000)
        noise[5050] = .9f
        assertNull(TapMask.extract(noise, 100, 100, .5f, .5f))
        assertNull(TapMask.extract(FloatArray(10000) { Float.NaN }, 100, 100, .5f, .5f))
    }

    @Test fun objectSpanningCropEdgesIsNotConfusedWithWholeFrame() {
        val values = FloatArray(10000)
        for (y in 0..99) for (x in maxOf(0, y - 10)..minOf(99, y + 10)) values[y * 100 + x] = .8f
        assertNotNull(TapMask.extract(values, 100, 100, .5f, .5f, cropped = true))
        assertNull(TapMask.extract(FloatArray(10000) { .9f }, 100, 100, .5f, .5f, cropped = true))
    }
}
