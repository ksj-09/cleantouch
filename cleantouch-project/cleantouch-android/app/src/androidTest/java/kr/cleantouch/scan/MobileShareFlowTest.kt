package kr.cleantouch.scan

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.*
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class MobileShareFlowTest {
    @Test fun explicitConsentStartsFramesAndStoppingPreservesChat()=runBlocking {
        assumeTrue(InstrumentationRegistry.getArguments().getString("liveMobile")=="true")
        val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
        val device=UiDevice.getInstance(instrumentation)
        device.executeShellCommand("appops set ${context.packageName} SYSTEM_ALERT_WINDOW allow")
        device.executeShellCommand("pm grant ${context.packageName} android.permission.POST_NOTIFICATIONS")
        withContext(Dispatchers.Main){MobileChatController.initialize(context)}
        withTimeout(10000){while(!MobileChatController.state.value.loaded)delay(30)}
        withContext(Dispatchers.Main){MobileChatController.newConversation()}
        context.startActivity(Intent(context,PlaceChatActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        try {
            device.wait(Until.findObject(By.text("화면 함께 보기")),10000)!!.click()
            assertFalse("App consent alone must not start capture",MobileChatController.state.value.sharing)
            device.wait(Until.findObject(By.text("권한 확인하고 공유")),5000)!!.click()
            val mode=device.wait(Until.findObject(By.text(java.util.regex.Pattern.compile("(?i).*(single app|one app).*"))),5000)
            assertNotNull("Sharing mode selector must appear",mode);mode!!.click()
            val entire=device.wait(Until.findObject(By.text(java.util.regex.Pattern.compile("(?i).*entire.*screen.*"))),5000)
            assertNotNull("Entire-screen option must appear",entire);entire!!.click()
            device.takeScreenshot(File(context.filesDir,"mobile-share-consent.png"))
            val consent=device.wait(Until.findObject(By.res("android","button1")),5000)
                ?:device.wait(Until.findObject(By.textContains("Start")),5000)
            assertNotNull("Android consent must appear",consent);consent!!.click()
            withTimeout(15000){while(!MobileChatController.state.value.sharing)delay(50)}
            instrumentation.context.startActivity(Intent().setClassName(instrumentation.context.packageName,VideoFixtureActivity::class.java.name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            withTimeout(15000){while(MobileChatController.state.value.frameAt==0L)delay(100)}
            val first=MobileChatController.state.value.frameAt;delay(2500)
            assertTrue("Frames must keep updating without reopening chat",MobileChatController.state.value.frameAt>first)
            withContext(Dispatchers.Main){MobileChatController.send("사진 속 여성이 들고 있는 가방은 무슨 색이야? 색상만 짧게 알려줘.")}
            withTimeout(80000){while(MobileChatController.state.value.busy)delay(100)}
            val reply=MobileChatController.state.value.conversation.messages.last()
            assertEquals(MobileChatController.state.value.error,"model",reply.role)
            assertTrue(reply.text,reply.text.contains("검은")||reply.text.contains("검정")||reply.text.contains("블랙"))
            val chat=MobileChatController.state.value.conversation
            withContext(Dispatchers.Main){MobileChatController.stopSharing()}
            assertFalse(MobileChatController.state.value.sharing);assertEquals(chat.id,MobileChatController.state.value.current);assertEquals(chat.messages,MobileChatController.state.value.conversation.messages)
        } finally {
            device.takeScreenshot(File(context.filesDir,"mobile-share-flow.png"));device.dumpWindowHierarchy(File(context.filesDir,"mobile-share-flow.xml"))
            withContext(Dispatchers.Main){MobileChatController.stopSharing()}
        }
    }
}
