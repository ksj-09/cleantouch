package kr.cleantouch.scan

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.*
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class MobileOverlayTest {
    @Test fun floatingChatKeepsVideoActivityAndDraft()=runBlocking {
        val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext;val device=UiDevice.getInstance(instrumentation)
        device.executeShellCommand("appops set ${context.packageName} SYSTEM_ALERT_WINDOW allow")
        withContext(Dispatchers.Main){MobileChatController.initialize(context)}
        withTimeout(10000){while(!MobileChatController.state.value.loaded)delay(30)}
        instrumentation.context.startActivity(Intent().setClassName(instrumentation.context.packageName,VideoFixtureActivity::class.java.name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        delay(1200)
        val panel=withContext(Dispatchers.Main){FloatingAiPanel(context){}.also{it.show()}}
        try {
            assertNotNull(device.wait(Until.findObject(By.text("접기")),5000))
            val edit=device.wait(Until.findObject(By.clazz("android.widget.EditText")),5000);assertNotNull(edit);edit!!.click();edit.text="영상 위에서 입력한 질문"
            assertEquals("영상 위에서 입력한 질문",MobileChatController.state.value.conversation.draft)
            assertFalse("Opening a floating text chat must not enable capture",MobileChatController.state.value.sharing)
            device.takeScreenshot(File(context.filesDir,"mobile-floating-ai.png"))
            device.wait(Until.findObject(By.text("접기")),5000)!!.click()
            withTimeout(5000){while(FloatingAiPanel.visible)delay(30)}
            assertFalse(FloatingAiPanel.visible)
            assertEquals("영상 위에서 입력한 질문",MobileChatController.state.value.conversation.draft)
            assertFalse("Closing a chat must not launch the main app",PlaceChatActivity.foreground)
        }finally{withContext(Dispatchers.Main){panel.close(false)}}
    }
}
