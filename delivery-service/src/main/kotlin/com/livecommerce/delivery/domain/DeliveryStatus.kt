package com.livecommerce.delivery.domain

enum class DeliveryStatus {
    PREPARING,
    SHIPPED,
    IN_TRANSIT,
    OUT_FOR_DELIVERY,
    DELIVERED;

    fun isAfter(other: DeliveryStatus): Boolean {
        return ordinal > other.ordinal
    }
}
