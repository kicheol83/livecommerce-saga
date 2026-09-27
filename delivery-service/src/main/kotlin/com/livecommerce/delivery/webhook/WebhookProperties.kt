package com.livecommerce.delivery.webhook

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "delivery")
data class WebhookProperties(
    val carrierName: String,
    val webhookSecret: String,
    val webhookToleranceSeconds: Long
)
