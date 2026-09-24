package com.livecommerce.auth.service

import org.springframework.http.HttpStatus

enum class AuthError(val status: HttpStatus, val message: String) {
    EMAIL_TAKEN(HttpStatus.CONFLICT, "Email is already registered"),
    NICKNAME_TAKEN(HttpStatus.CONFLICT, "Nickname is already in use"),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Email or password is incorrect"),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "Refresh token is missing, expired or unknown"),
    REFRESH_TOKEN_REUSED(HttpStatus.UNAUTHORIZED, "Refresh token was already used; the session has been revoked"),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "User does not exist")
}

class AuthException(val error: AuthError) : RuntimeException(error.message)
