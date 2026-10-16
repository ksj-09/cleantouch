package kr.cleantouch.scan

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import kr.cleantouch.scan.capture.FloatingScanService
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job

private val Ink = Color(0xFFFBF9F6)
private val Panel = Color(0xFFFFFDFC)
private val Lilac = Color(0xFF7052E8)
private val Muted = Color(0xFF777185)
private val Mint = Color(0xFF486C5C)

class MainActivity : ComponentActivity() {
    companion object { var foreground = false; private set }
    override fun onResume() {
        super.onResume()
        foreground = true
        FloatingScanService.hide(this)
    }
    override fun onPause() {
        super.onPause()
        foreground = false
        if (ScanSessionStore.state.value.captureActive) FloatingScanService.show(this)
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScanSessionStore.initialize(this)
        setContent {
            MobileTheme {
                Screen()
            }
        }
    }

    @Composable private fun Screen() {
        val snapshot by ScanSessionStore.state.collectAsState()
        var pending by rememberSaveable { mutableStateOf(false) }
        var consent by remember { mutableStateOf(false) }
        var status by remember { mutableStateOf("") }
        var tutorial by rememberSaveable { mutableStateOf(!getSharedPreferences("onboarding",0).getBoolean("seen_v1",false)) }
        if(tutorial) AlertDialog(onDismissRequest={ tutorial=false;getSharedPreferences("onboarding",0).edit().putBoolean("seen_v1",true).apply() },
            title={Text("영상 속 마음에 드는 순간")},text={Text("1. 원을 눌러 스캔을 시작하세요. 권한을 허용하면 작은 버튼이 화면에 떠요.\n\n2. YouTube나 Instagram을 보다가 버튼을 누르고, 찾을 상품 안쪽을 터치하세요.\n\n3. AI로 비슷한 상품을 찾거나 Lens에서 비교하세요. 모두 분석은 스캔을 잠시 멈추고 모은 장면을 분석합니다.\n\nAI 대화는 사진 없이도 가능합니다. 화면 공유는 직접 허용할 때만 켜져요.")},
            confirmButton={TextButton(onClick={tutorial=false;getSharedPreferences("onboarding",0).edit().putBoolean("seen_v1",true).apply()}){Text("시작하기")}})
        val coroutineScope = rememberCoroutineScope()
        var analysisJob by remember { mutableStateOf<Job?>(null) }
        val manager = getSystemService(MediaProjectionManager::class.java)
        val projection = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                runCatching { FloatingScanService.start(this, result.resultCode, result.data!!) }
                    .onFailure { status = it.message ?: "시작하지 못했어요."; pending = false }
            } else { pending = false; status = "화면 공유가 취소됐어요." }
        }
        fun launchProjection() {
            pending = true
            runCatching {
                projection.launch(if (Build.VERSION.SDK_INT >= 34) manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay()) else manager.createScreenCaptureIntent())
            }.onFailure { pending = false; status = "화면 공유 확인창을 열지 못했어요." }
        }
        val overlayPermission = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            if (Settings.canDrawOverlays(this)) launchProjection()
            else { pending = false; status = "떠다니는 버튼을 쓰려면 다른 앱 위에 표시를 허용해 주세요." }
        }
        fun prepareProjection() {
            if (Settings.canDrawOverlays(this)) launchProjection()
            else overlayPermission.launch(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
        }
        val notifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { prepareProjection() }
        fun start() {
            if (snapshot.busy || pending) return
            consent = true
        }
        LaunchedEffect(snapshot.phase, snapshot.id, snapshot.message) {
            if (snapshot.phase == ScanPhase.RECORDING || snapshot.phase == ScanPhase.INTERRUPTED) pending = false
        }

        if (consent) AlertDialog(
            onDismissRequest = { consent = false },
            title = { Text("화면 스캔 시작") },
            text = { Text("작은 위젯을 띄운 뒤 YouTube나 Instagram에서 영상을 보세요. 위젯의 ‘상품 터치’를 누르면 찾을 물건을 직접 고를 수 있어요.\n\n약 3초 간격으로 장면을 기기에 보관합니다(최대 240장면). 소리는 저장하지 않아요. ‘모두 분석’이나 상품 AI 분석을 누르면 선택한 사진을 AI에 보내 상품을 확인합니다. Lens 검색은 상품 사진을 Google에 보냅니다.") },
            confirmButton = { TextButton(onClick = {
                consent = false
                pending = true
                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                else prepareProjection()
            }) { Text("동의하고 시작") } },
            dismissButton = { TextButton(onClick = { consent = false }) { Text("취소") } },
        )

        Surface(Modifier.fillMaxSize(), color = Ink) {
            MobileDashboard(snapshot, pending, status, toggle = {
                if (snapshot.captureActive) FloatingScanService.stop(this) else start()
            }, showWidget = { FloatingScanService.show(this); moveTaskToBack(true) }, analyzeAll = {
                if (snapshot.captureActive) FloatingScanService.analyzeAll(this)
                else {
                    ScanSessionStore.update { it.copy(phase = ScanPhase.ANALYZING) }
                    analysisJob = coroutineScope.launch {
                    try { LocalSceneAnalyzer(applicationContext).analyze() }
                    catch (error: CancellationException) { ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED) }; throw error }
                    catch (error: Exception) { ScanSessionStore.update { it.copy(phase = ScanPhase.INTERRUPTED, message = error.message ?: "분석하지 못했어요.") } }
                    }
                }
            }, cancelAnalysis = {
                if(FloatingScanService.running)FloatingScanService.cancelAnalysis(this) else {
                    analysisJob?.cancel();ScanSessionStore.update {it.copy(phase=ScanPhase.PAUSED,message="분석을 멈췄어요. 남은 장면은 다시 분석할 수 있어요.")}
                }
            }, guide = {tutorial=true}, resume = { FloatingScanService.resume(this) }, openScene = { scene ->
                if (Settings.canDrawOverlays(this)) FloatingScanService.openScene(this, scene)
                else status = "지난 장면에서 상품을 고르려면 다른 앱 위에 표시를 허용해 주세요."
            }, open = { url ->
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }.onFailure { status = "이 링크를 열 수 있는 앱이 없어요." }
            }, placeChat = {
                startActivity(Intent(this,PlaceChatActivity::class.java).putExtra("restoreWidget",snapshot.captureActive))
            }, searchProduct = { product ->
                startActivity(Intent(this,PlaceChatActivity::class.java).putExtra("scene",product.thumbnail).putExtra("product",true).putExtra("restoreWidget",snapshot.captureActive))
            }, lensProduct = { product ->
                runCatching {
                    val image = FileProvider.getUriForFile(this, "$packageName.fileprovider", java.io.File(product.thumbnail))
                    startActivity(Intent(this, LensSearchActivity::class.java).apply {
                        putExtra(LensSearchActivity.EXTRA_IMAGE_URI, image.toString())
                        putExtra(LensSearchActivity.EXTRA_IMAGE_MIME_TYPE, if (product.thumbnail.endsWith(".png")) "image/png" else "image/jpeg")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    })
                }.onFailure { status = "Google Lens를 열지 못했어요." }
            })
        }
    }
}

@Composable private fun MobileDashboard(snapshot: ScanSnapshot, pending: Boolean, status: String, toggle: () -> Unit,
    showWidget: () -> Unit, analyzeAll: () -> Unit, cancelAnalysis: () -> Unit, guide: () -> Unit, resume: () -> Unit, openScene: (CapturedScene) -> Unit,
    open: (String) -> Unit, placeChat: () -> Unit, searchProduct: (RecordedProduct) -> Unit, lensProduct: (RecordedProduct) -> Unit) {
    val analyzing = snapshot.phase == ScanPhase.ANALYZING
    var filter by rememberSaveable(snapshot.id) { mutableStateOf("") }
    LazyColumn(Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = 22.dp), horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Spacer(Modifier.height(6.dp)); Brand(guide) }
        item {
            Text("영상에서 마음에 든 상품,\n한 번 눌러 찾아보세요.", fontSize = 25.sp, lineHeight = 34.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(22.dp))
            Box(Modifier.size(230.dp).border(1.dp, Lilac.copy(alpha = .3f), CircleShape), contentAlignment = Alignment.Center) {
                Button(onClick = toggle, enabled = !pending && !analyzing, shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (snapshot.captureActive) Color(0xFF6D55C8) else Color(0xFF34304F),
                        contentColor = Color.White,
                        disabledContainerColor = Color(0xFF34304F), disabledContentColor = Color(0xFFE5E0F4)),
                    modifier = Modifier.size(194.dp)) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(painterResource(R.drawable.ic_scan_notification), null, Modifier.size(40.dp))
                        Spacer(Modifier.height(12.dp))
                        Text(if (pending) "준비 중" else if (snapshot.captureActive) "ON" else "OFF", fontSize = 30.sp, fontWeight = FontWeight.Bold)
                        Text(if (snapshot.captureActive) "눌러서 스캔 종료" else "눌러서 스캔 시작", fontSize = 12.sp)
                    }
                }
            }
        }
        item {
            Text(if (snapshot.captureActive) "유튜브·인스타로 이동한 뒤 작은 ✦ 위젯을 누르세요." else "원을 누르면 스캔을 시작하고 작은 위젯이 나타나요.", color = Muted, fontSize = 13.sp)
            if (snapshot.captureActive) TextButton(onClick = showWidget) { Text("위젯으로 돌아가기") }
            Text("보관한 장면 ${snapshot.scenes.size}개 · 찾은 상품 ${snapshot.products.size}개", color = Mint, fontSize = 13.sp)
        }
        item {
            Button(onClick=placeChat,modifier=Modifier.fillMaxWidth()){Text("✦ AI에게 물어보기")}
            Button(onClick = analyzeAll, enabled = snapshot.scenes.isNotEmpty() && !analyzing && !pending, modifier = Modifier.fillMaxWidth()) {
                Text(if (analyzing) "모든 장면을 분석하고 있어요…" else "모두 분석 · 스캔 일시정지")
            }
            if (snapshot.captureActive && snapshot.phase != ScanPhase.RECORDING && !analyzing) TextButton(onClick = resume) { Text("스캔 계속하기") }
            if (analyzing) {
                TextButton(onClick=cancelAnalysis){Text("분석 멈추기 · 결과 보관")}
                LinearProgressIndicator(progress = { snapshot.completedFrames.size.toFloat() / snapshot.totalFrames.coerceAtLeast(1) }, modifier = Modifier.fillMaxWidth())
                Text("${snapshot.completedFrames.size} / ${snapshot.totalFrames} 장면", fontSize = 12.sp, color = Muted)
            }
            if (snapshot.message.isNotBlank()) Text(snapshot.message, fontSize = 12.sp, color = Mint)
            if (status.isNotBlank()) Text(status, fontSize = 12.sp, color = Mint)
        }
        if (snapshot.products.isNotEmpty()) {
            item { OutlinedTextField(filter, { filter = it }, modifier = Modifier.fillMaxWidth(), label = { Text("찾은 상품 검색") }, singleLine = true) }
            items(snapshot.products.filter { it.label.contains(filter, true) }, key = { it.id }) { ProductCard(it, open, searchProduct, lensProduct) }
        }
        if (snapshot.scenes.isNotEmpty()) {
            item { Text("지난 장면에서 직접 찾기", fontWeight = FontWeight.Bold); Text("장면을 열고 상품을 누르세요. 자동 인식이 놓친 물건도 찾을 수 있어요.", color = Muted, fontSize = 12.sp) }
            items(snapshot.scenes.asReversed(), key = { "${it.timeMs}:${it.path}" }) { scene ->
                val bitmap by produceState<android.graphics.Bitmap?>(null, scene.path) { value = withContext(Dispatchers.IO) { BitmapFactory.decodeFile(scene.path) } }
                Card(Modifier.fillMaxWidth().clickable(enabled = !analyzing) { openScene(scene) }, colors = CardDefaults.cardColors(containerColor = Panel)) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        bitmap?.let { Image(it.asImageBitmap(), "저장한 장면", Modifier.size(88.dp), contentScale = ContentScale.Fit) }
                        Text("${videoTimeLabel(scene.timeMs)} 장면 · 상품 누르기", fontSize = 14.sp)
                    }
                }
            }
        }
        item { Text("자동 분석은 지원하는 물건의 후보를 찾습니다. 모든 상품이나 동일 판매상품을 보장하지 않습니다.", color = Muted, fontSize = 11.sp); Spacer(Modifier.height(20.dp)) }
    }
}

@Composable private fun Brand(guide:()->Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(painterResource(R.drawable.ic_scan_notification), null, Modifier.size(30.dp), tint = Lilac)
        Text("CleanTouch", fontSize = 21.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        TextButton(onClick=guide){Text("사용법",fontSize=12.sp)}
    }
}

@Composable private fun ProductCard(product: RecordedProduct, open: (String) -> Unit, analyze: (RecordedProduct) -> Unit, shareImage: (RecordedProduct) -> Unit) {
    val bitmap by produceState<android.graphics.Bitmap?>(null, product.thumbnail) {
        value = withContext(Dispatchers.IO) { BitmapFactory.decodeFile(product.thumbnail) }
    }
    Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            val image = bitmap
            if (image != null) Image(image.asImageBitmap(), product.label, Modifier.size(88.dp).clip(RoundedCornerShape(14.dp)), contentScale = ContentScale.Fit)
            else Box(Modifier.size(88.dp).background(Ink, RoundedCornerShape(14.dp)))
            Column(Modifier.weight(1f)) {
                Text(product.label, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                Spacer(Modifier.height(5.dp))
                Text(product.sightings.joinToString(" · ") { videoTimeLabel(it) } + "에 등장", color = Lilac, fontSize = 11.sp)
                Text("동일 상품 여부·가격은 판매처에서 확인", color = Muted, fontSize = 10.sp)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal=10.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            Button(onClick={analyze(product)},modifier=Modifier.weight(1f)){Text("AI 분석 · 구매 찾기",fontSize=12.sp)}
            OutlinedButton(onClick={shareImage(product)}){Text("Lens",fontSize=12.sp)}
        }
        product.matches.forEach { match ->
            TextButton(onClick = { open(match.url) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp)) {
                Text(match.source + if (match.matchKind == "search_link") "에서 비슷한 상품 찾기  ↗" else " 상품 후보 보기  ↗", fontSize = 12.sp)
            }
        }
    }
}

private fun videoTimeLabel(sceneId: Long): String {
    val stamp = ScanSessionStore.state.value.timeMarks[sceneId] ?: return "시간 미확인"
    return "영상 ${stamp.number} · ${formatTime(stamp.positionMs)}" + if (stamp.estimated) " (시청 추정)" else ""
}

private fun formatTime(milliseconds: Long): String {
    val seconds = (milliseconds / 1000).coerceAtLeast(0)
    return "%02d:%02d".format(seconds / 60, seconds % 60)
}
