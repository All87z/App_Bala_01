package com.balanca.assistente.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Paleta focada em alto contraste e máxima legibilidade para caixas e operadores de balança
val PrimaryYellow = Color(0xFFF59E0B)
val PrimaryYellowDark = Color(0xFFD97706)
val BackgroundDark = Color(0xFF0F172A)
val SurfaceDark = Color(0xFF1E293B)
val SurfaceVariantDark = Color(0xFF334155)
val TextLight = Color(0xFFF8FAFC)
val TextMuted = Color(0xFF94A3B8)
val CodeHighlight = Color(0xFF38BDF8)
val AccentGreen = Color(0xFF10B981)
val DangerRed = Color(0xFFEF4444)

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryYellow,
    onPrimary = Color(0xFF1E293B),
    secondary = CodeHighlight,
    onSecondary = Color(0xFF0F172A),
    background = BackgroundDark,
    surface = SurfaceDark,
    surfaceVariant = SurfaceVariantDark,
    onBackground = TextLight,
    onSurface = TextLight,
    error = DangerRed
)

private val LightColorScheme = lightColorScheme(
    primary = PrimaryYellowDark,
    onPrimary = Color.White,
    secondary = Color(0xFF0284C7),
    onSecondary = Color.White,
    background = Color(0xFFF8FAFC),
    surface = Color.White,
    surfaceVariant = Color(0xFFF1F5F9),
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A),
    error = DangerRed
)

@Composable
fun AssistenteDeBalancaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
