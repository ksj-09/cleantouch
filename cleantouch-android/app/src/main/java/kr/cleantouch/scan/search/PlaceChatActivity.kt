package kr.cleantouch.scan.search

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.provider.Settings
import android.Manifest
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.cleantouch.scan.MobileTheme
import kr.cleantouch.scan.capture.*
import kotlinx.coroutines.*

class PlaceChatActivity:ComponentActivity() {
    companion object {var foreground=false;private set}
    private var restoreWidget=false
    override fun onResume(){super.onResume();foreground=true;FloatingScanService.hide(this)}
    override fun onPause(){foreground=false;super.onPause()}
    override fun onDestroy(){if(isFinishing&&restoreWidget&&FloatingScanService.running)FloatingScanService.show(this);super.onDestroy()}
    override fun onNewIntent(intent:Intent){super.onNewIntent(intent);setIntent(intent);receive(intent)}
    private fun receive(intent:Intent){restoreWidget=intent.getBooleanExtra("restoreWidget",false);intent.getStringExtra("scene")?.let {MobileChatController.attachPrivate(it,intent.getBooleanExtra("product",false))}}
    override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);MobileChatController.initialize(this);if(savedInstanceState==null)receive(intent)
        setContent {MobileTheme {Chat()}}
    }
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable private fun Chat(){
        val state by MobileChatController.state.collectAsState();val chat=state.conversation
        val scope=rememberCoroutineScope();val drawer=rememberDrawerState(DrawerValue.Closed)
        val list=rememberLazyListState();var shareConsent by rememberSaveable {mutableStateOf(false)}
        var deleting by remember {mutableStateOf<String?>(null)};var selecting by remember {mutableStateOf(false)}
        var guide by rememberSaveable {mutableStateOf(false)};var more by remember {mutableStateOf(false)}
        val photo by produceState<Bitmap?>(null,chat.photo){value=withContext(Dispatchers.IO){if(chat.photo.isBlank())null else BitmapFactory.decodeFile(chat.photo)}}
        val picker=rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()){uri->if(uri!=null)MobileChatController.attach(uri)}
        fun conversationText()=chat.messages.joinToString("\n\n"){"${if(it.role=="user") "나" else "CleanTouch AI"}: ${it.text}"}
        fun shareConversation(){val text=conversationText();if(text.isBlank()){android.widget.Toast.makeText(this,"공유할 대화가 아직 없어요.",android.widget.Toast.LENGTH_SHORT).show();return};startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text),"대화 공유"))}
        fun copyConversation(){val text=conversationText();if(text.isBlank()){android.widget.Toast.makeText(this,"복사할 대화가 아직 없어요.",android.widget.Toast.LENGTH_SHORT).show();return};getSystemService(android.content.ClipboardManager::class.java).setPrimaryClip(android.content.ClipData.newPlainText("CleanTouch 대화",text));android.widget.Toast.makeText(this,"대화를 복사했어요.",android.widget.Toast.LENGTH_SHORT).show()}
        val projection=rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()){result->
            if(result.resultCode==Activity.RESULT_OK&&result.data!=null){if(FloatingScanService.running)FloatingScanService.stop(this);AiScreenShareService.start(this,result.resultCode,result.data!!)}
        }
        fun requestProjection(){projection.launch(getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent())}
        val overlayPermission=rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()){requestProjection()}
        fun prepareShare(){if(Settings.canDrawOverlays(this))requestProjection()else overlayPermission.launch(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:$packageName")))}
        val notifications=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){prepareShare()}
        LaunchedEffect(chat.id,chat.messages.size,state.busy){if(chat.messages.isNotEmpty()){withFrameNanos{};list.animateScrollToItem((list.layoutInfo.totalItemsCount-1).coerceAtLeast(0))}}
        if(shareConsent)AlertDialog(onDismissRequest={shareConsent=false},title={Text("AI와 화면 함께 보기")},text={Text("직접 허용한 화면의 바뀌는 장면을 AI에 보내고, 질문에 답합니다. 마이크·소리·실제 위치는 보내지 않아요.\n\nAndroid 권한창에서는 YouTube 같은 앱 하나를 선택하는 것을 권장합니다. 전체 화면을 선택하면 알림 등 다른 화면도 포함될 수 있어요. 작은 AI 버튼을 쓰려면 ‘다른 앱 위에 표시’를 허용하세요.\n\n장면 모으기는 멈추고 기존 장면과 상품 목록은 보관합니다. 공유 종료 버튼이나 알림에서 언제든 끌 수 있어요.")},confirmButton={TextButton(onClick={shareConsent=false;if(Build.VERSION.SDK_INT>=33)notifications.launch(Manifest.permission.POST_NOTIFICATIONS)else prepareShare()}){Text("권한 확인하고 공유")}},dismissButton={TextButton(onClick={shareConsent=false}){Text("취소")}})
        if(deleting!=null)AlertDialog(onDismissRequest={deleting=null},title={Text("이 대화를 삭제할까요?")},text={Text("대화와 첨부 사진이 이 기기에서 삭제됩니다.")},confirmButton={TextButton(onClick={MobileChatController.delete(deleting!!);deleting=null}){Text("삭제")}},dismissButton={TextButton(onClick={deleting=null}){Text("취소")}})
        if(guide)AlertDialog(onDismissRequest={guide=false},title={Text("필요할 때만, 가볍게")},text={Text("① 사진 없이 편하게 질문하세요.\n② 사진 업로드는 현재 대화에 첨부됩니다.\n③ 화면 함께 보기를 허용하고 영상 앱으로 돌아가세요. 작은 AI 버튼이나 알림을 누르면 질문할 수 있어요.\n④ 상품 선택은 사진 속 물건을 터치해 분석합니다. 구매 후보의 사진은 판매 페이지에서 비교하세요.\n⑤ 왼쪽 내 대화에서 이전 대화를 이어갈 수 있어요.")},confirmButton={TextButton(onClick={guide=false}){Text("알겠어요")}})
        if(selecting&&photo!=null)ProductSelection(photo!!,onDismiss={selecting=false},selected={selected->selecting=false;MobileChatController.selected(selected)})
        ModalNavigationDrawer(drawerState=drawer,drawerContent={
            ModalDrawerSheet(Modifier.width(290.dp)){
                Row(Modifier.fillMaxWidth().padding(16.dp),verticalAlignment=Alignment.CenterVertically){Text("내 대화",fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));TextButton(onClick={scope.launch{drawer.close()}}){Text("닫기")}}
                Button(onClick={MobileChatController.newConversation()},modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp)){Text("＋ 새 대화")}
                LazyColumn(Modifier.weight(1f).padding(8.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
                    items(state.chats.sortedByDescending{it.updated},key={it.id}){c->
                        Surface(shape=RoundedCornerShape(16.dp),color=if(c.id==chat.id)MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface){Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
                            Column(Modifier.weight(1f).clickable{MobileChatController.choose(c.id)}.padding(14.dp)){
                                Text(c.title,maxLines=2,fontWeight=FontWeight.Medium);Text(java.text.SimpleDateFormat("M월 d일",java.util.Locale.KOREA).format(java.util.Date(c.updated)),fontSize=11.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
                            };TextButton(onClick={deleting=c.id}){Text("삭제",fontSize=12.sp)}
                        }}
                    }
                }
                Text("대화는 이 기기에 저장됩니다 · 최대 40개",Modifier.padding(18.dp),fontSize=11.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }){
            Surface(Modifier.fillMaxSize()){
                Column(Modifier.fillMaxSize().safeDrawingPadding().imePadding().padding(horizontal=16.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
                        TextButton(onClick={scope.launch{drawer.open()}}){Text("☰",fontSize=23.sp)}
                        Column(Modifier.weight(1f)){Text("CleanTouch AI",fontSize=20.sp,fontWeight=FontWeight.Bold);Text(chat.title.takeUnless{it=="새 대화"}?:"보고, 물어보고, 찾아보세요",fontSize=11.sp,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=1)}
                        Box{TextButton(onClick={more=true}){Text("•••",fontSize=16.sp)};DropdownMenu(expanded=more,onDismissRequest={more=false}){
                            DropdownMenuItem(text={Text("대화 공유")},onClick={more=false;shareConversation()})
                            DropdownMenuItem(text={Text("대화 내용 복사")},onClick={more=false;copyConversation()})
                            DropdownMenuItem(text={Text(if(state.sharing)"화면 공유 종료" else "화면 함께 보기")},onClick={more=false;if(state.sharing)MobileChatController.stopSharing()else shareConsent=true})
                            DropdownMenuItem(text={Text("사진 업로드")},onClick={more=false;picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))})
                            DropdownMenuItem(text={Text("개인정보·사용법")},onClick={more=false;guide=true})
                        }}
                        TextButton(onClick={finish()}){Text("닫기")}
                    }
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        Button(onClick={if(state.sharing)MobileChatController.stopSharing()else shareConsent=true},modifier=Modifier.weight(1f),colors=if(state.sharing)ButtonDefaults.buttonColors(containerColor=MaterialTheme.colorScheme.errorContainer,contentColor=MaterialTheme.colorScheme.onErrorContainer)else ButtonDefaults.buttonColors()){Text(if(state.sharing)"화면 공유 종료" else "화면 함께 보기",fontSize=13.sp)}
                        OutlinedButton(onClick={picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))},enabled=!state.busy,modifier=Modifier.weight(1f)){Text("사진 업로드",fontSize=13.sp)}
                    }
                    if(state.sharing)Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text(if(state.frameAt==0L)"● 공유할 영상 앱을 열어 주세요" else "● 최근 장면을 보며 질문에 답해요",fontSize=11.sp,color=MaterialTheme.colorScheme.primary);TextButton(onClick={moveTaskToBack(true)}){Text("영상으로",fontSize=12.sp)}}
                    LazyColumn(Modifier.weight(1f).fillMaxWidth(),state=list,verticalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(vertical=8.dp)){
                        if(photo!=null&&!state.sharing)item {
                            Surface(shape=RoundedCornerShape(20.dp),color=MaterialTheme.colorScheme.surfaceContainer){Column(Modifier.fillMaxWidth().padding(12.dp)){
                                Image(photo!!.asImageBitmap(),"첨부한 사진",Modifier.fillMaxWidth().height(180.dp),contentScale=ContentScale.Fit)
                                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){TextButton(onClick={selecting=true},enabled=!state.busy){Text("상품 터치 · 분석")};TextButton(onClick={MobileChatController.forgetPhoto()},enabled=!state.busy){Text("사진 제거")}}
                            }}
                        }
                        if(chat.messages.isEmpty())item {Column(Modifier.padding(vertical=30.dp)){
                            Text("궁금한 순간에\n말만 걸어보세요.",fontSize=29.sp,lineHeight=38.sp,fontWeight=FontWeight.Bold)
                            Spacer(Modifier.height(14.dp));Text("사진 없이 대화할 수 있어요. 화면을 함께 보면 영상 속 상품과 장소도 찾아드립니다.",color=MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.height(20.dp));listOf("어떤 기능을 쓸 수 있어?","사진 속 상품을 찾으려면 어떻게 해?").forEach {q->OutlinedButton(onClick={MobileChatController.send(q)},enabled=!state.busy){Text(q,fontSize=13.sp)}}
                        }}
                        itemsIndexed(chat.messages){_,m->Row(Modifier.fillMaxWidth(),horizontalArrangement=if(m.role=="user")Arrangement.End else Arrangement.Start){Surface(Modifier.widthIn(max=340.dp),shape=RoundedCornerShape(20.dp),color=if(m.role=="user")MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainer){Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                            Text(if(m.role=="user")"나" else "✦ CleanTouch",fontSize=11.sp,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.Bold)
                            androidx.compose.foundation.text.selection.SelectionContainer{Text(m.text,fontSize=15.sp,lineHeight=23.sp)}
                            m.links.forEach {link->OutlinedButton(onClick={open(link.url)},modifier=Modifier.fillMaxWidth()){Text(link.title,fontSize=12.sp)}}
                        }}}}
                        if(state.busy)item{Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)){CircularProgressIndicator(Modifier.size(18.dp),strokeWidth=2.dp);Text(state.status,fontSize=12.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)}}
                    }
                    if(state.error.isNotBlank())Surface(shape=RoundedCornerShape(12.dp),color=MaterialTheme.colorScheme.errorContainer){Column(Modifier.padding(12.dp)){
                        Text(state.error,fontSize=12.sp);Row{TextButton(onClick={MobileChatController.retry()},enabled=!state.busy){Text("다시 시도")};TextButton(onClick={MobileChatController.clearError()}){Text("닫기")}}
                    }}
                    if(state.busy)TextButton(onClick={MobileChatController.cancel()}){Text("답변 멈추기")}
                    Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Bottom,horizontalArrangement=Arrangement.spacedBy(8.dp)){
                        OutlinedTextField(chat.draft,{MobileChatController.draft(it)},Modifier.weight(1f),placeholder={Text("이 가방 찾아줘, 여기는 어디야?",fontSize=13.sp)},maxLines=4,shape=RoundedCornerShape(20.dp),enabled=state.loaded&&!state.busy)
                        Button(onClick={MobileChatController.send()},enabled=state.loaded&&!state.busy&&chat.draft.isNotBlank(),modifier=Modifier.height(56.dp)){Text("전송")}
                    }
                    Text(if(state.sharing)"공유 중 · 마이크·소리·위치는 보내지 않아요" else if(photo!=null)"첨부한 사진으로 대화 · 화면 공유 꺼짐" else "일반 대화 · 화면 공유 꺼짐 · 기록은 기기에서 암호화",fontSize=10.sp,color=MaterialTheme.colorScheme.onSurfaceVariant,modifier=Modifier.padding(bottom=6.dp))
                }
            }
        }
    }
    private fun open(url:String){runCatching{val safe=MobileInputPolicy.safeUrl(url);require(safe.isNotBlank());startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(safe)))}.onFailure{android.widget.Toast.makeText(this,"안전하게 열 수 없는 링크예요.",android.widget.Toast.LENGTH_SHORT).show()}}
}

@Composable private fun ProductSelection(image:Bitmap,onDismiss:()->Unit,selected:(Bitmap)->Unit){
    val context=androidx.compose.ui.platform.LocalContext.current;val scope=rememberCoroutineScope()
    var busy by remember{mutableStateOf(false)};var error by remember{mutableStateOf("")};var mask by remember{mutableStateOf<Bitmap?>(null)}
    androidx.compose.ui.window.Dialog(onDismissRequest={if(!busy)onDismiss()},properties=androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth=false)){
        Surface(Modifier.fillMaxSize().safeDrawingPadding(),color=MaterialTheme.colorScheme.background){Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            Text("상품 안쪽을 한 번 누르세요",fontSize=21.sp,fontWeight=FontWeight.Bold)
            Text("선택한 부분을 확인한 뒤 AI에 보냅니다.",fontSize=13.sp,color=MaterialTheme.colorScheme.onSurfaceVariant)
            Box(Modifier.weight(1f).fillMaxWidth().pointerInput(image,busy,mask){detectTapGestures{point->if(busy||mask!=null)return@detectTapGestures
                val scale=minOf(size.width.toFloat()/image.width,size.height.toFloat()/image.height);val x=(point.x-(size.width-image.width*scale)/2)/scale/image.width;val y=(point.y-(size.height-image.height*scale)/2)/scale/image.height
                if(x !in 0f..1f||y !in 0f..1f)return@detectTapGestures
                busy=true;error="";scope.launch{try{mask=withContext(Dispatchers.Default){PointObjectMasker(context.applicationContext).use{it.isolate(image,x,y)}};if(mask==null)error="윤곽을 찾지 못했어요. 상품의 안쪽을 다시 눌러 주세요."}catch(e:Exception){if(e is CancellationException)throw e;error="상품 선택에 실패했어요. 다시 눌러 주세요."}finally{busy=false}}
            }}){Image((mask?:image).asImageBitmap(),"상품 터치 선택 화면",Modifier.fillMaxSize(),contentScale=ContentScale.Fit)}
            if(busy)LinearProgressIndicator(Modifier.fillMaxWidth())
            if(error.isNotBlank())Text(error,color=MaterialTheme.colorScheme.error,fontSize=12.sp)
            if(mask!=null)Button(onClick={val chosen=mask!!;val white=Bitmap.createBitmap(chosen.width,chosen.height,Bitmap.Config.ARGB_8888);Canvas(white).apply{drawColor(android.graphics.Color.WHITE);drawBitmap(chosen,0f,0f,null)};selected(white)},enabled=!busy,modifier=Modifier.fillMaxWidth()){Text("이 상품으로 AI 분석")}
            Row{TextButton(onClick={mask=null},enabled=!busy&&mask!=null){Text("다시 선택")};TextButton(onClick=onDismiss,enabled=!busy){Text("취소")}}
        }}
    }
}
