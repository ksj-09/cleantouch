package kr.cleantouch.scan

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Rect
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import kr.cleantouch.scan.capture.VideoFrameCropper
import kr.cleantouch.scan.search.PlaceChatActivity
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class PlaceChatTest {
    @Test fun publicPlaceChatSupportsImageAndFollowUp(){
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        org.junit.Assume.assumeTrue(InstrumentationRegistry.getArguments().getString("livePlace")=="true")
        val context=instrumentation.targetContext
        val file=File(context.filesDir,"sessions/place-demo/scene.jpg")
        assertTrue("Provide a real video-only fixture",file.exists())
        val activity=instrumentation.startActivitySync(Intent(context,PlaceChatActivity::class.java).putExtra("scene",file.absolutePath).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        try{
            val device=UiDevice.getInstance(instrumentation)
            device.wait(Until.findObject(By.text("이 영상 영역으로 장소 분석")),10000)?.click()
            val field=device.wait(Until.findObject(By.clazz("android.widget.EditText").enabled(true)),65000)
            assertNotNull("Initial AI response must enable follow-up",field)
            field!!.text="정확한 위치를 확인하려면 어떤 단서가 필요해?"
            device.wait(Until.findObject(By.text("전송").enabled(true)),5000)!!.click()
            assertNotNull(device.wait(Until.findObject(By.clazz("android.widget.EditText").enabled(false)),5000))
            assertNotNull("Follow-up AI response",device.wait(Until.findObject(By.clazz("android.widget.EditText").enabled(true)),65000))
            device.takeScreenshot(File(context.filesDir,"place-chat-live.png"))
        }finally{val device=UiDevice.getInstance(instrumentation);device.takeScreenshot(File(context.filesDir,"place-chat-live.png"));device.dumpWindowHierarchy(File(context.filesDir,"place-chat-live.xml"));instrumentation.runOnMainSync{activity.finish()}}
    }
    @Test fun letterboxCropExcludesBlackBarsAndUncertainScreensRequireConfirmation(){
        val bitmap=Bitmap.createBitmap(240,480,Bitmap.Config.ARGB_8888)
        val canvas=Canvas(bitmap);canvas.drawColor(Color.BLACK)
        val paint=android.graphics.Paint().apply{color=Color.rgb(90,140,200)}
        canvas.drawRect(Rect(0,160,240,320),paint)
        val result=VideoFrameCropper.find(bitmap)
        assertTrue(result.confident);assertEquals(Rect(0,160,240,320),result.bounds)
        canvas.drawColor(Color.GRAY)
        val fallback=VideoFrameCropper.find(bitmap,20,30)
        assertFalse(fallback.confident);assertEquals(Rect(0,20,240,450),fallback.bounds)
        bitmap.recycle()
    }
    @Test fun uncertainMobileFrameOpensLocalPreviewBeforeAnyNetworkRequest(){
        val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
        val file=File(context.filesDir,"sessions/place-chat-test/scene.jpg").apply{parentFile!!.mkdirs()}
        val bitmap=Bitmap.createBitmap(240,480,Bitmap.Config.ARGB_8888).apply{eraseColor(Color.GRAY)}
        file.outputStream().use{bitmap.compress(Bitmap.CompressFormat.JPEG,85,it)};bitmap.recycle()
        val activity=instrumentation.startActivitySync(Intent(context,PlaceChatActivity::class.java).putExtra("scene",file.absolutePath).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        try{
            val device=UiDevice.getInstance(instrumentation)
            assertNotNull(device.wait(Until.findObject(By.text("영상 영역을 확인해 주세요")),10000))
            assertNotNull(device.findObject(By.text("이 영상 영역으로 장소 분석")))
            device.takeScreenshot(File(context.filesDir,"place-chat-preview.png"))
        }finally{instrumentation.runOnMainSync{activity.finish()};file.delete()}
    }
}
