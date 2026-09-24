package com.livecommerce.auth.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

@ConfigurationProperties(prefix = "auth")
data class AuthProperties(
    val issuer: String,
    val accessTokenTtl: Duration,
    val refreshTokenTtl: Duration,
    val refreshCookieName: String,
    val refreshCookieSecure: Boolean,
    val admin: AdminAccount
) {
    data class AdminAccount(
        val email: String,
        val password: String,
        val nickname: String
    )
}
