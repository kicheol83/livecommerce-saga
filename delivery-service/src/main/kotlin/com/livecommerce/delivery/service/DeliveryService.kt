package com.livecommerce.delivery.service

import com.livecommerce.common.events.OrderCompletedEvent
import com.livecommerce.delivery.courier.CourierSimulator
import com.livecommerce.delivery.domain.Delivery
import com.livecommerce.delivery.domain.DeliveryRepository
import com.livecommerce.delivery.domain.DeliveryStatus
import com.livecommerce.delivery.domain.TrackingEvent
import com.livecommerce.delivery.domain.TrackingEventRepository
import com.livecommerce.delivery.webhook.CourierWebhookEvent
import com.livecommerce.delivery.webhook.WebhookOutcome
import com.livecommerce.delivery.webhook.WebhookProperties
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ThreadLocalRandom

@Service
class DeliveryService(
    private val deliveryRepository: DeliveryRepository,
    private val trackingEventRepository: TrackingEventRepository,
    private val courierSimulator: CourierSimulator,
    private val properties: WebhookProperties
) {

    @Transactional
    fun register(event: OrderCompletedEvent) {
        if (deliveryRepository.existsByOrderId(event.orderId)) {
            return
        }
        val address = event.shippingAddress
        val delivery = deliveryRepository.save(
            Delivery(
                id = UUID.randomUUID(),
                orderId = event.orderId,
                memberId = event.memberId,
                productId = event.productId,
                quantity = event.quantity,
                recipientName = address.recipientName,
                recipientPhone = address.phone,
                zipCode = address.zipCode,
                addressLine1 = address.address1,
                addressLine2 = address.address2,
                carrier = properties.carrierName,
                trackingNumber = newTrackingNumber(),
                status = DeliveryStatus.PREPARING,
                orderedAt = event.completedAt
            )
        )
        trackingEventRepository.save(
            TrackingEvent(
                id = UUID.randomUUID(),
                deliveryId = delivery.id,
                eventId = "seller-${event.orderId}",
                status = DeliveryStatus.PREPARING,
                location = SELLER_LOCATION,
                description = PREPARING_DESCRIPTION,
                occurredAt = Instant.now()
            )
        )
        courierSimulator.register(delivery.trackingNumber, address.address1, address.recipientName)
    }

    @Transactional
    fun applyCourierEvent(event: CourierWebhookEvent): WebhookOutcome {
        val delivery = deliveryRepository.findByTrackingNumberForUpdate(event.trackingNumber)
            ?: return WebhookOutcome.UNKNOWN_TRACKING_NUMBER
        if (trackingEventRepository.existsByEventId(event.eventId)) {
            return WebhookOutcome.DUPLICATE
        }
        trackingEventRepository.save(
            TrackingEvent(
                id = UUID.randomUUID(),
                deliveryId = delivery.id,
                eventId = event.eventId,
                status = event.status,
                location = event.location.take(MAX_LOCATION_LENGTH),
                description = event.description.take(MAX_DESCRIPTION_LENGTH),
                occurredAt = event.occurredAt
            )
        )
        if (delivery.status.isAfter(event.status)) {
            return WebhookOutcome.RECORDED_OUT_OF_ORDER
        }
        if (event.status.isAfter(delivery.status)) {
            delivery.advanceTo(event.status, event.occurredAt)
        }
        return WebhookOutcome.APPLIED
    }

    @Transactional(readOnly = true)
    fun find(orderId: UUID): Pair<Delivery, List<TrackingEvent>>? {
        val delivery = deliveryRepository.findByOrderId(orderId) ?: return null
        return delivery to trackingEventRepository.findAllByDeliveryIdOrderByOccurredAtAsc(delivery.id)
    }

    private fun newTrackingNumber(): String {
        return ThreadLocalRandom.current().nextLong(TRACKING_MIN, TRACKING_MAX).toString()
    }

    companion object {
        private const val SELLER_LOCATION = "판매자"
        private const val PREPARING_DESCRIPTION = "상품 준비 중"
        private const val MAX_LOCATION_LENGTH = 100
        private const val MAX_DESCRIPTION_LENGTH = 200
        private const val TRACKING_MIN = 100_000_000_000L
        private const val TRACKING_MAX = 999_999_999_999L
    }
}
