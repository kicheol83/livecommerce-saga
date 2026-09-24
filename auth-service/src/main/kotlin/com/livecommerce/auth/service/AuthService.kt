package com.livecommerce.auth.service

import com.livecommerce.auth.config.AuthProperties
import com.livecommerce.auth.domain.RefreshToken
import com.livecommerce.auth.domain.RefreshTokenRepository
import com.livecommerce.auth.domain.UserAccount
import com.livecommerce.auth.domain.UserAccountRepository
import com.livecommerce.auth.domain.UserRole
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

data class AuthSession(
    val user: UserAccount,
    val accessToken: IssuedAccessToken,
    val refreshToken: String
)

@Service
class AuthService(
    private val users: UserAccountRepository,
    private val refreshTokens: RefreshTokenRepository,
    private val tokenService: TokenService,
    private val passwordEncoder: PasswordEncoder,
    private val properties: AuthProperties
) {

    private val timingEqualizerHash: String = passwordEncoder.encode(TIMING_EQUALIZER)

    @Transactional
    fun signup(email: String, password: String, nickname: String): AuthSession {
        val normalizedEmail = normalizeEmail(email)
        val normalizedNickname = nickname.trim()
        if (users.existsByEmail(normalizedEmail)) {
            throw AuthException(AuthError.EMAIL_TAKEN)
        }
        if (users.existsByNickname(normalizedNickname)) {
            throw AuthException(AuthError.NICKNAME_TAKEN)
        }
        val user = users.save(
            UserAccount(
                id = UUID.randomUUID(),
                email = normalizedEmail,
                passwordHash = passwordEncoder.encode(password),
                nickname = normalizedNickname,
                role = UserRole.USER
            )
        )
        return openSession(user, UUID.randomUUID())
    }

    @Transactional
    fun login(email: String, password: String): AuthSession {
        val user = users.findByEmail(normalizeEmail(email))
        if (user == null) {
            passwordEncoder.matches(password, timingEqualizerHash)
            throw AuthException(AuthError.INVALID_CREDENTIALS)
        }
        if (!passwordEncoder.matches(password, user.passwordHash)) {
            throw AuthException(AuthError.INVALID_CREDENTIALS)
        }
        return openSession(user, UUID.randomUUID())
    }

    @Transactional(noRollbackFor = [AuthException::class])
    fun refresh(rawToken: String?): AuthSession {
        if (rawToken.isNullOrBlank()) {
            throw AuthException(AuthError.INVALID_REFRESH_TOKEN)
        }
        val now = Instant.now()
        val stored = refreshTokens.findByTokenHashForUpdate(tokenService.hash(rawToken))
            ?: throw AuthException(AuthError.INVALID_REFRESH_TOKEN)
        if (stored.revokedAt != null) {
            refreshTokens.revokeFamily(stored.familyId, now)
            throw AuthException(AuthError.REFRESH_TOKEN_REUSED)
        }
        if (!stored.expiresAt.isAfter(now)) {
            throw AuthException(AuthError.INVALID_REFRESH_TOKEN)
        }
        stored.revokedAt = now
        val user = users.findById(stored.userId).orElseThrow { AuthException(AuthError.INVALID_REFRESH_TOKEN) }
        return openSession(user, stored.familyId)
    }

    @Transactional
    fun logout(rawToken: String?) {
        if (rawToken.isNullOrBlank()) {
            return
        }
        val stored = refreshTokens.findByTokenHashForUpdate(tokenService.hash(rawToken)) ?: return
        refreshTokens.revokeFamily(stored.familyId, Instant.now())
    }

    @Transactional(readOnly = true)
    fun currentUser(userId: UUID): UserAccount {
        return users.findById(userId).orElseThrow { AuthException(AuthError.USER_NOT_FOUND) }
    }

    private fun openSession(user: UserAccount, familyId: UUID): AuthSession {
        val accessToken = tokenService.issueAccessToken(user)
        val rawRefreshToken = tokenService.newRefreshTokenValue()
        refreshTokens.save(
            RefreshToken(
                id = UUID.randomUUID(),
                userId = user.id,
                familyId = familyId,
                tokenHash = tokenService.hash(rawRefreshToken),
                expiresAt = Instant.now().plus(properties.refreshTokenTtl)
            )
        )
        return AuthSession(user, accessToken, rawRefreshToken)
    }

    private fun normalizeEmail(email: String): String {
        return email.trim().lowercase()
    }

    companion object {
        private const val TIMING_EQUALIZER = "timing-equalizer-password"
    }
}
