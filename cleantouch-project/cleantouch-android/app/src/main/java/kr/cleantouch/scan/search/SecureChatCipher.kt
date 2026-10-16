package kr.cleantouch.scan.search

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Encrypts local conversations with a non-exportable Android Keystore key. */
class SecureChatCipher {
    private val alias="cleantouch-chat-v1"
    private fun key():SecretKey {
        val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
        (store.getKey(alias,null) as? SecretKey)?.let{return it}
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build())
        }.generateKey()
    }
    fun encrypt(plain:ByteArray):ByteArray {
        val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.ENCRYPT_MODE,key())}
        return byteArrayOf(0x43,0x54,0x45,0x31)+cipher.iv+cipher.doFinal(plain)
    }
    fun decrypt(value:ByteArray):ByteArray {
        if(value.size<32||!value.copyOfRange(0,4).contentEquals(byteArrayOf(0x43,0x54,0x45,0x31)))return value
        val iv=value.copyOfRange(4,16);val encrypted=value.copyOfRange(16,value.size)
        return Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,iv))}.doFinal(encrypted)
    }
}
