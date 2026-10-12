package kr.cleantouch.scan.capture

data class VideoStamp(val key: String, val number: Int, val positionMs: Long, val estimated: Boolean)
data class PlaybackSignal(val identity: String = "", val positionMs: Long? = null, val paused: Boolean? = null, val rewindMs: Long? = null, val screenObserved: Boolean = false)

/** Evidence-based local clock. Ordinary scene changes never reset it. */
class WatchTimeline {
    private var lastAt: Long? = null
    private var position = 0L
    private var paused = false
    private var estimated = true
    private var key = "watch-1"
    private var number = 1
    private var identified = false
    private var pending = ""
    private var confirmations = 0
    private var rewind: Long? = null
    private val history = mutableMapOf<String, Pair<Long, Int>>()
    private var nextNumber = 1
    private var previousAnchor: Long? = null
    private var repeatedAnchor = 0

    @Synchronized fun observe(signal: PlaybackSignal = PlaybackSignal(), now: Long): VideoStamp {
        lastAt?.let { if (!paused) { position += (now - it).coerceIn(0, 5000); estimated = true } }
        lastAt = now
        if (signal.identity.isNotBlank()) {
            if (!identified) { key = signal.identity; identified = true }
            else if (signal.identity != key) {
                if (pending == signal.identity) confirmations++ else { pending = signal.identity; confirmations = 1 }
                if (confirmations >= 3) {
                    history[key] = position to number; key = signal.identity
                    val prior = history[key]; number = prior?.second ?: ++nextNumber
                    position = prior?.first ?: 0; paused = false; estimated = true; confirmations = 0; pending = ""
                    previousAnchor = null; repeatedAnchor = 0
                }
            } else { pending = ""; confirmations = 0 }
        }
        signal.paused?.let { paused = it }
        signal.positionMs?.takeIf { it >= 0 }?.let {
            if (previousAnchor == it) repeatedAnchor++ else { repeatedAnchor = 0; if (signal.paused == null) paused = false }
            if (repeatedAnchor >= 2 && signal.paused == null) paused = true
            previousAnchor = it; position = it; estimated = false
        }
            ?: signal.rewindMs?.takeIf { it != rewind }?.let { position = (position - it).coerceAtLeast(0); estimated = true }
        if (signal.screenObserved) rewind = signal.rewindMs
        return VideoStamp(key, number, position, estimated)
    }

    companion object {
        fun parse(text: String): PlaybackSignal {
            fun milliseconds(value: String) = value.split(':').fold(0L) { total, part -> total * 60 + part.toLong() } * 1000
            val pair = Regex("\\b(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*/\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)\\b").find(text)
            val position = pair?.takeIf { p -> p.groupValues.drop(1).all { it.split(':').drop(1).all { part -> part.toInt() < 60 } } }
                ?.takeIf { milliseconds(it.groupValues[1]) <= milliseconds(it.groupValues[2]) }?.let { milliseconds(it.groupValues[1]) }
            val match = Regex("@[\\w.\\-]{3,}").find(text)
            val caption = match?.let { text.substring(it.range.last + 1).lines().take(3).firstOrNull { line -> Regex("#[\\w가-힣]{2,}").containsMatchIn(line) }?.trim()?.take(100) }.orEmpty()
            val handle = match?.value.orEmpty() + if (caption.isNotBlank()) ":$caption" else ""
            val rewind = Regex("(?:rewind|backward|뒤로|되감기)\\s*(\\d{1,3})\\s*(?:seconds?|sec|초|s)(?=$|\\s|[.,])", RegexOption.IGNORE_CASE).find(text)?.groupValues?.get(1)?.toLong()?.times(1000)
            val paused = when {
                Regex("(?im)^\\s*(paused|일시정지됨|재생 중지)\\s*$").containsMatchIn(text) -> true
                Regex("(?im)^\\s*(playing|재생 중)\\s*$").containsMatchIn(text) -> false
                else -> null
            }
            return PlaybackSignal(handle, position, paused, rewind, true)
        }
    }
}
