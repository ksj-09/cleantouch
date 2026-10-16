package kr.cleantouch.scan

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

@Composable fun MobileTheme(content:@Composable ()->Unit){
    MaterialTheme(colorScheme=lightColorScheme(primary=Color(0xFF7052E8),onPrimary=Color.White,
        primaryContainer=Color(0xFFECE5FF),onPrimaryContainer=Color(0xFF39216F),
        background=Color(0xFFFBF9F6),surface=Color(0xFFFFFDFC),onSurface=Color(0xFF282337),
        surfaceContainer=Color(0xFFF3EFF8),onSurfaceVariant=Color(0xFF777185),outline=Color(0xFFDCD4E5)),content=content)
}
