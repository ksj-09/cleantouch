package kr.cleantouch.scan.search

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

class ScanRateLimitException(message: String, val retryAfterSeconds: Long? = null, val dailyLimit: Boolean = false) : IllegalStateException(message) {
    // Older servers do not include Retry-After; use a conservative, bounded fallback.
    val waitMs get() = (retryAfterSeconds ?: 60L).coerceIn(1L, Long.MAX_VALUE / 1_000L) * 1_000L
}

/** Retry the same unfinished scene, without counting a rejected request as progress. */
internal suspend fun <T> retryRateLimited(request: suspend () -> T, wait: suspend (Long) -> Unit): T {
    var retries = 0
    while (true) {
        currentCoroutineContext().ensureActive()
        try { return request() }
        catch (error: ScanRateLimitException) {
            currentCoroutineContext().ensureActive()
            // Long/daily limits need an explicit later resume, not an endless background loop.
            if (error.dailyLimit || error.waitMs > 120_000L || retries >= 2) throw error
            retries += 1
            wait(error.waitMs)
        }
    }
}
