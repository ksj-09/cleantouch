package kr.cleantouch.scan

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import kr.cleantouch.scan.capture.WatchTimeline
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ScreenTimeTest {
    @Test fun bundledRecognizerReadsPlaybackPosition() {
        val bitmap = Bitmap.createBitmap(640,360,Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap); canvas.drawColor(Color.WHITE)
        canvas.drawText("1:23 / 4:00",40f,180f,Paint(Paint.ANTI_ALIAS_FLAG).apply { color=Color.BLACK; textSize=48f })
        val recognizer = TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
        try {
            val text = Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap,0)),30,TimeUnit.SECONDS).text
            assertEquals("Recognized: $text",83000L,WatchTimeline.parse(text).positionMs)
        } finally { recognizer.close(); bitmap.recycle() }
    }
}
