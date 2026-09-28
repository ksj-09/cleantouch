package kr.cleantouch.scan.capture

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Point
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import kr.cleantouch.scan.MainActivity
import kr.cleantouch.scan.R
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.*

/** One projection and one recorder surface per user-approved session. No overlay windows. */
class ScreenCaptureService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var recorder: MediaRecorder? = null
    private var recorderStarted = false
    private var stopping = false
    private var analysis: Job? = null
    private val storageCheck = object : Runnable {
        override fun run() {
            if (!recorderStarted) return
            if (filesDir.usableSpace < 128L * 1024 * 1024) stopRecording("저장 공간이 부족해 녹화를 종료했어요.")
            else handler.postDelayed(this, 5_000)
        }
    }
    private val projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() { stopRecording("화면 공유가 종료되어 자동 분석을 시작했어요.") }
        override fun onCapturedContentResize(width: Int, height: Int) {
            // Reuse the display; another createVirtualDisplay on this token is forbidden.
            if (width > 0 && height > 0) display?.resize(width, height, resources.displayMetrics.densityDpi)
        }
    }

    override fun onCreate() {
        super.onCreate()
        ScanSessionStore.initialize(this)
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "CleanTouch 스캔", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) },
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            START -> if (!recorderStarted && analysis?.isActive != true) startRecording(intent)
            STOP -> stopRecording()
            RETRY -> if (!recorderStarted && analysis?.isActive != true) startAnalysis()
            CANCEL -> {
                analysis?.cancel()
                ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = "분석을 중지했어요. 나중에 이어서 분석할 수 있어요.") }
                finishService("분석이 일시 중지됐어요")
            }
        }
        return START_NOT_STICKY
    }

    @Suppress("DEPRECATION")
    private fun startRecording(intent: Intent) {
        stopping = false
        try {
            val data = IntentCompat.getParcelableExtra(intent, "projection", Intent::class.java) ?: error("화면 공유를 다시 허용해 주세요.")
            foreground("화면 녹화 중 · 앱에서 끄면 자동 분석", true)
            val snapshot = ScanSessionStore.begin()
            require(filesDir.usableSpace > 160L * 1024 * 1024) { "녹화를 시작할 저장 공간이 부족해요." }
            val manager = getSystemService(MediaProjectionManager::class.java)
            projection = manager.getMediaProjection(intent.getIntExtra("result", Activity.RESULT_CANCELED), data)
                ?: error("화면 공유를 시작하지 못했어요.")
            projection!!.registerCallback(projectionCallback, handler)
            val size = screenSize()
            val scale = minOf(1.0, 1280.0 / maxOf(size.x, size.y))
            val width = ((size.x * scale).toInt() / 2 * 2).coerceAtLeast(2)
            val height = ((size.y * scale).toInt() / 2 * 2).coerceAtLeast(2)
            val recording = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(this) else MediaRecorder()
            recorder = recording
            recording.apply {
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                setVideoSize(width, height)
                setVideoFrameRate(24)
                setVideoEncodingBitRate(2_500_000)
                setOutputFile(snapshot.recording.absolutePath)
                setMaxFileSize(minOf(filesDir.usableSpace - 128L * 1024 * 1024, 2_000_000_000L))
                setOnInfoListener { _, what, _ ->
                    if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED) stopRecording("저장 용량 한도에 도달해 녹화를 종료했어요.")
                }
                setOnErrorListener { _, _, _ -> stopRecording("녹화가 중단됐어요. 저장된 장면을 분석합니다.") }
                prepare()
            }
            display = projection!!.createVirtualDisplay("CleanTouchRecording", width, height, resources.displayMetrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, recording.surface, null, handler)
            recording.start()
            recorderStarted = true
            handler.postDelayed(storageCheck, 5_000)
        } catch (error: Exception) {
            releaseRecording()
            ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = error.message ?: "녹화를 시작하지 못했어요.") }
            finishService("녹화를 시작하지 못했어요")
        }
    }

    private fun stopRecording(reason: String = "") {
        if (stopping || !recorderStarted) return
        stopping = true
        // Mark OFF before draining the encoder, preventing double taps and new recordings.
        ScanSessionStore.update { it.copy(phase = ScanPhase.ANALYZING, message = reason) }
        handler.removeCallbacks(storageCheck)
        val valid = runCatching { recorder?.stop(); true }.getOrDefault(false)
        recorderStarted = false
        releaseRecording()
        if (valid) startAnalysis()
        else {
            ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = "녹화가 너무 짧아 저장하지 못했어요. 몇 초 이상 녹화한 뒤 꺼 주세요.") }
            finishService("녹화를 저장하지 못했어요")
        }
    }

    private fun startAnalysis() {
        foreground("녹화한 화면에서 상품을 찾고 있어요", false)
        ScanSessionStore.update { it.copy(phase = ScanPhase.ANALYZING) }
        analysis = scope.launch {
            try {
                RecordingAnalyzer().analyze { done, total ->
                    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification("상품 분석 중 $done / $total", false))
                }
                finishService("상품 분석 완료 · 눌러서 전체 결과 보기")
            } catch (error: CancellationException) { throw error }
            catch (error: Exception) {
                ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = error.message ?: "분석이 중단됐어요. 다시 시도해 주세요.") }
                finishService("일부 장면의 분석이 중단됐어요 · 이어서 분석 가능")
            }
        }
    }

    private fun foreground(text: String, recording: Boolean) {
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification(text, recording),
            if (recording) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else startForeground(NOTIFICATION_ID, notification(text, recording))
    }

    private fun notification(text: String, recording: Boolean, finished: Boolean = false) =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_scan_notification)
            .setContentTitle("CleanTouch").setContentText(text)
            .setContentIntent(PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            .setOnlyAlertOnce(true).setSilent(true).setOngoing(!finished).setAutoCancel(finished)
            .apply {
                if (!finished) addAction(R.drawable.ic_scan_notification, if (recording) "종료하고 분석" else "분석 중지",
                    PendingIntent.getService(this@ScreenCaptureService, if (recording) 2 else 3,
                        Intent(this@ScreenCaptureService, ScreenCaptureService::class.java).setAction(if (recording) STOP else CANCEL),
                        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            }.build()

    private fun finishService(text: String) {
        stopForeground(STOP_FOREGROUND_REMOVE)
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(text, false, true))
        stopSelf()
    }

    private fun releaseRecording() {
        handler.removeCallbacks(storageCheck)
        display?.release(); display = null
        recorder?.let { runCatching { it.reset(); it.release() } }; recorder = null
        projection?.let { it.unregisterCallback(projectionCallback); it.stop() }; projection = null
    }

    @Suppress("DEPRECATION")
    private fun screenSize(): Point {
        val manager = getSystemService(WindowManager::class.java)
        if (Build.VERSION.SDK_INT >= 30) return manager.maximumWindowMetrics.bounds.let { Point(it.width(), it.height()) }
        return Point().also { manager.defaultDisplay.getRealSize(it) }
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        analysis?.cancel()
        ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = "Android가 백그라운드 분석을 중단했어요. 앱에서 이어서 분석해 주세요.") }
        stopSelf()
    }

    override fun onDestroy() {
        if (recorderStarted) runCatching { recorder?.stop() }
        recorderStarted = false
        releaseRecording()
        scope.cancel()
        if (ScanSessionStore.state.value.busy) ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = "작업이 중단됐어요. 앱에서 다시 시도해 주세요.") }
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        private const val START = "kr.cleantouch.START_RECORDING"
        private const val STOP = "kr.cleantouch.STOP_AND_ANALYZE"
        private const val RETRY = "kr.cleantouch.RETRY_ANALYSIS"
        private const val CANCEL = "kr.cleantouch.CANCEL_ANALYSIS"
        private const val CHANNEL_ID = "cleantouch_recording_v2"
        private const val NOTIFICATION_ID = 1701
        fun start(context: Context, code: Int, data: Intent) = ContextCompat.startForegroundService(context,
            Intent(context, ScreenCaptureService::class.java).setAction(START).putExtra("result", code).putExtra("projection", data))
        fun stop(context: Context) { context.startService(Intent(context, ScreenCaptureService::class.java).setAction(STOP)) }
        fun retry(context: Context) { ContextCompat.startForegroundService(context, Intent(context, ScreenCaptureService::class.java).setAction(RETRY)) }
        fun cancel(context: Context) { context.startService(Intent(context, ScreenCaptureService::class.java).setAction(CANCEL)) }
    }
}
