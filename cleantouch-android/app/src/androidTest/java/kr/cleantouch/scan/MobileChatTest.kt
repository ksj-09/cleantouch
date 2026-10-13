package kr.cleantouch.scan

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
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
class MobileChatTest {
    private val instrumentation=InstrumentationRegistry.getInstrumentation()
    private val context=instrumentation.targetContext
    @Test fun chatOpensWithoutPhotoOrCaptureAndKeepsDraft(){
        val device=UiDevice.getInstance(instrumentation)
        context.startActivity(Intent(context,PlaceChatActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        assertNotNull(device.wait(Until.findObject(By.textContains("화면 공유 꺼짐")),15000))
        assertFalse(MobileChatController.state.value.sharing)
        val editor=device.wait(Until.findObject(By.clazz("android.widget.EditText")),5000);assertNotNull(editor);editor.text="내 가방 조건 기억해"
        assertNotNull(device.wait(Until.findObject(By.text("전송").enabled(true)),5000))
        device.pressBack();device.pressBack()
        context.startActivity(Intent(context,PlaceChatActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        assertNotNull(device.wait(Until.findObject(By.text("내 가방 조건 기억해")),10000))
        device.takeScreenshot(File(context.filesDir,"mobile-ai-chat.png"))
    }
    @Test fun uploadUsesCurrentConversationAndLocalStoreRoundTrips()=runBlocking {
        withContext(Dispatchers.Main){MobileChatController.initialize(context)}
        withTimeout(10000){while(!MobileChatController.state.value.loaded)delay(30)}
        val id=MobileChatController.state.value.current
        val photo=File(context.filesDir,"mobile-upload-fixture.png");instrumentation.context.assets.open("bag.png").use{input->photo.outputStream().use{input.copyTo(it)}}
        withContext(Dispatchers.Main){MobileChatController.attach(Uri.fromFile(photo))}
        withTimeout(15000){while(MobileChatController.state.value.busy)delay(30)}
        assertEquals(id,MobileChatController.state.value.current);assertTrue(MobileChatController.state.value.conversation.photo.isNotBlank());assertFalse(MobileChatController.state.value.sharing)
        delay(300)
        val loaded=MobileChatStore(context).load();assertTrue(loaded.any{it.id==id&&it.photo.isNotBlank()})
    }
    @Test fun liveTextReplyRemembersPreviousConstraint()=runBlocking {
        assumeTrue(InstrumentationRegistry.getArguments().getString("liveMobile")=="true")
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate);val client=MobileAiClient(scope){}
        try {withContext(Dispatchers.Main){
            val q="내가 찾는 가방은 베이지색이고 예산은 5만원이야. 이 조건을 기억해줘. 짧게 답해."
            val first=client.ask(q,emptyList(),"",false,true);assertTrue(first.text.isNotBlank())
            val second=client.ask("내가 방금 말한 색상과 예산만 다시 알려줘.",listOf(MobileMessage("user",q),first),"",false,false)
            assertTrue(second.text.contains("베이지"));assertTrue(second.text.contains("5만")||second.text.contains("50,000"))
        }}finally {withContext(Dispatchers.Main){client.close();scope.cancel()}}
    }
}
