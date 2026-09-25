package com.livecommerce.order.domain

enum class OrderStatus {
    AWAITING_STOCK,
    AWAITING_PAYMENT,
    PAYMENT_CONFIRMING,
    CONFIRMING_STOCK,
    COMPLETED,
    COMPENSATING,
    CANCELLED
}
