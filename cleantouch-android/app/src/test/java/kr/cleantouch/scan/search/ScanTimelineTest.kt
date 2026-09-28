package kr.cleantouch.scan.search

import org.junit.Assert.assertEquals
import org.junit.Test

class ScanTimelineTest {
    @Test fun coversFinalMomentWithoutTenSecondLimit() {
        assertEquals(listOf(0L, 2_000L, 4_000L, 6_000L, 8_000L, 10_000L, 12_000L, 12_245L), scanTimeline(12_345))
    }
    @Test fun shortAndEmptyRecordingsDoNotDuplicateFrames() {
        assertEquals(emptyList<Long>(), scanTimeline(0))
        assertEquals(listOf(0L), scanTimeline(90))
        assertEquals(listOf(0L, 1_900L), scanTimeline(2_000))
        assertEquals(listOf(0L, 2_000L), scanTimeline(2_100))
    }
    @Test fun newRecordingsBoundGeminiRequestsAndKeepTheLastScene() {
        val frames = scanTimelineForSession(154_000, 0)
        assertEquals(24, frames.size)
        assertEquals(0L, frames.first())
        assertEquals(153_900L, frames.last())
    }
    @Test fun interruptedRecordingsKeepTheirOriginalTimestamps() {
        val legacy = scanTimeline(154_000)
        assertEquals(78, legacy.size)
        assertEquals(legacy, scanTimelineForSession(154_000, legacy.size))
    }
}
