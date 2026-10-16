package kr.cleantouch.scan

import android.content.Intent
import androidx.core.content.FileProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import kr.cleantouch.scan.search.LensSearchActivity
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class ProductSearchTest {
    @Test fun directChatOffersProductAndPlaceAnalysis(){
        val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
        val file=File(context.filesDir,"sessions/product-chat-direct/bag.png").apply{parentFile!!.mkdirs()}
        instrumentation.context.assets.open("bag.png").use{input->file.outputStream().use{input.copyTo(it)}}
        val activity=instrumentation.startActivitySync(Intent(context,kr.cleantouch.scan.search.PlaceChatActivity::class.java).putExtra("scene",file.absolutePath).putExtra("chooseMode",true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        val device=UiDevice.getInstance(instrumentation)
        try{
            val product=device.wait(Until.findObject(By.text("상품 분석").enabled(true)),10000);assertNotNull(product)
            assertNotNull(device.findObject(By.text("장소 분석")))
            product!!.click();val picker=device.wait(Until.findObject(By.desc("상품 터치 선택 화면")),5000);assertNotNull(picker)
            if(InstrumentationRegistry.getArguments().getString("liveDirectProduct")=="true"){
                device.findObject(By.text("경계 인식이 느리면 상품 영역 직접 선택")).click()
                val area=device.wait(Until.findObject(By.desc("분석 영역 선택 화면")),5000)!!.visibleBounds
                val bitmap=android.graphics.BitmapFactory.decodeFile(file.absolutePath)
                val scale=minOf(area.width().toFloat()/bitmap.width,area.height().toFloat()/bitmap.height)
                device.swipe((area.centerX()+(.34f-.5f)*bitmap.width*scale).toInt(),(area.centerY()+(.44f-.5f)*bitmap.height*scale).toInt(),(area.centerX()+(.81f-.5f)*bitmap.width*scale).toInt(),(area.centerY()+(.72f-.5f)*bitmap.height*scale).toInt(),20);bitmap.recycle()
                device.findObject(By.text("선택한 상품 AI 분석")).click()
                assertNotNull("Direct tapped product must reach AI and shopping",device.wait(Until.findObject(By.textContains(" · 쇼핑 검색")),95000))
                assertNotNull(device.findObject(By.clazz("android.widget.EditText").enabled(true)))
                device.takeScreenshot(File(context.filesDir,"product-chat-direct.png"))
            }
            device.findObject(By.text("장소 분석")).click();assertNotNull(device.wait(Until.findObject(By.text("이 영상 영역으로 장소 분석")),5000))
        }finally{device.takeScreenshot(File(context.filesDir,"product-chat-direct.png"));device.dumpWindowHierarchy(File(context.filesDir,"product-chat-direct.xml"));instrumentation.runOnMainSync{activity.finish()};file.delete()}
    }
    @Test fun selectedProductGetsAiNameAndIdenticalShoppingQuery(){
        assumeTrue(InstrumentationRegistry.getArguments().getString("liveProduct")=="true")
        val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
        val file=File(context.filesDir,"sessions/product-ai-test/bag.png").apply{parentFile!!.mkdirs()}
        instrumentation.context.assets.open("bag.png").use{input->file.outputStream().use{input.copyTo(it)}}
        val uri=FileProvider.getUriForFile(context,"${context.packageName}.fileprovider",file)
        val activity=instrumentation.startActivitySync(Intent(context,LensSearchActivity::class.java).apply{
            putExtra(LensSearchActivity.EXTRA_IMAGE_URI,uri.toString());putExtra(LensSearchActivity.EXTRA_IMAGE_MIME_TYPE,"image/png");addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        val device=UiDevice.getInstance(instrumentation)
        try {
            assertNotNull(device.wait(Until.findObject(By.text("Google Lens · 비슷한 상품")),10000))
            val shopping=device.wait(Until.findObject(By.textContains(" · 쇼핑 검색")),65000)
            assertNotNull("Real public AI must identify the chosen product",shopping)
            val label=shopping!!.text.substringBefore(" · 쇼핑 검색")
            assertTrue(label.isNotBlank()&&label.length<=30)
            assertNotNull(device.findObject(By.textStartsWith("$label · AI 추정")))
            device.takeScreenshot(File(context.filesDir,"product-ai-lens.png"))
            device.findObject(By.text("AI에게 상품 더 물어보기")).click()
            val field=device.wait(Until.findObject(By.clazz("android.widget.EditText").enabled(true)),10000)
            assertNotNull("Selected product opens chat without another crop selection",field)
            field!!.text="비슷하지만 더 저렴한 상품을 찾으려면 어떻게 검색해?"
            device.findObject(By.text("전송")).click()
            assertNotNull(device.wait(Until.findObject(By.clazz("android.widget.EditText").enabled(false)),5000))
            assertNotNull("Product follow-up should succeed",device.wait(Until.findObject(By.clazz("android.widget.EditText").enabled(true)),65000))
        }finally{device.takeScreenshot(File(context.filesDir,"product-ai-live.png"));device.dumpWindowHierarchy(File(context.filesDir,"product-ai-live.xml"));instrumentation.runOnMainSync{activity.finish()};file.delete()}
    }
}
