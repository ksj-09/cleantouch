package kr.cleantouch.scan

import android.content.Intent
import android.graphics.BitmapFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import kr.cleantouch.scan.capture.PointObjectMasker
import kr.cleantouch.scan.capture.FloatingScanService
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.Assume.assumeTrue
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class MobileFlowTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext

    @Test fun liveWidgetSelectsProductAndLaunchesLens() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("lens") == "true")
        val device = UiDevice.getInstance(instrumentation)
        device.executeShellCommand("appops set ${context.packageName} SYSTEM_ALERT_WINDOW allow")
        device.executeShellCommand("pm grant ${context.packageName} android.permission.POST_NOTIFICATIONS")
        ScanSessionStore.initialize(context)
        ScanSessionStore.update { it.copy(phase = ScanPhase.PAUSED, captureActive = false) }
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        device.wait(Until.findObject(By.text("눌러서 스캔 시작")), 60000).click()
        device.wait(Until.findObject(By.text("동의하고 시작")), 5000).click()
        val consent = device.wait(Until.findObject(By.res("android", "button1")), 10000)
            ?: device.wait(Until.findObject(By.textContains("Start")), 5000)
        assertNotNull("Android screen-sharing consent must appear", consent)
        consent.click()
        try {
            assertNotNull(device.wait(Until.findObject(By.desc("CleanTouch 상품 찾기")), 10000))
            instrumentation.context.startActivity(Intent().setClassName(instrumentation.context.packageName, VideoFixtureActivity::class.java.name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            Thread.sleep(4000)
            device.wait(Until.findObject(By.desc("CleanTouch 상품 찾기")), 5000).click()
            device.wait(Until.findObject(By.text("현재 화면에서 상품 터치")), 5000).click()
            assertTrue("Entering selection must keep the scan active", ScanSessionStore.state.value.captureActive)
            assertNotNull(device.wait(Until.findObject(By.text("찾을 상품을 한 번 누르세요")), 10000))
            device.wait(Until.findObject(By.text("취소")), 5000).click()
            assertNotNull("Cancel must restore the floating button", device.wait(Until.findObject(By.desc("CleanTouch 상품 찾기")), 10000))
            assertTrue("Cancel must keep screen sharing active", ScanSessionStore.state.value.captureActive)
            device.wait(Until.findObject(By.desc("CleanTouch 상품 찾기")), 5000).click()
            device.wait(Until.findObject(By.text("현재 화면에서 상품 터치")), 5000).click()
            assertNotNull(device.wait(Until.findObject(By.text("찾을 상품을 한 번 누르세요")), 5000))
            device.click((device.displayWidth * .58).toInt(), (device.displayHeight * .57).toInt())
            val lensButton = device.wait(Until.findObject(By.text("Google Lens에서 정보 · 구매처 찾기")), 180000)
            assertNotNull("Tap must reach the marked-product confirmation", lensButton)
            device.takeScreenshot(File(context.filesDir, "marked-product.png"))
            lensButton.click()
            assertNotNull("Visible overlay click must open Lens Activity", device.wait(Until.findObject(By.text("Google Lens · 비슷한 상품")), 30000))
            assertTrue("Video scene should be collected before selection", ScanSessionStore.state.value.scenes.isNotEmpty())
            device.pressBack()
        } finally { FloatingScanService.stop(context); Thread.sleep(1000) }
    }

    @Test fun lensUploadsFixtureWithoutManualFileSelection() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("lens") == "true")
        val folder = File(context.filesDir, "sessions/lens-integration").apply { mkdirs() }
        val file = File(folder, "product.png")
        instrumentation.context.assets.open("bag.png").use { input -> file.outputStream().use { input.copyTo(it) } }
        val uri = androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val activity = instrumentation.startActivitySync(Intent(context, LensSearchActivity::class.java).apply {
            putExtra(LensSearchActivity.EXTRA_IMAGE_URI, uri.toString())
            putExtra(LensSearchActivity.EXTRA_IMAGE_MIME_TYPE, "image/png")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        fun findWeb(view: android.view.View): android.webkit.WebView? {
            if (view is android.webkit.WebView) return view
            if (view is android.view.ViewGroup) for (i in 0 until view.childCount) findWeb(view.getChildAt(i))?.let { return it }
            return null
        }
        var url = ""
        try {
            val deadline = System.currentTimeMillis() + 45000
            while (System.currentTimeMillis() < deadline) {
                instrumentation.runOnMainSync { url = findWeb(activity.window.decorView)?.url.orEmpty() }
                if (url.contains("/search?") || url.contains("/sorry/")) {
                    val ready = java.util.concurrent.atomic.AtomicBoolean(false)
                    val latch = java.util.concurrent.CountDownLatch(1)
                    instrumentation.runOnMainSync { findWeb(activity.window.decorView)?.evaluateJavascript("document.readyState === 'complete' && document.body.innerText.length > 120") { ready.set(it == "true"); latch.countDown() } }
                    latch.await(2, java.util.concurrent.TimeUnit.SECONDS)
                    if (ready.get()) break
                }
                Thread.sleep(500)
            }
            instrumentation.runOnMainSync {
                findWeb(activity.window.decorView)?.evaluateJavascript("JSON.stringify({title:document.title,text:document.body.innerText.slice(0,1800),inputs:[...document.querySelectorAll('input')].map(e=>e.type)})") { android.util.Log.i("CleanTouchTest", "Lens page: $it") }
            }
            Thread.sleep(500)
            UiDevice.getInstance(instrumentation).takeScreenshot(File(context.filesDir, "lens-integration.png"))
            android.util.Log.i("CleanTouchTest", "Lens final URL: $url")
            assertTrue("Lens must navigate to results or Google's verification page; actual=$url", url.contains("/search?") || url.contains("/sorry/"))
        } finally { instrumentation.runOnMainSync { activity.finish() } }
    }

    @Test fun firstScreenAlwaysOffersRoundStartButton() {
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        val device = UiDevice.getInstance(instrumentation)
        assertNotNull(device.wait(Until.findObject(By.text("눌러서 스캔 시작")), 60000))
        assertNotNull(device.findObject(By.text("OFF")))
        device.takeScreenshot(File(context.filesDir, "dashboard-contrast.png"))
    }

    @Test fun tapMaskRetainsSourceAndExtractsObject() {
        val bitmap = instrumentation.context.assets.open("bag.png").use { BitmapFactory.decodeStream(it) }
        val masker = PointObjectMasker(context)
        try {
            val result = masker.isolateWithBounds(bitmap, .58f, .57f)
            assertNotNull("Point segmentation must produce a bag mask", result)
            File(context.filesDir, "bag-mask.png").outputStream().use {
                result!!.bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            android.util.Log.i("CleanTouchMask", "Selected bounds=${result!!.bounds}")
            assertFalse("MPImage close must not recycle caller's bitmap", bitmap.isRecycled)
            assertTrue(result!!.bounds.width() < bitmap.width)
            assertTrue(result.bounds.height() < bitmap.height)
            assertTrue("Bag selection must exclude most of the person", result.bounds.height() < bitmap.height * .6f)
            fun selectedAt(px: Int, py: Int): Boolean = result.bounds.contains(px, py) &&
                (result.bitmap.getPixel(px - result.bounds.left, py - result.bounds.top) ushr 24) > 32
            assertTrue("Tapped bag must remain selected", selectedAt(215, 427))
            assertFalse("White sleeve must be excluded from the bag", selectedAt(150, 350))
            assertFalse("Wearer's face must be excluded", selectedAt(175, 170))
            assertFalse("Wearer's hair must be excluded", selectedAt(250, 300))
            val pixels = IntArray(result.bitmap.width * result.bitmap.height)
            result.bitmap.getPixels(pixels, 0, result.bitmap.width, 0, 0, result.bitmap.width, result.bitmap.height)
            val opaque = pixels.count { (it ushr 24) > 32 }
            assertTrue("Mask must contain visible product pixels", opaque > pixels.size * .1)
            assertTrue("Mask must remove the background instead of returning a rectangle", opaque < pixels.size * .9)
            File(context.filesDir, "bag-mask.png").outputStream().use {
                result.bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it)
            }
            result.bitmap.recycle()
        } finally { masker.close(); bitmap.recycle() }
    }

    @Test fun allScenesAnalyzeLocallyAndMergeRepeatedProducts() = runBlocking {
        ScanSessionStore.initialize(context)
        ScanSessionStore.update { it.copy(phase = ScanPhase.PAUSED) }
        val session = ScanSessionStore.begin()
        val image = File(session.directory, "fixture.png")
        instrumentation.context.assets.open("bag.png").use { input -> image.outputStream().use { input.copyTo(it) } }
        ScanSessionStore.update { it.copy(phase = ScanPhase.PAUSED, scenes = listOf(CapturedScene(0, image.absolutePath), CapturedScene(3000, image.absolutePath))) }
        LocalSceneAnalyzer(context).analyze()
        val result = ScanSessionStore.state.value
        assertEquals(ScanPhase.COMPLETE, result.phase)
        assertEquals(setOf(0L, 3000L), result.completedFrames)
        assertTrue("Expected at least one supported product in fixture", result.products.isNotEmpty())
        assertTrue(result.products.all { it.sightings == listOf(0L, 3000L) })
    }
}
