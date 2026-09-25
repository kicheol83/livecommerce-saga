package com.livecommerce.inventory.service

import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.InventoryConfirmFailedEvent
import com.livecommerce.common.events.InventoryConfirmedEvent
import com.livecommerce.common.events.InventoryFailedEvent
import com.livecommerce.common.events.InventoryReservedEvent
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.StockChangedEvent
import com.livecommerce.inventory.domain.InventoryReservation
import com.livecommerce.inventory.domain.InventoryReservationRepository
import com.livecommerce.inventory.domain.ProductStock
import com.livecommerce.inventory.domain.ProductStockRepository
import com.livecommerce.inventory.domain.ReservationStatus
import com.livecommerce.inventory.outbox.OutboxWriter
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

@Service
class InventoryService(
    private val productStockRepository: ProductStockRepository,
    private val inventoryReservationRepository: InventoryReservationRepository,
    private val outboxWriter: OutboxWriter,
    @Value("\${inventory.hold-ttl-seconds:600}") holdTtlSeconds: Long
) {

    private val holdTtl: Duration = Duration.ofSeconds(holdTtlSeconds)

    @Transactional
    fun reserve(orderId: UUID, productId: UUID, quantity: Int) {
        val existing = inventoryReservationRepository.findByOrderId(orderId)
        if (existing != null) {
            return
        }
        val stock = productStockRepository.findByIdForUpdate(productId)
        if (stock == null || !stock.reserve(quantity)) {
            outboxWriter.write(
                orderId,
                EventType.INVENTORY_FAILED,
                KafkaTopics.INVENTORY_EVENTS,
                InventoryFailedEvent(orderId, INSUFFICIENT_STOCK)
            )
            return
        }
        val expiresAt = Instant.now().plus(holdTtl)
        val reservation = inventoryReservationRepository.save(
            InventoryReservation(
                id = UUID.randomUUID(),
                orderId = orderId,
                productId = productId,
                quantity = quantity,
                status = ReservationStatus.HELD,
                expiresAt = expiresAt
            )
        )
        outboxWriter.write(
            orderId,
            EventType.INVENTORY_RESERVED,
            KafkaTopics.INVENTORY_EVENTS,
            InventoryReservedEvent(orderId, reservation.id, productId, quantity, stock.unitPrice, expiresAt)
        )
        publishStockChanged(stock)
    }

    @Transactional
    fun confirm(orderId: UUID) {
        val now = Instant.now()
        val reservation = inventoryReservationRepository.findByOrderIdForUpdate(orderId)
        when {
            reservation == null -> publishConfirmFailed(orderId, HOLD_NOT_FOUND)
            reservation.status == ReservationStatus.CONFIRMED -> publishConfirmed(reservation)
            reservation.isHoldActive(now) -> {
                reservation.status = ReservationStatus.CONFIRMED
                reservation.expiresAt = null
                publishConfirmed(reservation)
            }
            else -> {
                if (reservation.status == ReservationStatus.HELD) {
                    returnToStock(reservation, ReservationStatus.EXPIRED)
                }
                publishConfirmFailed(orderId, HOLD_EXPIRED)
            }
        }
    }

    @Transactional
    fun release(orderId: UUID) {
        val reservation = inventoryReservationRepository.findByOrderIdForUpdate(orderId) ?: return
        if (!reservation.holdsStock()) {
            return
        }
        returnToStock(reservation, ReservationStatus.RELEASED)
    }

    @Transactional
    fun expireHolds(): Int {
        val expired = inventoryReservationRepository.findExpiredForUpdate(
            ReservationStatus.HELD,
            Instant.now(),
            PageRequest.of(0, EXPIRY_BATCH_SIZE)
        )
        expired.forEach { returnToStock(it, ReservationStatus.EXPIRED) }
        return expired.size
    }

    @Transactional(readOnly = true)
    fun findProduct(productId: UUID): ProductStock? {
        return productStockRepository.findById(productId).orElse(null)
    }

    private fun returnToStock(reservation: InventoryReservation, finalStatus: ReservationStatus) {
        val stock = productStockRepository.findByIdForUpdate(reservation.productId) ?: return
        stock.release(reservation.quantity)
        reservation.status = finalStatus
        reservation.expiresAt = null
        publishStockChanged(stock)
    }

    private fun publishConfirmed(reservation: InventoryReservation) {
        outboxWriter.write(
            reservation.orderId,
            EventType.INVENTORY_CONFIRMED,
            KafkaTopics.INVENTORY_EVENTS,
            InventoryConfirmedEvent(reservation.orderId, reservation.id)
        )
    }

    private fun publishConfirmFailed(orderId: UUID, reason: String) {
        outboxWriter.write(
            orderId,
            EventType.INVENTORY_CONFIRM_FAILED,
            KafkaTopics.INVENTORY_EVENTS,
            InventoryConfirmFailedEvent(orderId, reason)
        )
    }

    private fun publishStockChanged(stock: ProductStock) {
        outboxWriter.write(
            stock.productId,
            EventType.STOCK_CHANGED,
            KafkaTopics.STOCK_EVENTS,
            StockChangedEvent(stock.productId, stock.quantityAvailable)
        )
    }

    companion object {
        const val INSUFFICIENT_STOCK = "insufficient stock"
        const val HOLD_EXPIRED = "stock hold expired"
        const val HOLD_NOT_FOUND = "stock hold not found"
        private const val EXPIRY_BATCH_SIZE = 50
    }
}
