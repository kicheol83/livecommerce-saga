package com.livecommerce.inventory.service

import com.livecommerce.common.events.EventType
import com.livecommerce.common.events.InventoryFailedEvent
import com.livecommerce.common.events.InventoryReservedEvent
import com.livecommerce.common.events.KafkaTopics
import com.livecommerce.common.events.StockChangedEvent
import com.livecommerce.inventory.domain.InventoryReservation
import com.livecommerce.inventory.domain.InventoryReservationRepository
import com.livecommerce.inventory.domain.ProductStockRepository
import com.livecommerce.inventory.outbox.OutboxWriter
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class InventoryService(
    private val productStockRepository: ProductStockRepository,
    private val inventoryReservationRepository: InventoryReservationRepository,
    private val outboxWriter: OutboxWriter
) {

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
                InventoryFailedEvent(orderId, "insufficient stock")
            )
            return
        }
        productStockRepository.save(stock)
        val reservation = InventoryReservation(
            id = UUID.randomUUID(),
            orderId = orderId,
            productId = productId,
            quantity = quantity
        )
        inventoryReservationRepository.save(reservation)
        outboxWriter.write(
            orderId,
            EventType.INVENTORY_RESERVED,
            KafkaTopics.INVENTORY_EVENTS,
            InventoryReservedEvent(orderId, reservation.id, productId, quantity)
        )
        publishStockChanged(stock.productId, stock.quantityAvailable)
    }

    @Transactional
    fun release(orderId: UUID) {
        val reservation = inventoryReservationRepository.findByOrderIdForUpdate(orderId) ?: return
        if (reservation.released) {
            return
        }
        val stock = productStockRepository.findByIdForUpdate(reservation.productId) ?: return
        stock.release(reservation.quantity)
        reservation.released = true
        publishStockChanged(stock.productId, stock.quantityAvailable)
    }

    @Transactional(readOnly = true)
    fun findStock(productId: UUID): Int? {
        return productStockRepository.findById(productId).map { it.quantityAvailable }.orElse(null)
    }

    private fun publishStockChanged(productId: UUID, quantityAvailable: Int) {
        outboxWriter.write(
            productId,
            EventType.STOCK_CHANGED,
            KafkaTopics.STOCK_EVENTS,
            StockChangedEvent(productId, quantityAvailable)
        )
    }
}
