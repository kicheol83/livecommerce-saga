package com.livecommerce.inventory.domain

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface ProductStockRepository : JpaRepository<ProductStock, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ProductStock p where p.productId = :productId")
    fun findByIdForUpdate(@Param("productId") productId: UUID): ProductStock?

    @Query("select p.quantityAvailable from ProductStock p where p.productId = :productId")
    fun findAvailableQuantity(@Param("productId") productId: UUID): Int?
}
