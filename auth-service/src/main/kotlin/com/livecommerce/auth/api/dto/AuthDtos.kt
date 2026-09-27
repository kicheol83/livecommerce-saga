package com.livecommerce.auth.api.dto

import com.livecommerce.auth.domain.UserAccount
import com.livecommerce.common.shipping.ShippingAddress
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import java.util.UUID

data class SignupRequest(
    @field:NotBlank
    @field:Email
    @field:Size(max = 254)
    val email: String = "",

    @field:Size(min = 8, max = 72)
    val password: String = "",

    @field:Size(min = 2, max = 20)
    @field:Pattern(regexp = "^[\\p{L}\\p{N}_]+$")
    val nickname: String = ""
)

data class LoginRequest(
    @field:NotBlank
    val email: String = "",

    @field:NotBlank
    val password: String = ""
)

data class UserResponse(
    val userId: UUID,
    val email: String,
    val nickname: String,
    val role: String,
    val shippingAddress: ShippingAddress?
) {
    companion object {
        fun from(user: UserAccount): UserResponse {
            return UserResponse(user.id, user.email, user.nickname, user.role.name, user.shippingAddress())
        }
    }
}

data class TokenResponse(
    val accessToken: String,
    val tokenType: String,
    val expiresIn: Long,
    val user: UserResponse
)

data class ErrorResponse(
    val code: String,
    val message: String,
    val fields: Map<String, String> = emptyMap()
)
