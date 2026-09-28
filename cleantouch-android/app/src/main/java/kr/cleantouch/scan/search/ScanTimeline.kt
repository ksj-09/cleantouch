package kr.cleantouch.scan.search

/** Include the last visible moment even when it falls between samples. */
fun scanTimeline(durationMs: Long, stepMs: Long = 2_000): List<Long> {
    require(stepMs > 0)
    if (durationMs <= 0) return emptyList()
    val last = (durationMs - 100).coerceAtLeast(0)
    return (generateSequence(0L) { it + stepMs }.takeWhile { it < last }.toList() + last).distinct()
}

/** Bound sampled scenes for new recordings while keeping the final scene. */
fun scanTimelineForSession(durationMs: Long, previousTotalFrames: Int, maxFrames: Int = 24): List<Long> {
    require(maxFrames >= 2)
    if (durationMs <= 0) return emptyList()
    val legacy = scanTimeline(durationMs)
    // An interrupted recording must retain its original timestamps so saved progress remains valid.
    if (previousTotalFrames > 0 && previousTotalFrames == legacy.size) return legacy
    val last = (durationMs - 100).coerceAtLeast(0)
    val intervals = (maxFrames - 1).toLong()
    val boundedStep = last / intervals + if (last % intervals == 0L) 0 else 1
    return scanTimeline(durationMs, maxOf(5_000L, boundedStep))
}
