package kr.cleantouch.scan.capture

import kotlin.math.*

/** Keep the connected foreground near the tap, using the same policy as the desktop app. */
internal object TapMask {
    data class Region(val pixels: BooleanArray, val left: Int, val top: Int, val right: Int, val bottom: Int)

    fun extract(values: FloatArray, width: Int, height: Int, x: Float, y: Float, cropped: Boolean = false): Region? {
        if (width <= 0 || height <= 0 || values.size != width * height) return null
        val cx = (x * width).toInt().coerceIn(0, width - 1)
        val cy = (y * height).toInt().coerceIn(0, height - 1)
        val radius = min(28, ceil(max(width, height) * .08).toInt())
        var seed = -1
        var peak = Float.NEGATIVE_INFINITY
        for (py in max(0, cy - radius)..min(height - 1, cy + radius)) {
            for (px in max(0, cx - radius)..min(width - 1, cx + radius)) {
                val index = py * width + px
                if (!values[index].isFinite()) continue
                val score = values[index] - hypot((px - cx).toFloat(), (py - cy).toFloat()) * .001f
                if (score > peak) { peak = score; seed = index }
            }
        }
        if (seed < 0 || values[seed] < .22f) return null
        val threshold = (values[seed] * .75f).coerceIn(.20f, .45f)
        val selected = BooleanArray(values.size)
        val queue = IntArray(values.size)
        var head = 0
        var tail = 1
        queue[0] = seed; selected[seed] = true
        var left = width; var top = height; var right = -1; var bottom = -1
        while (head < tail) {
            val index = queue[head++]
            val px = index % width; val py = index / width
            left = min(left, px); top = min(top, py); right = max(right, px); bottom = max(bottom, py)
            for (ny in max(0, py - 1)..min(height - 1, py + 1)) {
                for (nx in max(0, px - 1)..min(width - 1, px + 1)) {
                    val next = ny * width + nx
                    if (!selected[next] && values[next].isFinite() && values[next] >= threshold) {
                        selected[next] = true; queue[tail++] = next
                    }
                }
            }
        }
        if (tail < 48 || tail > values.size * .94f ||
            (!cropped && (right - left + 1).toLong() * (bottom - top + 1) > values.size * .96f)) return null
        // Include a single soft edge around the connected object, never disconnected background.
        for (i in 0 until tail) {
            val px = queue[i] % width; val py = queue[i] / width
            for (ny in max(0, py - 1)..min(height - 1, py + 1)) {
                for (nx in max(0, px - 1)..min(width - 1, px + 1)) {
                    val next = ny * width + nx
                    if (values[next].isFinite() && values[next] >= threshold * .5f) {
                        selected[next] = true
                        left = min(left, nx); top = min(top, ny); right = max(right, nx); bottom = max(bottom, ny)
                    }
                }
            }
        }
        return Region(selected, left, top, right, bottom)
    }
}
