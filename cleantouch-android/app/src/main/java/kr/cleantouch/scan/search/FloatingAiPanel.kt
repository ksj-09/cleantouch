package kr.cleantouch.scan.search

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.view.*
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.core.widget.doAfterTextChanged
import kotlinx.coroutines.*

/** Chat over the playing video. Closing only folds the panel; it never erases the conversation. */
class FloatingAiPanel(private val context:Context,private val folded:()->Unit) {
    private val windows=context.getSystemService(WindowManager::class.java)
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
    private var root:View?=null
    private fun dp(v:Int)=(context.resources.displayMetrics.density*v).toInt()
    private fun rounded(color:Int)=GradientDrawable().apply{setColor(color);cornerRadius=dp(18).toFloat()}
    fun show(){
        current?.close(false);current=this;MobileChatController.initialize(context)
        val metrics=context.resources.displayMetrics
        val params=WindowManager.LayoutParams(minOf(dp(340),metrics.widthPixels-dp(20)),minOf(dp(530),(metrics.heightPixels*.67f).toInt()),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,PixelFormat.TRANSLUCENT).apply{gravity=Gravity.TOP or Gravity.CENTER_HORIZONTAL;y=dp(70);softInputMode=WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE}
        val layout=LinearLayout(context).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(14),dp(12),dp(14),dp(10));background=rounded(0xFFFFFDFC.toInt());elevation=dp(12).toFloat()}
        val header=LinearLayout(context)
        val brand=TextView(context).apply{text="✦ CleanTouch AI";textSize=16f;setTextColor(0xFF39216F.toInt());setTypeface(null,android.graphics.Typeface.BOLD);gravity=Gravity.CENTER_VERTICAL}
        header.addView(brand,LinearLayout.LayoutParams(0,dp(48),1f))
        header.addView(Button(context).apply{text="접기";isAllCaps=false;setOnClickListener{close()}})
        layout.addView(header)
        val status=TextView(context).apply{textSize=11f;setTextColor(0xFF777185.toInt())};layout.addView(status)
        val content=LinearLayout(context).apply{orientation=LinearLayout.VERTICAL}
        val scroll=ScrollView(context).apply{addView(content);isFillViewport=true};layout.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
        val entry=LinearLayout(context).apply{gravity=Gravity.BOTTOM}
        val edit=EditText(context).apply{hint="영상 보며 물어보세요";textSize=14f;setTextColor(0xFF282337.toInt());maxLines=3;setSingleLine(false);background=rounded(0xFFF3EFF8.toInt());setPadding(dp(12),dp(8),dp(12),dp(8));setText(MobileChatController.state.value.conversation.draft)}
        edit.setOnFocusChangeListener{_,hasFocus->if(hasFocus){params.flags=params.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv();runCatching{windows.updateViewLayout(layout,params)};context.getSystemService(InputMethodManager::class.java).showSoftInput(edit,InputMethodManager.SHOW_IMPLICIT)}}
        edit.doAfterTextChanged{MobileChatController.draft(it?.toString().orEmpty())}
        entry.addView(edit,LinearLayout.LayoutParams(0,-2,1f))
        val send=Button(context).apply{text="전송";isAllCaps=false;setTextColor(Color.WHITE);backgroundTintList=android.content.res.ColorStateList.valueOf(0xFF7052E8.toInt());setOnClickListener{if(MobileChatController.state.value.busy)MobileChatController.cancel()else MobileChatController.send(edit.text.toString())}}
        entry.addView(send,LinearLayout.LayoutParams(dp(70),dp(50)));layout.addView(entry)
        val full=Button(context).apply{text="사진 업로드 · 대화 목록";isAllCaps=false;textSize=12f;setOnClickListener{context.startActivity(Intent(context,PlaceChatActivity::class.java).putExtra("restoreWidget",kr.cleantouch.scan.capture.FloatingScanService.running).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP));close(false)}};layout.addView(full)
        root=layout
        try{windows.addView(layout,params)}catch(e:Exception){close();return}
        var rendered=""
        scope.launch {MobileChatController.state.collect {s->
            status.text=if(s.error.isNotBlank())s.error else if(s.busy)s.status else if(s.sharing)"공유 중 · 창을 열기 직전의 장면으로 답해요" else "일반 대화 · 화면 공유 꺼짐"
            send.text=if(s.busy)"멈춤" else "전송";edit.isEnabled=!s.busy
            if(edit.text.toString()!=s.conversation.draft)edit.setText(s.conversation.draft)
            val key=s.current+s.conversation.messages.hashCode()
            if(key!=rendered){rendered=key;content.removeAllViews()
                if(s.conversation.messages.isEmpty())content.addView(TextView(context).apply{text="영상 속 상품이 궁금하면 바로 물어보세요. 화면 함께 보기는 전체 앱에서 직접 허용할 때만 켜집니다.";textSize=14f;setTextColor(0xFF777185.toInt());setPadding(0,dp(24),0,dp(24))})
                s.conversation.messages.takeLast(12).forEach {m->
                    content.addView(TextView(context).apply{text=(if(m.role=="user")"나\n" else "✦ AI\n")+m.text;textSize=14f;setTextColor(0xFF282337.toInt());setTextIsSelectable(true);background=rounded(if(m.role=="user")0xFFECE5FF.toInt()else 0xFFF3EFF8.toInt());setPadding(dp(12),dp(12),dp(12),dp(12))},LinearLayout.LayoutParams(-1,-2).apply{topMargin=dp(10)})
                    m.links.forEach {link->content.addView(Button(context).apply{text=link.title;isAllCaps=false;textSize=12f;setOnClickListener{MobileInputPolicy.safeUrl(link.url).takeIf{it.isNotBlank()}?.let{safe->runCatching{context.startActivity(Intent(Intent.ACTION_VIEW,android.net.Uri.parse(safe)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))}}}})}
                };scroll.post{scroll.fullScroll(View.FOCUS_DOWN)}
            }
        }}
    }
    fun close(restore:Boolean=true){if(root==null){if(current===this)current=null;return};context.getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(root!!.windowToken,0);runCatching{windows.removeViewImmediate(root)};root=null;scope.cancel();if(current===this)current=null;if(restore)folded()}
    companion object {private var current:FloatingAiPanel?=null;val visible get()=current!=null}
}
