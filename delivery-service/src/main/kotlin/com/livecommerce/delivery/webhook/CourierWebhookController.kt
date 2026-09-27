package com.livecommerce.delivery.webhook

import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.delivery.service.DeliveryService
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class WebhookResponse(
    val result: String
)

@RestController
@RequestMapping("/api/deliveries/webhooks")
class CourierWebhookController(
    private val deliveryService: DeliveryService,
    private val objectMapper: ObjectMapper,
    private val properties: WebhookProperties
) {

    private val log = LoggerFactory.getLogger(CourierWebhookController::class.java)

    @PostMapping("/courier")
    fun receive(
        @RequestHeader(WebhookSignature.TIMESTAMP_HEADER, required = false) timestamp: String?,
        @RequestHeader(WebhookSignature.SIGNATURE_HEADER, required = false) signature: String?,
        @RequestBody body: String
    ): ResponseEntity<WebhookResponse> {
        val trusted = WebhookSignature.isValid(
            properties.webhookSecret,
            timestamp,
            signature,
            body,
            properties.webhookToleranceSeconds,
            Instant.now()
        )
        if (!trusted) {
            log.warn("Rejected courier webhook with an invalid or expired signature")
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(WebhookResponse("INVALID_SIGNATURE"))
        }
        val event = try {
            objectMapper.readValue(body, CourierWebhookEvent::class.java)
        } catch (ex: Exception) {
            return ResponseEntity.badRequest().body(WebhookResponse("MALFORMED_EVENT"))
        }
        val outcome = deliveryService.applyCourierEvent(event)
        if (outcome == WebhookOutcome.UNKNOWN_TRACKING_NUMBER) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(WebhookResponse(outcome.name))
        }
        return ResponseEntity.ok(WebhookResponse(outcome.name))
    }
}
