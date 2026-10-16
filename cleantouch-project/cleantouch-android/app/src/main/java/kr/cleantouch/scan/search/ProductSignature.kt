package kr.cleantouch.scan.search

/** Conservative visual duplicate check: category alone must never merge different products. */
internal fun similarProductSignature(left: String, right: String): Boolean = runCatching {
    val a = left.split(':'); val b = right.split(':')
    if (a.size != 4 || b.size != 4) return false
    val distance = java.lang.Long.bitCount(java.lang.Long.parseUnsignedLong(a[0], 16) xor java.lang.Long.parseUnsignedLong(b[0], 16))
    distance <= 5 && (1..3).all { kotlin.math.abs(a[it].toInt() - b[it].toInt()) <= 18 }
}.getOrDefault(false)
