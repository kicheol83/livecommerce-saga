package com.livecommerce.inventory.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.math.BigDecimal
import java.util.UUID

@Entity
@Table(name = "product_stock")
class ProductStock(
    @Id
    @Column(name = "product_id")
    val productId: UUID,

    @Column(name = "quantity_available", nullable = false)
    var quantityAvailable: Int,

    @Column(name = "unit_price", nullable = false)
    var unitPrice: BigDecimal = BigDecimal.ZERO
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
