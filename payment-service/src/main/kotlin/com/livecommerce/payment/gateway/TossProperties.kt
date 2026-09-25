package com.livecommerce.payment.gateway

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "payments.toss")
data class TossProperties(
    val baseUrl: String,
    val secretKey: String
)
