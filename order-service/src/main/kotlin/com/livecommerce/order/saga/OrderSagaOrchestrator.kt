package com.livecommerce.order.saga

import com.livecommerce.order.client.CancelPaymentRequest
import com.livecommerce.order.client.InventoryClient
import com.livecommerce.order.client.PaymentClient
import com.livecommerce.order.client.ReserveInventoryRequest
import com.livecommerce.order.client.ReservePaymentRequest
import com.livecommerce.order.domain.Order
import com.livecommerce.order.domain.OrderRepository
import com.livecommerce.order.domain.OrderStatus
import com.livecommerce.order.ws.OrderStatusPublisher
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal
import java.util.UUID

@Component
class OrderSagaOrchestrator(
    private val orderRepository: OrderRepository,
    private val paymentClient: PaymentClient,
    private val inventoryClient: InventoryClient,
    private val statusPublisher: OrderStatusPublisher
) {

    fun createOrder(memberId: UUID, productId: UUID, quantity: Int, amount: BigDecimal): Order {
        val order = persistNewOrder(memberId, productId, quantity, amount)
        statusPublisher.publish(order)
        paymentClient.reservePayment(ReservePaymentRequest(order.id, order.memberId, order.amount))
        return order
    }

    fun onPaymentReserved(orderId: UUID) {
        val order = updateStatus(orderId) { o ->
            o.markPaymentConfirmed()
            o.markAwaitingInventory()
        }
        statusPublisher.publish(order)
        inventoryClient.reserveInventory(ReserveInventoryRequest(order.id, order.productId, order.quantity))
    }

    fun onPaymentFailed(orderId: UUID, reason: String) {
        val order = updateStatus(orderId) { o -> o.markCancelled(reason) }
        statusPublisher.publish(order)
    }

    fun onInventoryReserved(orderId: UUID) {
        val order = updateStatus(orderId) { o -> o.markCompleted() }
        statusPublisher.publish(order)
    }

    fun onInventoryFailed(orderId: UUID, reason: String) {
        val order = updateStatus(orderId) { o -> o.markCompensating(reason) }
        statusPublisher.publish(order)
        paymentClient.cancelPayment(CancelPaymentRequest(order.id))
    }

    fun onPaymentCancelled(orderId: UUID) {
        val order = updateStatus(orderId) { o -> o.markCancelled(o.failureReason ?: "inventory unavailable") }
        statusPublisher.publish(order)
    }

    @Transactional
    fun persistNewOrder(memberId: UUID, productId: UUID, quantity: Int, amount: BigDecimal): Order {
        val order = Order(
            id = UUID.randomUUID(),
            memberId = memberId,
            productId = productId,
            quantity = quantity,
            amount = amount,
            status = OrderStatus.AWAITING_PAYMENT
        )
        return orderRepository.save(order)
    }

    @Transactional
    fun updateStatus(orderId: UUID, mutation: (Order) -> Unit): Order {
        val order = orderRepository.findById(orderId).orElseThrow()
        mutation(order)
        return orderRepository.save(order)
    }
}
