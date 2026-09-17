package com.livecommerce.order.domain

enum class OrderStatus {
    CREATED,
    AWAITING_PAYMENT,
    PAYMENT_CONFIRMED,
    AWAITING_INVENTORY,
    COMPLETED,
    COMPENSATING,
    CANCELLED
}
