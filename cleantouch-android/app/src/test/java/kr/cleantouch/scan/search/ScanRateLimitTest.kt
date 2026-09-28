package kr.cleantouch.scan.search

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ScanRateLimitTest {
    @Test fun waitsForProviderThenRetriesTheSameUnfinishedScene() = runBlocking {
        var requests = 0
        val waits = mutableListOf<Long>()
        val result = retryRateLimited(request = {
            requests += 1
            if (requests == 1) throw ScanRateLimitException("분당 한도", 30)
            "third scene result"
        }, wait = { waits += it })
        assertEquals("third scene result", result)
        assertEquals(2, requests)
        assertEquals(listOf(30_000L), waits)
    }

    @Test fun repeatedLimitsStopAfterTwoRetries() {
        var requests = 0
        val waits = mutableListOf<Long>()
        assertThrows(ScanRateLimitException::class.java) {
            runBlocking {
                retryRateLimited(request = { requests += 1; throw ScanRateLimitException("한도", 30) }, wait = { waits += it })
            }
        }
        assertEquals(3, requests)
        assertEquals(listOf(30_000L, 30_000L), waits)
    }

    @Test fun dailyAndLongLimitsDoNotStartAutomaticRetryLoops() {
        for (error in listOf(ScanRateLimitException("하루 한도", 30, true), ScanRateLimitException("긴 대기", 121))) {
            var requests = 0
            val waits = mutableListOf<Long>()
            assertThrows(ScanRateLimitException::class.java) {
                runBlocking { retryRateLimited(request = { requests += 1; throw error }, wait = { waits += it }) }
            }
            assertEquals(1, requests)
            assertEquals(emptyList<Long>(), waits)
        }
    }

    @Test fun olderServerWithoutWaitUsesSixtySeconds() = runBlocking {
        var requests = 0
        val waits = mutableListOf<Long>()
        retryRateLimited(request = {
            requests += 1
            if (requests == 1) throw ScanRateLimitException("한도")
        }, wait = { waits += it })
        assertEquals(listOf(60_000L), waits)
        assertEquals(2, requests)
    }

    @Test fun cancellingTheWaitPreventsAnotherRequest() {
        var requests = 0
        assertThrows(CancellationException::class.java) {
            runBlocking {
                retryRateLimited(request = { requests += 1; throw ScanRateLimitException("한도", 30) },
                    wait = { throw CancellationException("user stopped analysis") })
            }
        }
        assertEquals(1, requests)
    }

    @Test fun ordinaryNetworkErrorsAreNotTreatedAsQuotas() {
        var requests = 0
        assertThrows(IllegalStateException::class.java) {
            runBlocking {
                retryRateLimited(request = { requests += 1; error("offline") }, wait = { error("must not wait") })
            }
        }
        assertEquals(1, requests)
    }
}
