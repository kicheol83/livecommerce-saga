package com.livecommerce.delivery.webhook

import com.livecommerce.delivery.domain.DeliveryStatus
import java.time.Instant

data class CourierWebhookEvent(
    val eventId: String,
    val trackingNumber: String,
    val status: DeliveryStatus,
    val location: String,
    val description: String,
    val occurredAt: Instant
)

enum class WebhookOutcome {
    APPLIED,
    RECORDED_OUT_OF_ORDER,
    DUPLICATE,
    UNKNOWN_TRACKING_NUMBER
}
