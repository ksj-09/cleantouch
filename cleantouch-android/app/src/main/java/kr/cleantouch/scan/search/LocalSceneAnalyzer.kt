package kr.cleantouch.scan.search

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Rect
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.objectdetector.ObjectDetector
import kotlinx.coroutines.*
import java.io.File
import java.util.UUID

/** Finds supported object categories locally. Product identity/prices come from Lens, never invented here. */
class LocalSceneAnalyzer(private val context: Context) {
    suspend fun analyze() = withContext(Dispatchers.Default) {
        val snapshot = ScanSessionStore.state.value
        require(snapshot.scenes.isNotEmpty()) { "모아둔 장면이 없어요. 영상을 잠시 본 뒤 다시 눌러 주세요." }
        ScanSessionStore.update { it.copy(phase = ScanPhase.ANALYZING, totalFrames = snapshot.scenes.size, message = "앞뒤 장면을 함께 보며 AI로 상품을 확인하고 있어요.") }
        for ((index,scene) in snapshot.scenes.withIndex()) {
            ensureActive()
            if (scene.timeMs in ScanSessionStore.state.value.completedFrames) continue
            val bitmap = BitmapFactory.decodeFile(scene.path) ?: error("저장한 장면을 읽지 못했어요.")
            try {
                val neighbors=listOfNotNull(snapshot.scenes.getOrNull(index-1),snapshot.scenes.getOrNull(index+1))
                    .filter { kotlin.math.abs(it.timeMs-scene.timeMs)<=6000 && snapshot.timeMarks[it.timeMs]?.key==snapshot.timeMarks[scene.timeMs]?.key }.map {it.path}
                for(item in MobileObjectRepository.locate(bitmap,neighbors)) {
                    ensureActive()
                    val box=item.bounds
                    val crop=Bitmap.createBitmap(bitmap,box.left,box.top,box.width(),box.height())
                    try {storeProduct(crop,item.label,scene.timeMs)} finally {if(crop!==bitmap)crop.recycle()}
                }
                ScanSessionStore.update {it.copy(completedFrames=it.completedFrames+scene.timeMs)}
            } finally {bitmap.recycle()}
        }
        ScanSessionStore.update {it.copy(phase=ScanPhase.COMPLETE,message="모아둔 장면 분석을 마쳤어요. 놓친 상품은 장면을 열어 직접 선택할 수 있어요.")}
    }
    companion object {
        fun productRegionsAt(context: Context, bitmap: Bitmap, x: Float, y: Float): List<Rect> {
            val detector = ObjectDetector.createFromOptions(context, ObjectDetector.ObjectDetectorOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath("product_detector.tflite").build())
                .setMaxResults(12).setScoreThreshold(.3f).build())
            try {
                val found = mutableListOf<Candidate>()
                val regions = listOf(Rect(0, 0, bitmap.width, bitmap.height)) + listOf(0f, .35f).flatMap { tx ->
                    listOf(0f, .35f).map { ty -> FocusRect(tx, ty, tx + .65f, ty + .65f).toBitmapRect(bitmap.width, bitmap.height) }
                }
                for (region in regions) {
                    val tile = Bitmap.createBitmap(bitmap, region.left, region.top, region.width(), region.height())
                    val image = BitmapImageBuilder(tile.copy(Bitmap.Config.ARGB_8888, false)).build()
                    if (tile !== bitmap) tile.recycle()
                    val result = try { detector.detect(image) } finally { image.close() }
                    for (detection in result.detections()) {
                        val category = detection.categories().maxByOrNull { it.score() } ?: continue
                        if (category.categoryName() in excluded) continue
                        val box = detection.boundingBox()
                        val rect = Rect(box.left.toInt() + region.left, box.top.toInt() + region.top,
                            box.right.toInt() + region.left, box.bottom.toInt() + region.top)
                        rect.intersect(0, 0, bitmap.width, bitmap.height)
                        if (rect.contains((x * bitmap.width).toInt(), (y * bitmap.height).toInt())) found += Candidate(category.categoryName(), category.score(), rect)
                    }
                }
                val unique = mutableListOf<Candidate>()
                for (candidate in found.sortedBy { it.bounds.width().toLong() * it.bounds.height() }) {
                    if (unique.none { it.category == candidate.category && overlap(it.bounds, candidate.bounds) > .25f }) unique += candidate
                }
                return unique.take(3).map { Rect(it.bounds) }
            } finally { detector.close() }
        }

        private data class Candidate(val category: String, val score: Float, val bounds: Rect)
        private fun overlap(a: Rect, b: Rect): Float {
            val intersection = Rect(a)
            if (!intersection.intersect(b)) return 0f
            val area = intersection.width() * intersection.height()
            return area.toFloat() / (a.width() * a.height() + b.width() * b.height() - area).coerceAtLeast(1)
        }
        private val excluded = setOf("person", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "traffic light", "stop sign", "fire hydrant", "parking meter")
        private val names = mapOf("backpack" to "배낭", "handbag" to "가방", "tie" to "넥타이", "suitcase" to "여행 가방", "umbrella" to "우산", "bottle" to "병", "cup" to "컵", "wine glass" to "와인잔", "bowl" to "그릇", "chair" to "의자", "couch" to "소파", "bed" to "침대", "dining table" to "테이블", "tv" to "TV", "laptop" to "노트북", "mouse" to "마우스", "remote" to "리모컨", "keyboard" to "키보드", "cell phone" to "휴대폰", "book" to "책", "clock" to "시계", "vase" to "꽃병", "scissors" to "가위", "teddy bear" to "인형", "sports ball" to "공", "baseball bat" to "야구 방망이", "tennis racket" to "테니스 라켓", "skateboard" to "스케이트보드", "surfboard" to "서핑보드", "bicycle" to "자전거", "motorcycle" to "오토바이", "car" to "자동차", "knife" to "칼", "fork" to "포크", "spoon" to "숟가락", "potted plant" to "화분", "toothbrush" to "칫솔", "hair drier" to "헤어드라이어")

        fun storeProduct(bitmap: Bitmap, label: String, timeMs: Long): RecordedProduct {
            val signature = signature(bitmap)
            val snapshot = ScanSessionStore.state.value
            val duplicate = snapshot.products.firstOrNull { it.label == label && snapshot.timeMarks[it.firstSeenMs]?.key == snapshot.timeMarks[timeMs]?.key && similarProductSignature(it.signature, signature) }
            if (duplicate != null) {
                val updated = duplicate.copy(sightings = (duplicate.sightings + timeMs).distinct().sorted())
                ScanSessionStore.update { it.copy(products = it.products.map { p -> if (p.id == updated.id) updated else p }) }
                return updated
            }
            val id = UUID.randomUUID().toString()
            val file = File(snapshot.directory, "product-$id.png")
            file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
            val product = RecordedProduct(id, label, file.absolutePath, timeMs, emptyList(), signature)
            ScanSessionStore.update { it.copy(products = it.products + product) }
            return product
        }

        private fun signature(bitmap: Bitmap): String {
            val small = Bitmap.createScaledBitmap(bitmap, 9, 8, true)
            try {
                var hash = 0L; var red = 0; var green = 0; var blue = 0
                fun luma(pixel: Int) = Color.red(pixel) * 3 + Color.green(pixel) * 6 + Color.blue(pixel)
                for (y in 0..7) for (x in 0..7) {
                    val pixel = small.getPixel(x, y)
                    hash = (hash shl 1) or if (luma(pixel) > luma(small.getPixel(x + 1, y))) 1 else 0
                    red += Color.red(pixel); green += Color.green(pixel); blue += Color.blue(pixel)
                }
                return "${java.lang.Long.toUnsignedString(hash, 16)}:${red / 64}:${green / 64}:${blue / 64}"
            } finally { if (small !== bitmap) small.recycle() }
        }
    }
}
