package kr.cleantouch.scan.capture

import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.*
import android.os.*
import android.provider.Settings
import android.view.*
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import kr.cleantouch.scan.MainActivity
import kr.cleantouch.scan.R
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

/** Separate, explicitly authorized AI share. Never reuses a MediaProjection token. */
class AiScreenShareService:Service() {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
    private val handler=Handler(Looper.getMainLooper())
    private var projection:MediaProjection?=null
    private var display:VirtualDisplay?=null
    private var reader:ImageReader?=null
    private var overlay:TextView?=null
    private var chatPanel:FloatingAiPanel?=null
    private var nextFrame=0L
    private var encoding=false
    private var visible=true
    private val callback=object:MediaProjection.Callback(){
        override fun onStop(){stopSelf()}
        override fun onCapturedContentVisibilityChanged(isVisible:Boolean){visible=isVisible}
        override fun onCapturedContentResize(width:Int,height:Int){if(width>0&&height>0&&display!=null)runCatching{resize(width,height)}.onFailure{stopSelf()}}
    }
    override fun onCreate(){super.onCreate();MobileChatController.initialize(this);getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel("ai_share","AI 화면 함께 보기",NotificationManager.IMPORTANCE_LOW))}
    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int {
        if(intent?.action==STOP){stopSelf();return START_NOT_STICKY}
        if(projection!=null)return START_NOT_STICKY
        try {
            val stop=PendingIntent.getService(this,8,Intent(this,AiScreenShareService::class.java).setAction(STOP),PendingIntent.FLAG_IMMUTABLE)
            val notification=NotificationCompat.Builder(this,"ai_share").setSmallIcon(R.drawable.ic_scan_notification).setContentTitle("CleanTouch AI · 화면 공유 중")
                .setContentText("선택한 화면만 AI에 전송합니다. 언제든 종료할 수 있어요.").setOngoing(true).setSilent(true)
                .setContentIntent(PendingIntent.getActivity(this,9,Intent(this,PlaceChatActivity::class.java),PendingIntent.FLAG_IMMUTABLE))
                .addAction(R.drawable.ic_scan_notification,"공유 종료",stop).build()
            if(Build.VERSION.SDK_INT>=29)startForeground(1703,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)else startForeground(1703,notification)
            val data=IntentCompat.getParcelableExtra(intent!!,"projection",Intent::class.java)?:error("화면 공유 권한이 필요해요.")
            projection=getSystemService(MediaProjectionManager::class.java).getMediaProjection(intent.getIntExtra("result",0),data)
            projection!!.registerCallback(callback,handler)
            val metrics=resources.displayMetrics;val bounds=if(Build.VERSION.SDK_INT>=30)getSystemService(WindowManager::class.java).maximumWindowMetrics.bounds else Rect(0,0,metrics.widthPixels,metrics.heightPixels)
            resize(bounds.width(),bounds.height())
            display=projection!!.createVirtualDisplay("CleanTouch AI",reader!!.width,reader!!.height,metrics.densityDpi,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,reader!!.surface,null,handler)
            MobileChatController.beginSharing();bubble()
        }catch(e:Exception){MobileChatController.sharingStatus("화면 공유를 시작하지 못했어요. 다시 허용해 주세요.");stopSelf()}
        return START_NOT_STICKY
    }
    private fun resize(w:Int,h:Int){
        val scale=minOf(1f,1280f/maxOf(w,h));val width=(w*scale).toInt().coerceAtLeast(1);val height=(h*scale).toInt().coerceAtLeast(1)
        if(reader?.width==width&&reader?.height==height)return
        val previous=reader;val next=ImageReader.newInstance(width,height,PixelFormat.RGBA_8888,2);reader=next
        next.setOnImageAvailableListener({source->val frame=runCatching{source.acquireLatestImage()}.getOrNull()?:return@setOnImageAvailableListener
            try {frame.use {
                val now=SystemClock.elapsedRealtime()
                overlay?.visibility=if(PlaceChatActivity.foreground||MainActivity.foreground||FloatingAiPanel.visible)View.GONE else View.VISIBLE
                // Never transmit our chat, imported photos, system consent or dashboard as the watched video.
                if(!visible||MainActivity.foreground||PlaceChatActivity.foreground||FloatingAiPanel.visible||now<nextFrame||encoding)return@use
                nextFrame=now+1000
                val plane=it.planes[0];val pixels=RgbaFrame.copyPixels(plane.buffer,it.width,it.height,plane.rowStride,plane.pixelStride)
                encoding=true
                val bw=it.width;val bh=it.height
                scope.launch {try {
                    val encoded=withContext(Dispatchers.Default){
                        val bitmap=Bitmap.createBitmap(bw,bh,Bitmap.Config.ARGB_8888)
                        try{bitmap.copyPixelsFromBuffer(ByteBuffer.wrap(pixels));ByteArrayOutputStream().use {out->check(bitmap.compress(Bitmap.CompressFormat.JPEG,88,out));android.util.Base64.encodeToString(out.toByteArray(),android.util.Base64.NO_WRAP)}}finally{bitmap.recycle()}
                    }
                    if(MobileChatController.state.value.sharing&&!MainActivity.foreground&&!PlaceChatActivity.foreground&&!FloatingAiPanel.visible)MobileChatController.acceptFrame(encoded,System.currentTimeMillis())
                }catch(e:OutOfMemoryError){MobileChatController.sharingStatus("메모리가 부족해 이번 장면을 건너뛰었어요.");nextFrame=SystemClock.elapsedRealtime()+3000}
                catch(e:Exception){MobileChatController.sharingStatus("화면을 읽지 못했어요. 영상을 다시 띄워 주세요.")}
                finally{encoding=false}}
            }}catch(e:OutOfMemoryError){nextFrame=SystemClock.elapsedRealtime()+3000;encoding=false;MobileChatController.sharingStatus("메모리가 부족해 화면 전송을 잠시 쉬고 있어요.")}
            catch(e:Exception){encoding=false;MobileChatController.sharingStatus("화면을 다시 연결하고 있어요.")}
        },handler)
        display?.resize(width,height,resources.displayMetrics.densityDpi);display?.surface=next.surface;previous?.close()
    }
    private fun bubble(){
        if(!Settings.canDrawOverlays(this))return
        val windows=getSystemService(WindowManager::class.java);val dp=resources.displayMetrics.density
        val params=WindowManager.LayoutParams((48*dp).toInt(),(48*dp).toInt(),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT).apply{gravity=Gravity.TOP or Gravity.END;y=(180*dp).toInt()}
        val button=TextView(this).apply{text="AI";textSize=16f;gravity=Gravity.CENTER;setTextColor(Color.WHITE);contentDescription="CleanTouch AI 대화 열기";background=GradientDrawable().apply{shape=GradientDrawable.OVAL;setColor(0xFF7052E8.toInt())};alpha=.85f
            setOnClickListener{visibility=View.GONE;chatPanel=FloatingAiPanel(this@AiScreenShareService){visibility=View.VISIBLE}.also{it.show()}}}
        var start=0f;var position=0;var moved=false
        button.setOnTouchListener {_,event->when(event.actionMasked){MotionEvent.ACTION_DOWN->{start=event.rawY;position=params.y;moved=false;true};MotionEvent.ACTION_MOVE->{val delta=event.rawY-start;if(kotlin.math.abs(delta)>ViewConfiguration.get(this).scaledTouchSlop)moved=true;params.y=(position+delta.toInt()).coerceIn(0,(resources.displayMetrics.heightPixels-48*dp).toInt().coerceAtLeast(0));windows.updateViewLayout(button,params);true};MotionEvent.ACTION_UP->{if(!moved)button.performClick();true};else->false}}
        runCatching{windows.addView(button,params);overlay=button}
    }
    override fun onDestroy(){handler.removeCallbacksAndMessages(null);scope.cancel();chatPanel?.close(false);runCatching{overlay?.let {getSystemService(WindowManager::class.java).removeViewImmediate(it)}};overlay=null;display?.release();reader?.close();projection?.unregisterCallback(callback);projection?.stop();projection=null;MobileChatController.stopSharing();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy()}
    override fun onBind(intent:Intent?)=null
    companion object {
        private const val STOP="kr.cleantouch.STOP_AI_SHARE"
        fun start(context:Context,code:Int,data:Intent)=ContextCompat.startForegroundService(context,Intent(context,AiScreenShareService::class.java).putExtra("result",code).putExtra("projection",data))
        fun stop(context:Context){context.stopService(Intent(context,AiScreenShareService::class.java))}
    }
}
