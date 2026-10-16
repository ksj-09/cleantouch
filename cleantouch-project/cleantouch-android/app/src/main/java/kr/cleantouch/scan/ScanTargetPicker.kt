package kr.cleantouch.scan

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import kr.cleantouch.scan.search.FocusRect
import kotlin.math.min

private enum class TargetWindow(val label: String, val width: Float, val height: Float) {
    SMALL("작게", 0.32f, 0.24f),
    MEDIUM("보통", 0.48f, 0.34f),
    LARGE("넓게", 0.68f, 0.46f),
}

@Composable
fun ScanTargetPicker(
    bitmap: Bitmap,
    onCancel: () -> Unit,
    onConfirm: (FocusRect) -> Unit,
) {
    var center by remember { mutableStateOf(Offset(0.5f, 0.5f)) }
    var viewSize by remember { mutableStateOf(IntSize.Zero) }
    var targetWindow by remember { mutableStateOf(TargetWindow.MEDIUM) }

    Column(
        Modifier
            .fillMaxWidth()
            .background(Color(0xFFF7F9F9))
            .padding(horizontal = 18.dp, vertical = 16.dp),
    ) {
        Text("상품 위치 지정", color = Color(0xFF17272D), fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.height(6.dp))
        Text(
            "화면에서 찾을 상품의 가운데를 탭하세요. 선택한 영역을 확대해서 다시 검색합니다.",
            color = Color(0xFF718087),
            fontSize = 12.sp,
            lineHeight = 18.sp,
        )
        Spacer(Modifier.height(14.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .height(330.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(Color(0xFF15262D))
                .onSizeChanged { viewSize = it }
                .pointerInput(bitmap, viewSize) {
                    detectTapGestures { tap ->
                        val bounds = fittedImageBounds(viewSize, bitmap)
                        if (bounds.width > 0f && bounds.height > 0f) {
                            center = Offset(
                                ((tap.x - bounds.left) / bounds.width).coerceIn(0f, 1f),
                                ((tap.y - bounds.top) / bounds.height).coerceIn(0f, 1f),
                            )
                        }
                    }
                },
        ) {
            Image(
                bitmap.asImageBitmap(),
                contentDescription = "스캔할 화면",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
            Canvas(Modifier.fillMaxSize()) {
                val bounds = fittedImageBounds(viewSize, bitmap)
                if (bounds.width <= 0f || bounds.height <= 0f) return@Canvas
                val left = (center.x - targetWindow.width / 2f).coerceIn(0f, 1f - targetWindow.width)
                val top = (center.y - targetWindow.height / 2f).coerceIn(0f, 1f - targetWindow.height)
                val selection = Rect(
                    bounds.left + left * bounds.width,
                    bounds.top + top * bounds.height,
                    bounds.left + (left + targetWindow.width) * bounds.width,
                    bounds.top + (top + targetWindow.height) * bounds.height,
                )
                val dim = Color.Black.copy(alpha = 0.28f)
                drawRect(dim, Offset(bounds.left, bounds.top), Size(bounds.width, selection.top - bounds.top))
                drawRect(dim, Offset(bounds.left, selection.bottom), Size(bounds.width, bounds.bottom - selection.bottom))
                drawRect(dim, Offset(bounds.left, selection.top), Size(selection.left - bounds.left, selection.height))
                drawRect(dim, Offset(selection.right, selection.top), Size(bounds.right - selection.right, selection.height))
                drawRoundRect(Color(0xFF58DFF2), selection.topLeft, selection.size, cornerRadius = androidx.compose.ui.geometry.CornerRadius(18f, 18f), style = Stroke(width = 5f))
                drawCircle(Color(0xFF58DFF2), radius = 8f, center = selection.center)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).background(Color(0xFF58DFF2), RoundedCornerShape(4.dp)))
            Spacer(Modifier.width(7.dp))
            Text("파란 영역 안에 상품이 들어오도록 탭하세요.", color = Color(0xFF65757B), fontSize = 11.sp)
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            TargetWindow.entries.forEach { option ->
                if (option == targetWindow) {
                    Button(
                        onClick = { targetWindow = option },
                        modifier = Modifier.weight(1f).height(38.dp),
                        shape = RoundedCornerShape(11.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2C7D8D)),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                    ) { Text(option.label, fontSize = 11.sp) }
                } else {
                    OutlinedButton(
                        onClick = { targetWindow = option },
                        modifier = Modifier.weight(1f).height(38.dp),
                        shape = RoundedCornerShape(11.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp),
                    ) { Text(option.label, fontSize = 11.sp) }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            OutlinedButton(
                onClick = onCancel,
                modifier = Modifier.weight(1f).height(50.dp),
                shape = RoundedCornerShape(14.dp),
            ) { Text("취소") }
            Button(
                onClick = {
                    onConfirm(selectedFocusRect(center, targetWindow))
                },
                modifier = Modifier.weight(1.35f).height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF14272E)),
            ) { Text("이 위치로 검색") }
        }
    }
}

private fun selectedFocusRect(center: Offset, targetWindow: TargetWindow): FocusRect {
    val left = (center.x - targetWindow.width / 2f).coerceIn(0f, 1f - targetWindow.width)
    val top = (center.y - targetWindow.height / 2f).coerceIn(0f, 1f - targetWindow.height)
    return FocusRect(left, top, left + targetWindow.width, top + targetWindow.height)
}

private fun fittedImageBounds(viewSize: IntSize, bitmap: Bitmap): Rect {
    if (viewSize.width <= 0 || viewSize.height <= 0 || bitmap.width <= 0 || bitmap.height <= 0) return Rect.Zero
    val scale = min(viewSize.width.toFloat() / bitmap.width, viewSize.height.toFloat() / bitmap.height)
    val drawWidth = bitmap.width * scale
    val drawHeight = bitmap.height * scale
    return Rect(
        (viewSize.width - drawWidth) / 2f,
        (viewSize.height - drawHeight) / 2f,
        (viewSize.width + drawWidth) / 2f,
        (viewSize.height + drawHeight) / 2f,
    )
}
