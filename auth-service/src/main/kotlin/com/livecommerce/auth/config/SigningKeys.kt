package com.livecommerce.auth.config

import com.nimbusds.jose.jwk.RSAKey
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPrivateCrtKey
import java.security.interfaces.RSAPublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.RSAPublicKeySpec
import java.util.Base64

object SigningKeys {

    private const val RSA = "RSA"
    private const val RSA_KEY_SIZE = 2048
    private val PEM_ARMOR = Regex("-----(BEGIN|END) PRIVATE KEY-----")
    private val WHITESPACE = Regex("\\s")

    fun load(encoded: String): RSAKey {
        val pem = if (encoded.contains("BEGIN")) encoded else String(Base64.getDecoder().decode(encoded.trim()))
        require(pem.contains("BEGIN PRIVATE KEY")) { "auth.signing-key must be a PKCS#8 PEM RSA private key" }
        val der = Base64.getDecoder().decode(pem.replace(PEM_ARMOR, "").replace(WHITESPACE, ""))
        val factory = KeyFactory.getInstance(RSA)
        val privateKey = factory.generatePrivate(PKCS8EncodedKeySpec(der)) as RSAPrivateCrtKey
        val publicKey = factory.generatePublic(RSAPublicKeySpec(privateKey.modulus, privateKey.publicExponent)) as RSAPublicKey
        return withThumbprintId(publicKey, privateKey)
    }

    fun generate(): RSAKey {
        val generator = KeyPairGenerator.getInstance(RSA)
        generator.initialize(RSA_KEY_SIZE)
        val keyPair = generator.generateKeyPair()
        return withThumbprintId(keyPair.public as RSAPublicKey, keyPair.private as RSAPrivateCrtKey)
    }

    private fun withThumbprintId(publicKey: RSAPublicKey, privateKey: RSAPrivateCrtKey): RSAKey {
        return RSAKey.Builder(publicKey)
            .privateKey(privateKey)
            .keyIDFromThumbprint()
            .build()
    }
}
