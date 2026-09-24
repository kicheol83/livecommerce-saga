package com.livecommerce.auth.domain

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserAccountRepository : JpaRepository<UserAccount, UUID> {
    fun findByEmail(email: String): UserAccount?
    fun existsByEmail(email: String): Boolean
    fun existsByNickname(nickname: String): Boolean
}
