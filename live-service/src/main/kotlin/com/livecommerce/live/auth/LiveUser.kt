package com.livecommerce.live.auth

import java.security.Principal

data class LiveUser(
    val userId: String,
    val nickname: String
) : Principal {
    override fun getName(): String {
        return userId
    }
}
