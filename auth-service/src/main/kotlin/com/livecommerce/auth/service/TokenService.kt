package com.livecommerce.auth.service

import com.livecommerce.auth.config.AuthProperties
import com.livecommerce.auth.domain.UserAccount
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.Base64
import java.util.HexFormat

data class IssuedAccessToken(
    val value: String,
    val expiresAt: Instant
)

@Service
class TokenService(
    private val jwtEncoder: JwtEncoder,
    private val properties: AuthProperties
) {

    private val secureRandom = SecureRandom()

    fun issueAccessToken(user: UserAccount): IssuedAccessToken {
        val now = Instant.now()
        val expiresAt = now.plus(properties.accessTokenTtl)
        val claims = JwtClaimsSet.builder()
            .issuer(properties.issuer)
            .subject(user.id.toString())
            .issuedAt(now)
            .expiresAt(expiresAt)
            .claim("email", user.email)
            .claim("nickname", user.nickname)
            .claim("roles", user.roles())
            .build()
        val header = JwsHeader.with(SignatureAlgorithm.RS256).build()
        val token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
        return IssuedAccessToken(token, expiresAt)
    }

    fun newRefreshTokenValue(): String {
        val bytes = ByteArray(REFRESH_TOKEN_BYTES)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun hash(rawToken: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(rawToken.toByteArray(Charsets.UTF_8))
        return HexFormat.of().formatHex(digest)
    }

    companion object {
        private const val REFRESH_TOKEN_BYTES = 32
    }
}
