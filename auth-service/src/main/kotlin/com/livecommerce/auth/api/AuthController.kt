package com.livecommerce.auth.api

import com.livecommerce.auth.api.dto.ErrorResponse
import com.livecommerce.auth.api.dto.LoginRequest
import com.livecommerce.auth.api.dto.SignupRequest
import com.livecommerce.auth.api.dto.TokenResponse
import com.livecommerce.auth.api.dto.UserResponse
import com.livecommerce.auth.config.AuthProperties
import com.livecommerce.auth.service.AuthService
import com.livecommerce.auth.service.AuthSession
import com.livecommerce.common.shipping.ShippingAddress
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService,
    private val properties: AuthProperties
) {

    @PostMapping("/signup")
    fun signup(@Valid @RequestBody request: SignupRequest, response: HttpServletResponse): ResponseEntity<TokenResponse> {
        val session = authService.signup(request.email, request.password, request.nickname)
        return ResponseEntity.status(HttpStatus.CREATED).body(respond(session, response))
    }

    @PostMapping("/login")
    fun login(@Valid @RequestBody request: LoginRequest, response: HttpServletResponse): TokenResponse {
        return respond(authService.login(request.email, request.password), response)
    }

    @PostMapping("/refresh")
    fun refresh(request: HttpServletRequest, response: HttpServletResponse): TokenResponse {
        return respond(authService.refresh(readRefreshCookie(request)), response)
    }

    @PostMapping("/logout")
    fun logout(request: HttpServletRequest, response: HttpServletResponse): ResponseEntity<Void> {
        authService.logout(readRefreshCookie(request))
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie("", Duration.ZERO).toString())
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal jwt: Jwt): UserResponse {
        return UserResponse.from(authService.currentUser(UUID.fromString(jwt.subject)))
    }

    @PutMapping("/me/shipping-address")
    fun changeShippingAddress(@AuthenticationPrincipal jwt: Jwt, @RequestBody request: ShippingAddress): ResponseEntity<Any> {
        val address = request.normalized()
        val violations = address.violations()
        if (violations.isNotEmpty()) {
            return ResponseEntity.badRequest()
                .body(ErrorResponse("VALIDATION_FAILED", "Shipping address is invalid", violations))
        }
        return ResponseEntity.ok(UserResponse.from(authService.changeShippingAddress(UUID.fromString(jwt.subject), address)))
    }

    private fun respond(session: AuthSession, response: HttpServletResponse): TokenResponse {
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie(session.refreshToken, properties.refreshTokenTtl).toString())
        val expiresIn = Duration.between(Instant.now(), session.accessToken.expiresAt).seconds
        return TokenResponse(
            accessToken = session.accessToken.value,
            tokenType = "Bearer",
            expiresIn = expiresIn,
            user = UserResponse.from(session.user)
        )
    }

    private fun refreshCookie(value: String, maxAge: Duration): ResponseCookie {
        return ResponseCookie.from(properties.refreshCookieName, value)
            .httpOnly(true)
            .secure(properties.refreshCookieSecure)
            .sameSite("Strict")
            .path(REFRESH_COOKIE_PATH)
            .maxAge(maxAge)
            .build()
    }

    private fun readRefreshCookie(request: HttpServletRequest): String? {
        return request.cookies?.firstOrNull { it.name == properties.refreshCookieName }?.value
    }

    companion object {
        private const val REFRESH_COOKIE_PATH = "/api/auth"
    }
}
