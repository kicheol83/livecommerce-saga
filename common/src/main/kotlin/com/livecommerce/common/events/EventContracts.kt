package com.livecommerce.common.events

object EventType {
    const val PAYMENT_RESERVED = "PaymentReserved"
    const val PAYMENT_CONFIRMED = "PaymentConfirmed"
    const val PAYMENT_FAILED = "PaymentFailed"
    const val PAYMENT_CANCELLED = "PaymentCancelled"
    const val INVENTORY_RESERVED = "InventoryReserved"
    const val INVENTORY_FAILED = "InventoryFailed"
    const val INVENTORY_CONFIRMED = "InventoryConfirmed"
    const val INVENTORY_CONFIRM_FAILED = "InventoryConfirmFailed"
    const val STOCK_CHANGED = "StockChanged"
}

object KafkaTopics {
    const val PAYMENT_EVENTS = "payment-events"
    const val INVENTORY_EVENTS = "inventory-events"
    const val STOCK_EVENTS = "stock-events"
}
