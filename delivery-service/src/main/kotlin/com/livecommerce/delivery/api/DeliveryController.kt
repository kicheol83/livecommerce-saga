package com.livecommerce.delivery.api

import com.livecommerce.common.identity.IdentityHeaders
import com.livecommerce.delivery.domain.Delivery
import com.livecommerce.delivery.domain.TrackingEvent
import com.livecommerce.delivery.service.DeliveryService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

data class TrackingEventView(
    val eventId: String,
    val status: String,
    val location: String,
    val description: String,
    val occurredAt: Instant
)

data class DeliveryView(
    val orderId: UUID,
    val status: String,
    val carrier: String,
    val trackingNumber: String,
    val recipientName: String,
    val address: String,
    val orderedAt: Instant,
    val deliveredAt: Instant?,
    val events: List<TrackingEventView>
) {
    companion object {
        fun from(delivery: Delivery, events: List<TrackingEvent>): DeliveryView {
            return DeliveryView(
                orderId = delivery.orderId,
                status = delivery.status.name,
                carrier = delivery.carrier,
                trackingNumber = delivery.trackingNumber,
                recipientName = delivery.recipientName,
                address = listOfNotNull(delivery.addressLine1, delivery.addressLine2).joinToString(" "),
                orderedAt = delivery.orderedAt,
                deliveredAt = delivery.deliveredAt,
                events = events.map { TrackingEventView(it.eventId, it.status.name, it.location, it.description, it.occurredAt) }
            )
        }
    }
}

@RestController
@RequestMapping("/api/deliveries")
class DeliveryController(
    private val deliveryService: DeliveryService
) {

    @GetMapping("/{orderId}")
    fun delivery(
        @PathVariable orderId: UUID,
        @RequestHeader(IdentityHeaders.USER_ID) userId: UUID,
        @RequestHeader(IdentityHeaders.USER_ROLES, required = false) roles: String?
    ): ResponseEntity<DeliveryView> {
        val (delivery, events) = deliveryService.find(orderId) ?: return ResponseEntity.notFound().build()
        val isAdmin = roles?.split(",")?.contains(IdentityHeaders.ADMIN_ROLE) == true
        if (delivery.memberId != userId && !isAdmin) {
            return ResponseEntity.notFound().build()
        }
        return ResponseEntity.ok(DeliveryView.from(delivery, events))
    }
}
