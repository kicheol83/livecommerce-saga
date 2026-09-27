package com.livecommerce.order.api.dto

import com.livecommerce.common.shipping.ShippingAddress
import java.math.BigDecimal
import java.util.UUID

data class CreateOrderRequest(
    val productId: UUID,
    val quantity: Int,
    val shippingAddress: ShippingAddress? = null
)

data class SubmitPaymentRequest(
    val paymentKey: String,
    val amount: BigDecimal
)

data class OrderErrorResponse(
    val code: String,
    val message: String,
    val fields: Map<String, String> = emptyMap()
)

data class OrderPageResponse(
    val items: List<OrderResponse>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int
)
