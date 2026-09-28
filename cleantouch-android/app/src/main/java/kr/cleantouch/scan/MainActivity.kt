package kr.cleantouch.scan

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.ClipData
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import kr.cleantouch.scan.capture.ScreenCaptureService
import kr.cleantouch.scan.search.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

private val Ink = Color(0xFF12121F)
private val Panel = Color(0xFF202032)
private val Lilac = Color(0xFFB9AAFF)
private val Muted = Color(0xFFA7A5BC)
private val Mint = Color(0xFF7AE7C7)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ScanSessionStore.initialize(this)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Lilac, background = Ink, surface = Panel)) {
                Screen()
            }
        }
    }

    @Composable private fun Screen() {
        val snapshot by ScanSessionStore.state.collectAsState()
        var pending by rememberSaveable { mutableStateOf(false) }
        var consent by remember { mutableStateOf(false) }
        var status by remember { mutableStateOf("") }
        val manager = getSystemService(MediaProjectionManager::class.java)
        val projection = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK && result.data != null) {
                runCatching { ScreenCaptureService.start(this, result.resultCode, result.data!!) }
                    .onFailure { status = it.message ?: "시작하지 못했어요."; pending = false }
            } else { pending = false; status = "화면 공유가 취소됐어요." }
        }
        fun launchProjection() {
            pending = true
            runCatching {
                projection.launch(if (Build.VERSION.SDK_INT >= 34) manager.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay()) else manager.createScreenCaptureIntent())
            }.onFailure { pending = false; status = "화면 공유 확인창을 열지 못했어요." }
        }
        val notifications = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { launchProjection() }
        fun start() {
            if (snapshot.busy || pending) return
            consent = true
        }
        LaunchedEffect(snapshot.phase, snapshot.id, snapshot.message) {
            if (snapshot.phase == ScanPhase.RECORDING || snapshot.phase == ScanPhase.INTERRUPTED) pending = false
        }

        if (consent) AlertDialog(
            onDismissRequest = { consent = false },
            title = { Text("화면 녹화 시작") },
            text = { Text("켜 둔 동안 다른 앱의 화면도 녹화됩니다. 소리는 녹음하지 않아요.\n\n끄면 녹화 장면을 상품 인식 서버에 보내 자동 분석합니다. 분석을 마치면 원본 녹화는 삭제하고, 상품 사진과 결과는 휴대폰에 남깁니다.") },
            confirmButton = { TextButton(onClick = {
                consent = false
                pending = true
                if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                else launchProjection()
            }) { Text("동의하고 시작") } },
            dismissButton = { TextButton(onClick = { consent = false }) { Text("취소") } },
        )

        Surface(Modifier.fillMaxSize(), color = Ink) {
            val showResults = snapshot.phase in setOf(ScanPhase.ANALYZING, ScanPhase.COMPLETE, ScanPhase.INTERRUPTED)
            if (showResults) Results(snapshot, pending, ::start, { ScreenCaptureService.retry(this) }, { ScreenCaptureService.cancel(this) }, { url ->
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }.onFailure { status = "이 링크를 열 수 있는 앱이 없어요." }
            }, { product ->
                runCatching {
                    val image = FileProvider.getUriForFile(this, "$packageName.fileprovider", java.io.File(product.thumbnail))
                    val share = Intent(Intent.ACTION_SEND).apply {
                        type = "image/jpeg"
                        putExtra(Intent.EXTRA_STREAM, image)
                        clipData = ClipData.newUri(contentResolver, "CleanTouch 상품 사진", image)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(Intent.createChooser(share, "상품 사진으로 비슷한 이미지 찾기"))
                }.onFailure { status = "상품 사진을 공유할 수 없어요." }
            }) else Home(snapshot, pending, status) {
                if (snapshot.phase == ScanPhase.RECORDING) ScreenCaptureService.stop(this) else start()
            }
        }
    }
}

@Composable private fun Brand() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(painterResource(R.drawable.ic_scan_notification), null, Modifier.size(30.dp), tint = Lilac)
        Text("CleanTouch", fontSize = 21.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        Text("SCREEN DISCOVERY", color = Muted, fontSize = 8.sp, letterSpacing = 1.sp)
    }
}

@Composable private fun Home(snapshot: ScanSnapshot, pending: Boolean, message: String, toggle: () -> Unit) {
    val on = snapshot.phase == ScanPhase.RECORDING
    var elapsed by remember { mutableLongStateOf(0) }
    LaunchedEffect(on, snapshot.startedAt) {
        while (on) { elapsed = (System.currentTimeMillis() - snapshot.startedAt).coerceAtLeast(0); delay(1_000) }
    }
    LazyColumn(Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Spacer(Modifier.height(16.dp)); Brand(); Spacer(Modifier.height(58.dp)) }
        item {
            Text(if (on) "취향을 담는 중" else "마음에 든 순간을,\n한 번에 모아보세요.", fontSize = 29.sp, lineHeight = 39.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(12.dp))
            Text(if (on) "다른 앱을 자유롭게 둘러보세요." else "켜고 둘러본 뒤, 끄면 상품이 모입니다.", color = Muted, fontSize = 13.sp)
            Spacer(Modifier.height(38.dp))
        }
        item {
            Box(Modifier.size(262.dp).border(1.dp, Lilac.copy(alpha = .12f), CircleShape), contentAlignment = Alignment.Center) {
                Box(Modifier.size(230.dp).border(1.dp, Lilac.copy(alpha = .22f), CircleShape), contentAlignment = Alignment.Center) {
                    Button(onClick = toggle, enabled = !pending, shape = CircleShape, contentPadding = PaddingValues(0.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = if (on) Color(0xFF6D55C8) else Color(0xFF34304F), contentColor = Color.White),
                        modifier = Modifier.size(198.dp).border(1.dp, Lilac.copy(alpha = .5f), CircleShape)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(painterResource(R.drawable.ic_scan_notification), null, Modifier.size(42.dp), tint = if (on) Mint else Lilac)
                            Spacer(Modifier.height(13.dp))
                            Text(if (pending) "준비 중" else if (on) "ON" else "OFF", fontSize = 27.sp, letterSpacing = 3.sp, fontWeight = FontWeight.Bold)
                            Text(if (on) "눌러서 종료" else "눌러서 시작", color = Color(0xFFD0C9ED), fontSize = 11.sp)
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            Text(if (on) formatTime(elapsed) else "READY WHEN YOU ARE", color = if (on) Mint else Muted, fontSize = 14.sp, letterSpacing = 2.sp)
            Spacer(Modifier.height(30.dp))
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Panel), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (on) "끄면 자동으로 분석해요" else "앱 안에서 시작하고, 앱 안에서 종료", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text(if (on) "앱으로 돌아와 원형 버튼을 눌러 주세요. 알림의 ‘종료하고 분석’으로도 끌 수 있어요."
                        else "녹화 중에는 평소처럼 영상을 보세요. 종료하면 인식한 상품을 사진과 함께 모아드려요.", color = Muted, fontSize = 12.sp, lineHeight = 19.sp)
                }
            }
            if (message.isNotEmpty()) Text(message, Modifier.padding(top = 14.dp), color = Mint, fontSize = 12.sp)
            Text("무음 녹화 · 분석 완료 후 원본 자동 삭제", Modifier.padding(top = 18.dp, bottom = 24.dp), fontSize = 10.sp, color = Muted)
        }
    }
}

@Composable private fun Results(snapshot: ScanSnapshot, pending: Boolean, onStart: () -> Unit, retry: () -> Unit, cancel: () -> Unit, open: (String) -> Unit, shareImage: (RecordedProduct) -> Unit) {
    val analyzing = snapshot.phase == ScanPhase.ANALYZING
    fun remainingSeconds() = ((snapshot.retryAtMillis - System.currentTimeMillis()).coerceAtLeast(0) + 999) / 1_000
    val retrySeconds by produceState(remainingSeconds(), snapshot.retryAtMillis) {
        do {
            value = remainingSeconds()
            if (value == 0L) break
            delay(1_000)
        } while (true)
    }
    var filter by rememberSaveable(snapshot.id) { mutableStateOf("") }
    val products = snapshot.products.filter { it.label.contains(filter, ignoreCase = true) }
    LazyColumn(Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Spacer(Modifier.height(16.dp)); Brand(); Spacer(Modifier.height(26.dp))
            Text(if (analyzing && retrySeconds > 0) "AI 응답을\n잠시 기다리고 있어요." else if (analyzing) "담아온 화면을\n살펴보고 있어요."
                else if (snapshot.phase == ScanPhase.INTERRUPTED) "분석이 잠시 멈췄어요." else "내 화면에서 찾은 상품", fontSize = 27.sp, lineHeight = 36.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Text("인식한 상품 " + snapshot.products.size + "개 · 녹화 " + formatTime(snapshot.durationMs), color = Mint, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            Text("인식 가능한 상품 후보입니다. 빠르게 지나가거나 가려진 상품은 누락될 수 있어요.", color = Muted, fontSize = 11.sp, lineHeight = 17.sp)
        }
        if (analyzing || snapshot.totalFrames > 0) item {
            Card(colors = CardDefaults.cardColors(containerColor = Panel)) {
                Column(Modifier.padding(18.dp)) {
                    if (snapshot.totalFrames == 0) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Lilac)
                    else LinearProgressIndicator(progress = { snapshot.completedFrames.size.toFloat() / snapshot.totalFrames.coerceAtLeast(1) }, modifier = Modifier.fillMaxWidth(), color = Lilac)
                    Spacer(Modifier.height(10.dp))
                    Text("전체 " + snapshot.totalFrames + "장면 중 " + snapshot.completedFrames.size + "장면 처리 완료", color = Muted, fontSize = 12.sp)
                    if (analyzing && retrySeconds > 0) Text("약 ${retrySeconds}초 후 자동으로 이어서 분석", color = Mint, fontSize = 12.sp)
                    if (snapshot.phase == ScanPhase.INTERRUPTED) Text("완료한 장면은 다시 분석하지 않아요.", color = Muted, fontSize = 11.sp)
                    if (analyzing) TextButton(onClick = cancel) { Text("분석 중지") }
                }
            }
        }
        if (snapshot.message.isNotBlank()) item {
            Text(snapshot.message, color = Color(0xFFFFCB9E), fontSize = 13.sp, lineHeight = 20.sp)
        }
        if (snapshot.phase == ScanPhase.INTERRUPTED && snapshot.recording.isFile) item {
            Button(onClick = retry, enabled = !pending && retrySeconds == 0L, modifier = Modifier.fillMaxWidth()) {
                Text(if (retrySeconds > 0) "약 ${retrySeconds}초 후 이어서 분석 가능" else "저장된 녹화 이어서 분석")
            }
        }
        if (snapshot.products.isNotEmpty()) item {
            OutlinedTextField(filter, { filter = it }, modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("상품 이름으로 찾기") }, shape = RoundedCornerShape(16.dp))
        }
        items(products, key = { it.id }) { product -> ProductCard(product, open, shareImage) }
        if (!analyzing && products.isEmpty()) item {
            Text(if (filter.isNotEmpty()) "검색어에 맞는 상품이 없어요." else "아직 표시할 상품이 없어요.", Modifier.padding(vertical = 24.dp), color = Muted)
        }
        if (!analyzing) item {
            Button(onClick = onStart, enabled = !pending, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text(if (pending) "준비 중…" else "새 화면 스캔 시작") }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable private fun ProductCard(product: RecordedProduct, open: (String) -> Unit, shareImage: (RecordedProduct) -> Unit) {
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
                Text(formatTime(product.firstSeenMs) + "에 등장", color = Lilac, fontSize = 11.sp)
                Text("동일 상품 여부·가격은 판매처에서 확인", color = Muted, fontSize = 10.sp)
            }
        }
        TextButton(onClick = { shareImage(product) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp)) {
            Text("상품 사진을 공유해 이미지로 찾기  ↗", fontSize = 12.sp)
        }
        product.matches.forEach { match ->
            TextButton(onClick = { open(match.url) }, modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp)) {
                Text(match.source + if (match.matchKind == "search_link") "에서 비슷한 상품 찾기  ↗" else " 상품 후보 보기  ↗", fontSize = 12.sp)
            }
        }
    }
}

private fun formatTime(milliseconds: Long): String {
    val seconds = (milliseconds / 1000).coerceAtLeast(0)
    return "%02d:%02d".format(seconds / 60, seconds % 60)
}
