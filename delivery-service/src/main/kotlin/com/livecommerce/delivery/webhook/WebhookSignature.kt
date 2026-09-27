package com.livecommerce.delivery.webhook

import java.security.MessageDigest
import java.time.Instant
import java.util.HexFormat
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.abs

object WebhookSignature {
    const val SIGNATURE_HEADER = "X-Courier-Signature"
    const val TIMESTAMP_HEADER = "X-Courier-Timestamp"
    private const val ALGORITHM = "HmacSHA256"
    private const val PREFIX = "sha256="

    fun sign(secret: String, timestamp: Long, body: String): String {
        val mac = Mac.getInstance(ALGORITHM)
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), ALGORITHM))
        val digest = mac.doFinal("$timestamp.$body".toByteArray(Charsets.UTF_8))
        return PREFIX + HexFormat.of().formatHex(digest)
    }

    fun isValid(secret: String, timestampHeader: String?, signatureHeader: String?, body: String, toleranceSeconds: Long, now: Instant): Boolean {
        val timestamp = timestampHeader?.toLongOrNull() ?: return false
        if (signatureHeader == null || abs(now.epochSecond - timestamp) > toleranceSeconds) {
            return false
        }
        val expected = sign(secret, timestamp, body).toByteArray(Charsets.UTF_8)
        return MessageDigest.isEqual(expected, signatureHeader.toByteArray(Charsets.UTF_8))
    }
}
