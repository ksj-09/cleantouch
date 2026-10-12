package kr.cleantouch.scan.capture

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.*
import android.provider.Settings
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.content.IntentCompat
import kr.cleantouch.scan.MainActivity
import kr.cleantouch.scan.R
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.*
import java.io.File
import java.nio.ByteBuffer
import kotlin.math.abs

/** One projection: live touch selection plus a bounded, local-only scene history. */
class FloatingScanService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var windows: WindowManager
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var overlay: View? = null
    private var frozen: Bitmap? = null
    private var marked: Bitmap? = null
    private var captureRequested = false
    private var capturePlace = false
    private var captureAfter = 0L
    private var captureFrameAfterNs = 0L
    private var lastFrameTimestampNs = 0L
    private var nextSceneAt = 0L
    private var sceneWrite: Job? = null
    private var analysis: Job? = null
    private var busy = false
    private var suspendCapture = false
    private var compact = true
    private var dockRight = true
    private var verticalPosition = .35f
    private var bubbleX = 0
    private var bubbleY = 220
    private var selectionTime = 0L
    private val timeline = WatchTimeline()
    private val playbackObserverDelegate = lazy { ScreenPlaybackObserver(timeline) }
    private val playbackObserver by playbackObserverDelegate
    private var nextObserveAt = 0L
    private enum class Mode { BUBBLE, PANEL, PICKER, CAPTURING, RESULT, HIDDEN }
    private var mode = Mode.BUBBLE
    private val masker by lazy { PointObjectMasker(applicationContext) }
    private val dimBubble = Runnable { if (mode == Mode.BUBBLE) overlay?.alpha = .45f }
    private val timeout = Runnable {
        if (mode == Mode.CAPTURING) recoverCapture("화면을 읽지 못했어요. 스캔은 유지되니 다시 눌러 주세요.")
    }
    private val callback = object : MediaProjection.Callback() {
        override fun onStop() { stopSelf() }
        override fun onCapturedContentResize(width: Int, height: Int) {
            if (width > 0 && height > 0 && display != null) {
                runCatching { configureReader(width, height) }.onFailure {
                    android.util.Log.e("CleanTouchCapture", "Screen resize failed", it)
                    if (mode == Mode.CAPTURING) recoverCapture("화면 크기가 바뀌었어요. 상품 선택을 다시 눌러 주세요.")
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        running = true
        windows = getSystemService(WindowManager::class.java)
        ScanSessionStore.initialize(this)
        compact = getSharedPreferences("floating_button", 0).getBoolean("compact", true)
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel("floating_scan", "화면 상품 찾기", NotificationManager.IMPORTANCE_LOW))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            STOP -> { stopSelf(); return START_NOT_STICKY }
            HIDE -> { suspendCapture = true; hideButton(); if (projection == null && analysis?.isActive != true) stopSelf(); return START_NOT_STICKY }
            SHOW -> { suspendCapture = false; if (!busy && projection != null) bubble(); return START_NOT_STICKY }
            PICK -> { if (!busy && projection != null) pickLive(); return START_NOT_STICKY }
            PLACE -> { if (!busy && projection != null) pickLive(true); return START_NOT_STICKY }
            ALL -> { analyzeAll(); return START_NOT_STICKY }
            RESUME -> {
                if (projection != null && analysis?.isActive != true) {
                    ScanSessionStore.update { it.copy(phase = ScanPhase.RECORDING, message = "", captureActive = true) }
                    nextSceneAt = 0; bubble()
                }
                return START_NOT_STICKY
            }
            SCENE -> {
                if (!busy) {
                    val scene = ScanSessionStore.state.value.scenes.find { it.path == intent.getStringExtra("scene") }
                    if (scene != null) {
                        releaseSelection(); frozen = BitmapFactory.decodeFile(scene.path); selectionTime = scene.timeMs
                        if (frozen != null) pickStored()
                    }
                }
                return START_NOT_STICKY
            }
        }
        if (projection != null) return START_NOT_STICKY
        try {
            require(Settings.canDrawOverlays(this)) { "다른 앱 위에 표시를 허용해 주세요." }
            if (Build.VERSION.SDK_INT >= 29) startForeground(1702, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
            else startForeground(1702, notification())
            val data = intent?.let { IntentCompat.getParcelableExtra(it, "projection", Intent::class.java) }
                ?: error("화면 공유를 다시 시작해 주세요.")
            projection = getSystemService(MediaProjectionManager::class.java).getMediaProjection(intent.getIntExtra("result", Activity.RESULT_CANCELED), data)
            projection!!.registerCallback(callback, handler)
            ScanSessionStore.begin()
            ScanSessionStore.update { it.copy(captureActive = true) }
            val bounds = screenBounds()
            configureReader(bounds.width(), bounds.height())
            display = projection!!.createVirtualDisplay("CleanTouchLive", reader!!.width, reader!!.height,
                resources.displayMetrics.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader!!.surface, null, handler)
            bubble()
        } catch (error: Exception) {
            ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, captureActive = false, message = error.message ?: "시작하지 못했어요.") }
            Toast.makeText(this, error.message, Toast.LENGTH_LONG).show(); stopSelf()
        }
        return START_NOT_STICKY
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    @Suppress("DEPRECATION") private fun screenBounds(): Rect = if (Build.VERSION.SDK_INT >= 30) windows.maximumWindowMetrics.bounds
        else Point().also { windows.defaultDisplay.getRealSize(it) }.let { Rect(0, 0, it.x, it.y) }
    private fun notification() = NotificationCompat.Builder(this, "floating_scan")
        .setSmallIcon(R.drawable.ic_scan_notification).setContentTitle("CleanTouch 스캔")
        .setContentText(if (busy) "선택한 상품을 찾고 있어요" else if (mode == Mode.HIDDEN) "버튼 표시를 누르면 위젯이 돌아옵니다" else "위젯에서 상품 선택 · 앱에서 모두 분석")
        .setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
        .setContentIntent(PendingIntent.getActivity(this, 21, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE))
        .addAction(R.drawable.ic_scan_notification, "버튼 표시", PendingIntent.getService(this, 23, Intent(this, FloatingScanService::class.java).setAction(SHOW), PendingIntent.FLAG_IMMUTABLE))
        .addAction(R.drawable.ic_scan_notification, "종료", PendingIntent.getService(this, 22, Intent(this, FloatingScanService::class.java).setAction(STOP), PendingIntent.FLAG_IMMUTABLE)).build()
    private fun updateNotification() { if (projection != null) getSystemService(NotificationManager::class.java).notify(1702, notification()) }
    private fun hideButton() { mode = Mode.HIDDEN; captureRequested = false; handler.removeCallbacks(timeout); removeOverlay(); releaseSelection(); updateNotification() }
    // WindowManager detaches overlays asynchronously. Their Views can still draw the
    // previous frame, so let GC release display-owned bitmaps after detachment.
    private fun releaseSelection() { frozen = null; marked = null }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (!busy) { releaseSelection(); bubble() }
    }

    private fun configureReader(w: Int, h: Int) {
        val scale = minOf(1f, 1280f / maxOf(w, h))
        val width = (w * scale).toInt().coerceAtLeast(1); val height = (h * scale).toInt().coerceAtLeast(1)
        if (reader?.width == width && reader?.height == height) return
        val old = reader
        val next = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        reader = next
        next.setOnImageAvailableListener({ source ->
            val image = runCatching { source.acquireLatestImage() }.getOrNull() ?: return@setOnImageAvailableListener
            try { image.use {
                val now = SystemClock.uptimeMillis()
                val timestamp = image.timestamp
                if (timestamp > 0) lastFrameTimestampNs = timestamp
                val capture = captureRequested && now >= captureAfter &&
                    (timestamp <= 0 || captureFrameAfterNs <= 0 || timestamp >= captureFrameAfterNs)
                val collect = !MainActivity.foreground && !suspendCapture && ScanSessionStore.state.value.phase == ScanPhase.RECORDING && mode in setOf(Mode.BUBBLE, Mode.HIDDEN) && now >= nextSceneAt && sceneWrite?.isActive != true
                val observe = !capture && !busy && !MainActivity.foreground && !suspendCapture && ScanSessionStore.state.value.phase == ScanPhase.RECORDING && mode in setOf(Mode.BUBBLE, Mode.HIDDEN) && now >= nextObserveAt && !playbackObserver.busy
                if (!capture && !collect && !observe) return@use
                val plane = image.planes[0]
                val pixels = RgbaFrame.copyPixels(plane.buffer, image.width, image.height, plane.rowStride, plane.pixelStride)
                val bitmap = Bitmap.createBitmap(image.width, image.height, Bitmap.Config.ARGB_8888)
                bitmap.copyPixelsFromBuffer(ByteBuffer.wrap(pixels))
                if (observe) { nextObserveAt = now + 1500; playbackObserver.observe(bitmap) }
                if (capture) {
                    captureRequested = false; handler.removeCallbacks(timeout); releaseSelection()
                    frozen = bitmap; selectionTime = (System.currentTimeMillis() - ScanSessionStore.state.value.startedAt).coerceAtLeast(0)
                    val stamp = timeline.observe(now = now)
                    ScanSessionStore.update { it.copy(timeMarks = it.timeMarks + (selectionTime to stamp)) }
                    if (capturePlace) { capturePlace=false; openPlaceChat(bitmap) } else pickStored()
                } else if (collect) { nextSceneAt = now + 3000; saveScene(bitmap, timeline.observe(now = now)) }
                else bitmap.recycle()
            } } catch (error: Exception) {
                android.util.Log.e("CleanTouchCapture", "Screen frame failed", error)
                if (mode == Mode.CAPTURING || mode == Mode.PICKER) recoverCapture("화면을 읽지 못했어요. 스캔은 유지되니 다시 눌러 주세요.")
                else nextSceneAt = SystemClock.uptimeMillis() + 3000
            }
        }, handler)
        try {
            display?.resize(width, height, resources.displayMetrics.densityDpi)
            display?.setSurface(next.surface)
            old?.close()
        } catch (error: Exception) {
            reader = old; next.close()
            if (old != null) runCatching { display?.setSurface(old.surface) }
            throw error
        }
    }

    private fun saveScene(bitmap: Bitmap, stamp: VideoStamp) {
        val snapshot = ScanSessionStore.state.value
        if (snapshot.scenes.size >= 240 || filesDir.usableSpace < 128L * 1024 * 1024) {
            bitmap.recycle()
            ScanSessionStore.update { it.copy(phase = ScanPhase.PAUSED, message = "장면 보관 한도에 도달했어요. 모두 분석하거나 새 스캔을 시작하세요.") }; return
        }
        sceneWrite = scope.launch(Dispatchers.IO) {
            try {
                val time = (System.currentTimeMillis() - snapshot.startedAt).coerceAtLeast(0)
                val file = File(snapshot.directory, "scene-$time.jpg")
                val scale = minOf(1f, 960f / maxOf(bitmap.width, bitmap.height))
                val small = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
                try { file.outputStream().use { check(small.compress(Bitmap.CompressFormat.JPEG, 82, it)) } }
                finally { if (small !== bitmap) small.recycle() }
                ScanSessionStore.update { if (it.id == snapshot.id) it.copy(scenes = it.scenes + CapturedScene(time, file.absolutePath), durationMs = time, timeMarks = it.timeMarks + (time to stamp)) else it }
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) { ScanSessionStore.update { it.copy(phase = ScanPhase.PAUSED, message = "장면을 저장하지 못해 스캔을 멈췄어요.") } }
            finally { bitmap.recycle() }
        }
    }

    private fun analyzeAll() {
        if (busy || analysis?.isActive == true) return
        ScanSessionStore.update { it.copy(phase = ScanPhase.PAUSED) }
        hideButton()
        analysis = scope.launch {
            sceneWrite?.join()
            try { LocalSceneAnalyzer(applicationContext).analyze() }
            catch (error: CancellationException) { throw error }
            catch (error: Exception) { ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = error.message ?: "분석을 마치지 못했어요. 다시 시도할 수 있습니다.") } }
            finally { if (projection != null) bubble() }
        }
    }

    private fun removeOverlay() { handler.removeCallbacks(dimBubble); overlay?.let { runCatching { windows.removeView(it) } }; overlay = null }
    private fun show(view: View, full: Boolean = false) {
        removeOverlay()
        val bounds = screenBounds()
        view.measure(View.MeasureSpec.makeMeasureSpec(bounds.width(), View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(bounds.height(), View.MeasureSpec.AT_MOST))
        val params = WindowManager.LayoutParams(if (full) -1 else -2, if (full) -1 else -2,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or if (full) WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS else 0,
            PixelFormat.TRANSLUCENT).apply {
                gravity = Gravity.TOP or Gravity.START
                if (Build.VERSION.SDK_INT >= 28 && full) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                if (!full) { x = bubbleX.coerceIn(0, (bounds.width() - view.measuredWidth).coerceAtLeast(0)); y = bubbleY.coerceIn(0, (bounds.height() - view.measuredHeight).coerceAtLeast(0)) }
            }
        overlay = view; windows.addView(view, params)
    }
    private fun button(label: String, action: () -> Unit) = Button(this).apply { text = label; isAllCaps = false; setOnClickListener { action() } }
    private fun bubble() {
        if (busy) return
        if (projection == null) { stopSelf(); return }
        captureRequested = false; handler.removeCallbacks(timeout); mode = Mode.BUBBLE; releaseSelection()
        val bounds = screenBounds(); bubbleX = if (dockRight) bounds.width() - dp(48) else 0
        bubbleY = ((bounds.height() - dp(48)) * verticalPosition).toInt()
        val view = FrameLayout(this).apply {
            minimumWidth = dp(48); minimumHeight = dp(48)
            addView(TextView(this@FloatingScanService).apply {
                text = "✦"; textSize = if (compact) 17f else 23f; gravity = Gravity.CENTER; setTextColor(Color.WHITE)
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.rgb(88, 67, 157)) }
            }, FrameLayout.LayoutParams(dp(if (compact) 28 else 40), dp(if (compact) 28 else 40), Gravity.CENTER))
            setOnClickListener { panel() }
            contentDescription = "CleanTouch 상품 찾기"
        }
        var startX = 0f; var startY = 0f; var originX = 0; var originY = 0; var dragged = false
        view.setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> { handler.removeCallbacks(dimBubble); view.alpha = 1f; startX = event.rawX; startY = event.rawY; originX = bubbleX; originY = bubbleY; dragged = false; true }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - startX; val dy = event.rawY - startY
                    if (abs(dx) + abs(dy) > ViewConfiguration.get(this).scaledTouchSlop) dragged = true
                    bubbleX = (originX + dx.toInt()).coerceIn(0, (bounds.width() - view.width).coerceAtLeast(0)); bubbleY = (originY + dy.toInt()).coerceIn(0, (bounds.height() - view.height).coerceAtLeast(0))
                    (view.layoutParams as WindowManager.LayoutParams).also { it.x = bubbleX; it.y = bubbleY; windows.updateViewLayout(view, it) }; true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (!dragged && event.actionMasked == MotionEvent.ACTION_UP) view.performClick()
                    else { dockRight = bubbleX + view.width / 2 > bounds.width() / 2; verticalPosition = bubbleY.toFloat() / (bounds.height() - view.height).coerceAtLeast(1); bubble() }; true
                }
                else -> false
            }
        }
        show(view); handler.postDelayed(dimBubble, 3000); updateNotification()
    }
    private fun panel(message: String = "찾고 싶은 상품이 보이면 화면에서 직접 눌러 보세요.") {
        mode = Mode.PANEL
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(12), dp(8), dp(12), dp(8)); setBackgroundColor(Color.rgb(24, 27, 40))
            addView(TextView(this@FloatingScanService).apply { text = message; setTextColor(Color.WHITE); textSize = 14f; maxWidth = dp(260) })
        }
        if (!busy) column.addView(button("현재 화면에서 상품 터치") { pickLive() })
        if (!busy) column.addView(button("장소 분석 · AI에게 물어보기") { pickLive(true) })
        column.addView(button("앱 열기 · 모두 분석 / 상품 목록") { startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); hideButton() })
        column.addView(button(if (compact) "위젯 크게" else "위젯 작게") { compact = !compact; getSharedPreferences("floating_button", 0).edit().putBoolean("compact", compact).apply(); bubble() })
        column.addView(button("접기") { bubble() }); column.addView(button("숨기기 · 알림에서 다시 표시") { hideButton() }); column.addView(button("스캔 종료") { stopSelf() })
        show(ScrollView(this).apply { addView(column) })
    }

    private fun pickLive(place: Boolean = false) {
        if (busy) return
        handler.removeCallbacks(dimBubble)
        overlay?.visibility = View.INVISIBLE
        releaseSelection(); mode = Mode.CAPTURING
        capturePlace = place
        // Freeze before accepting a tap so a moving product cannot leave the tapped position.
        captureRequested = true
        captureAfter = SystemClock.uptimeMillis() + 200
        captureFrameAfterNs = if (lastFrameTimestampNs > 0) lastFrameTimestampNs + 150_000_000L else 0L
        handler.postDelayed(timeout, 2500)
    }
    private fun recoverCapture(message: String) {
        capturePlace = false
        captureRequested = false; busy = false; handler.removeCallbacks(timeout)
        runCatching { bubble() }.onFailure {
            mode = Mode.HIDDEN
            android.util.Log.e("CleanTouchCapture", "Could not restore floating button", it)
            updateNotification()
        }
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
    private fun selectionLayout(content: View, message: String = "찾을 상품을 한 번 누르세요"): FrameLayout = FrameLayout(this).apply {
        addView(content, FrameLayout.LayoutParams(-1, -1))
        addView(TextView(this@FloatingScanService).apply {
            text = message; setTextColor(Color.WHITE); textSize = 16f; gravity = Gravity.CENTER; setBackgroundColor(0xCC181B28.toInt()); setPadding(dp(8), dp(8), dp(8), dp(8))
        }, FrameLayout.LayoutParams(-1, -2, Gravity.TOP).apply { topMargin = dp(32) })
        addView(button("취소") { bubble() }, FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM or Gravity.END).apply { bottomMargin = dp(32); rightMargin = dp(12) })
    }
    private fun pickStored(message: String = "찾을 상품을 한 번 누르세요") {
        mode = Mode.PICKER
        val bitmap = frozen ?: return
        val image = ImageView(this).apply { setImageBitmap(bitmap); scaleType = ImageView.ScaleType.FIT_CENTER; setBackgroundColor(Color.BLACK) }
        image.setOnTouchListener { view, event ->
            if (event.actionMasked == MotionEvent.ACTION_UP) {
                val scale = minOf(view.width.toFloat() / bitmap.width, view.height.toFloat() / bitmap.height)
                val x = (event.x - (view.width - bitmap.width * scale) / 2) / (bitmap.width * scale)
                val y = (event.y - (view.height - bitmap.height * scale) / 2) / (bitmap.height * scale)
                if (x in 0f..1f && y in 0f..1f) select(PointF(x, y))
            }; true
        }
        show(selectionLayout(image, message), true)
    }
    private fun select(point: PointF) {
        if (busy) return
        val source = try { frozen?.copy(Bitmap.Config.ARGB_8888, false) }
        catch (error: OutOfMemoryError) {
            android.util.Log.e("CleanTouchMask", "Insufficient memory copying captured frame", error)
            bubble()
            android.widget.Toast.makeText(this, "메모리가 부족해 분석을 시작하지 못했어요. 스캔은 유지됩니다.", android.widget.Toast.LENGTH_LONG).show()
            return
        } ?: return
        busy = true; panel("누른 상품의 윤곽을 찾고 있어요…")
        scope.launch {
            try {
                val selection = withContext(Dispatchers.Default) { masker.isolateWithBounds(source, point.x, point.y) }
                if (selection == null) {
                    busy = false
                    pickStored("윤곽을 찾지 못했어요. 상품 안쪽을 다시 눌러 주세요.")
                    return@launch
                }
                val bounds = selection.bounds
                val image = selection.bitmap
                try {
                    val product = withContext(Dispatchers.IO) { LocalSceneAnalyzer.storeProduct(image, "직접 선택한 상품", selectionTime) }
                    marked = image.copy(Bitmap.Config.ARGB_8888, false)
                    busy = false; showSelection(product, bounds)
                } finally { if (image !== source) image.recycle() }
            } catch (error: CancellationException) { throw error }
            catch (error: OutOfMemoryError) {
                android.util.Log.e("CleanTouchMask", "Insufficient memory during tap analysis", error)
                busy = false
                marked = null
                bubble()
                android.widget.Toast.makeText(this@FloatingScanService, "메모리가 부족해 이번 분석을 멈췄어요. 스캔은 유지됩니다.", android.widget.Toast.LENGTH_LONG).show()
            }
            catch (error: Exception) {
                android.util.Log.e("CleanTouchMask", "Tap segmentation failed", error)
                busy = false
                pickStored("상품 윤곽 분석에 실패했어요. 상품 안쪽을 다시 눌러 주세요.")
            }
            finally { busy = false; source.recycle(); withContext(kotlinx.coroutines.NonCancellable + Dispatchers.Default) { masker.close() }; updateNotification() }
        }
    }
    private fun showSelection(product: RecordedProduct, bounds: Rect) {
        mode = Mode.RESULT
        val bitmap = frozen ?: return
        val highlight = marked
        val contour = if (highlight != null) alphaContour(highlight) else null
        val view = object : View(this) {
            private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            override fun onDraw(canvas: Canvas) {
                val scale = minOf(width.toFloat() / bitmap.width, height.toFloat() / bitmap.height)
                val left = (width - bitmap.width * scale) / 2; val top = (height - bitmap.height * scale) / 2
                canvas.drawColor(Color.BLACK); canvas.save(); canvas.translate(left, top); canvas.scale(scale, scale)
                canvas.drawBitmap(bitmap, 0f, 0f, paint); canvas.drawColor(0x55000000)
                if (highlight != null) canvas.drawBitmap(highlight, bounds.left.toFloat(), bounds.top.toFloat(), paint)
                paint.style = Paint.Style.STROKE
                paint.color = if (contour != null) Color.rgb(122, 231, 199) else Color.rgb(255, 190, 92)
                paint.strokeWidth = 3 / scale
                paint.strokeJoin = Paint.Join.ROUND; paint.strokeCap = Paint.Cap.ROUND
                if (contour != null) {
                    canvas.save(); canvas.translate(bounds.left.toFloat(), bounds.top.toFloat())
                    canvas.drawPath(contour, paint); canvas.restore()
                } else canvas.drawRoundRect(RectF(bounds), 10f, 10f, paint)
                paint.style = Paint.Style.FILL; canvas.restore()
            }
        }
        val root = FrameLayout(this).apply { addView(view, FrameLayout.LayoutParams(-1, -1)) }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(12), dp(16), dp(12)); setBackgroundColor(0xF0181B28.toInt())
            addView(TextView(this@FloatingScanService).apply { text = "이 상품을 선택했어요"; setTextColor(Color.WHITE); textSize = 17f })
            addView(TextView(this@FloatingScanService).apply { text = "선택한 상품 사진으로 Google Lens에서 정보와 판매처를 찾아볼까요?"; setTextColor(Color.LTGRAY); textSize = 13f })
            addView(button("Google Lens에서 정보 · 구매처 찾기") {
                // Keep the visible overlay until Activity.onResume: hiding it first can block background launch on Android.
                runCatching {
                    val uri = FileProvider.getUriForFile(this@FloatingScanService, "$packageName.fileprovider", File(product.thumbnail))
                    startActivity(Intent(this@FloatingScanService, LensSearchActivity::class.java).apply {
                        putExtra(LensSearchActivity.EXTRA_IMAGE_URI, uri.toString()); putExtra(LensSearchActivity.EXTRA_IMAGE_MIME_TYPE, "image/png")
                        putExtra(LensSearchActivity.EXTRA_RESTORE_FLOATING_BUTTON, projection != null)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    })
                }.onFailure { Toast.makeText(this@FloatingScanService, "검색 화면을 열지 못했어요. 앱의 상품 목록에서 다시 열 수 있습니다.", Toast.LENGTH_LONG).show() }
            })
            addView(button("다시 선택") { if (projection != null) pickLive() else pickStored() }); addView(button("영상으로 돌아가기") { bubble() })
        }
        root.addView(card, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM).apply { bottomMargin = dp(28) })
        show(root, true)
    }

    private fun alphaContour(mask: Bitmap): Path? {
        val width = mask.width
        val height = mask.height
        if (width <= 0 || height <= 0) return null
        val pixels = IntArray(width * height)
        mask.getPixels(pixels, 0, width, 0, 0, width, height)
        val path = Path()
        var edges = 0
        for (y in 0 until height) for (x in 0 until width) {
            val index = y * width + x
            if ((pixels[index] ushr 24) < 32) continue
            val x0 = x.toFloat(); val y0 = y.toFloat()
            if (y == 0 || (pixels[index - width] ushr 24) < 32) {
                path.moveTo(x0, y0); path.lineTo(x0 + 1f, y0); edges++
            }
            if (x == width - 1 || (pixels[index + 1] ushr 24) < 32) {
                path.moveTo(x0 + 1f, y0); path.lineTo(x0 + 1f, y0 + 1f); edges++
            }
            if (y == height - 1 || (pixels[index + width] ushr 24) < 32) {
                path.moveTo(x0 + 1f, y0 + 1f); path.lineTo(x0, y0 + 1f); edges++
            }
            if (x == 0 || (pixels[index - 1] ushr 24) < 32) {
                path.moveTo(x0, y0 + 1f); path.lineTo(x0, y0); edges++
            }
        }
        return path.takeIf { edges > 0 }
    }

    private fun openPlaceChat(bitmap: Bitmap) {
        busy=true
        scope.launch {
            try {
                val file=withContext(Dispatchers.IO) {
                    val directory=File(filesDir,"sessions/place-chat").apply { mkdirs() }
                    directory.listFiles()?.filter { System.currentTimeMillis()-it.lastModified()>86_400_000 }?.forEach { it.delete() }
                    File(directory,"scene-${java.util.UUID.randomUUID()}.jpg").also { target->target.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG,88,it)) } }
                }
                fun inset(name:String):Int { val id=resources.getIdentifier(name,"dimen","android");return if(id>0)(resources.getDimensionPixelSize(id)*bitmap.height.toFloat()/screenBounds().height()).toInt() else 0 }
                overlay?.visibility=View.VISIBLE;mode=Mode.PANEL
                startActivity(Intent(this@FloatingScanService,PlaceChatActivity::class.java).putExtra("scene",file.absolutePath).putExtra("restoreWidget",projection!=null)
                    .putExtra("topInset",inset("status_bar_height")).putExtra("bottomInset",inset("navigation_bar_height")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch(error:Exception) { if(error is CancellationException)throw error;recoverCapture("장소 분석 화면을 열지 못했어요. 스캔은 유지됩니다.") }
            finally {busy=false;updateNotification()}
        }
    }

    override fun onDestroy() {
        if (playbackObserverDelegate.isInitialized()) playbackObserver.close()
        running = false
        handler.removeCallbacksAndMessages(null); scope.cancel(); removeOverlay()
        display?.release(); reader?.close(); projection?.unregisterCallback(callback); projection?.stop(); projection = null
        runCatching { masker.close() }; releaseSelection()
        ScanSessionStore.update { it.copy(captureActive = false, phase = if (it.phase == ScanPhase.RECORDING) ScanPhase.PAUSED else if (it.phase == ScanPhase.ANALYZING) ScanPhase.INTERRUPTED else it.phase) }
        stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null
    companion object {
        var running = false
            private set
        private const val STOP = "kr.cleantouch.STOP_FLOATING"; private const val SHOW = "kr.cleantouch.SHOW_FLOATING"
        private const val HIDE = "kr.cleantouch.HIDE_FLOATING"; private const val PICK = "kr.cleantouch.PICK_PRODUCT"
        private const val ALL = "kr.cleantouch.ANALYZE_ALL"; private const val RESUME = "kr.cleantouch.RESUME_SCAN"; private const val SCENE = "kr.cleantouch.OPEN_SCENE"
        private const val PLACE = "kr.cleantouch.PLACE_CHAT"
        fun start(context: Context, code: Int, data: Intent) = ContextCompat.startForegroundService(context, Intent(context, FloatingScanService::class.java).putExtra("result", code).putExtra("projection", data))
        private fun send(context: Context, action: String) { context.startService(Intent(context, FloatingScanService::class.java).setAction(action)) }
        fun stop(context: Context) = send(context, STOP)
        fun show(context: Context) = send(context, SHOW)
        fun hide(context: Context) { if (running) send(context, HIDE) }
        fun pick(context: Context) = send(context, PICK)
        fun place(context: Context) = send(context, PLACE)
        fun analyzeAll(context: Context) = send(context, ALL)
        fun resume(context: Context) = send(context, RESUME)
        fun openScene(context: Context, scene: CapturedScene) { context.startService(Intent(context, FloatingScanService::class.java).setAction(SCENE).putExtra("scene", scene.path)) }
    }
}
