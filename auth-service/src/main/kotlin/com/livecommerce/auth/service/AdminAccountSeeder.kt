package com.livecommerce.auth.service

import com.livecommerce.auth.config.AuthProperties
import com.livecommerce.auth.domain.UserAccount
import com.livecommerce.auth.domain.UserAccountRepository
import com.livecommerce.auth.domain.UserRole
import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class AdminAccountSeeder(
    private val users: UserAccountRepository,
    private val passwordEncoder: PasswordEncoder,
    private val properties: AuthProperties
) : ApplicationRunner {

    private val log = LoggerFactory.getLogger(AdminAccountSeeder::class.java)

    override fun run(args: ApplicationArguments) {
        val email = properties.admin.email.trim().lowercase()
        if (users.existsByEmail(email)) {
            return
        }
        users.save(
            UserAccount(
                id = UUID.randomUUID(),
                email = email,
                passwordHash = passwordEncoder.encode(properties.admin.password),
                nickname = properties.admin.nickname,
                role = UserRole.ADMIN
            )
        )
        log.info("Seeded admin account {}", email)
    }
}
