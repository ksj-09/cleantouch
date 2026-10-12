package kr.cleantouch.scan.search

import org.junit.Assert.*
import org.junit.Test

class ProductSignatureTest {
    @Test fun repeatFrameMatchesDespiteSmallLightingChange() {
        assertTrue(similarProductSignature("fedcba9876543210:100:30:190", "fedcba9876543211:108:37:184"))
    }
    @Test fun differentlyColoredItemsRemainSeparate() {
        assertFalse(similarProductSignature("fedcba9876543210:180:30:40", "fedcba9876543210:40:30:180"))
    }
    @Test fun differentShapesAndMissingSignaturesRemainSeparate() {
        assertFalse(similarProductSignature("0000000000000000:80:80:80", "ffffffffffffffff:80:80:80"))
        assertFalse(similarProductSignature("", ""))
    }
}
