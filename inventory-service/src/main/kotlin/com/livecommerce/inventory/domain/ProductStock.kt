package com.livecommerce.inventory.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "product_stock")
class ProductStock(
    @Id
    @Column(name = "product_id")
    val productId: UUID,

    @Column(name = "quantity_available", nullable = false)
    var quantityAvailable: Int
) {
    fun reserve(quantity: Int): Boolean {
        if (quantityAvailable < quantity) {
            return false
        }
        quantityAvailable -= quantity
        return true
    }

    fun release(quantity: Int) {
        quantityAvailable += quantity
    }
}
