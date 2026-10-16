package kr.cleantouch.scan.capture
import org.junit.Assert.*
import org.junit.Test
class WatchTimelineTest {
    @Test fun pauseResumeSeek() {
        val timer = WatchTimeline()
        timer.observe(PlaybackSignal(positionMs=83000),0)
        assertEquals(84000L,timer.observe(PlaybackSignal(paused=true),1000).positionMs)
        assertEquals(84000L,timer.observe(now=2000).positionMs)
        timer.observe(PlaybackSignal(paused=false),3000)
        assertEquals(12000L,timer.observe(PlaybackSignal(positionMs=12000),4000).positionMs)
    }
    @Test fun transitionRequiresStableEvidenceAndReturnsToPreviousVideo() {
        val timer=WatchTimeline();timer.observe(PlaybackSignal(identity="a",positionMs=20000),0)
        timer.observe(PlaybackSignal(identity="b"),100);timer.observe(now=200)
        timer.observe(PlaybackSignal(identity="b"),300);timer.observe(now=400)
        assertEquals(0L,timer.observe(PlaybackSignal(identity="b"),500).positionMs)
        for (now in listOf(600L,700L,800L)) timer.observe(PlaybackSignal(identity="a"),now)
        assertTrue(timer.observe(now=800).positionMs>=20000)
    }
    @Test fun parseOnlyExplicitPlaybackEvidence() {
        assertEquals(83000L,WatchTimeline.parse("1:23 / 4:00").positionMs)
        assertNull(WatchTimeline.parse("12:34\n99:99 / 99:99").positionMs)
        assertEquals(true,WatchTimeline.parse("일시정지됨").paused)
        assertEquals(10000L,WatchTimeline.parse("뒤로 10초").rewindMs)
    }
}
