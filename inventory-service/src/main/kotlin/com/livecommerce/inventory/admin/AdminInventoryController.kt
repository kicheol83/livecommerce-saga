package com.livecommerce.inventory.admin

import com.livecommerce.inventory.domain.InventoryReservationRepository
import com.livecommerce.inventory.service.InventoryService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class AdminProductView(
    val productId: UUID,
    val quantityAvailable: Int,
    val unitPrice: BigDecimal,
    val heldQuantity: Long,
    val heldOrders: Long,
    val soldQuantity: Long
)

data class AdminReservationView(
    val reservationId: UUID,
    val orderId: UUID,
    val productId: UUID,
    val quantity: Int,
    val status: String,
    val expiresAt: Instant?,
    val createdAt: Instant
)

data class AdjustProductRequest(
    val quantityAvailable: Int,
    val unitPrice: BigDecimal
)

data class AdminInventoryError(
    val code: String,
    val message: String
)

@RestController
@RequestMapping("/api/admin/inventory")
class AdminInventoryController(
    private val inventoryService: InventoryService,
    private val reservationRepository: InventoryReservationRepository,
    private val outboxQueries: OutboxAdminQueries,
    private val jdbcTemplate: JdbcTemplate
) {

    @GetMapping("/products")
    fun products(): List<AdminProductView> {
        return jdbcTemplate.query(
            """
            select p.product_id,
                   p.quantity_available,
                   p.unit_price,
                   coalesce(sum(r.quantity) filter (where r.status = 'HELD'), 0),
                   count(r.id) filter (where r.status = 'HELD'),
                   coalesce(sum(r.quantity) filter (where r.status = 'CONFIRMED'), 0)
            from product_stock p
            left join inventory_reservations r on r.product_id = p.product_id
            group by p.product_id, p.quantity_available, p.unit_price
            order by p.product_id
            """.trimIndent(),
            RowMapper { rs, _ ->
                AdminProductView(
                    productId = rs.getObject(1, UUID::class.java),
                    quantityAvailable = rs.getInt(2),
                    unitPrice = rs.getBigDecimal(3),
                    heldQuantity = rs.getLong(4),
                    heldOrders = rs.getLong(5),
                    soldQuantity = rs.getLong(6)
                )
            }
        )
    }

    @PutMapping("/products/{productId}")
    fun adjust(@PathVariable productId: UUID, @RequestBody request: AdjustProductRequest): ResponseEntity<Any> {
        if (request.quantityAvailable < 0 || request.unitPrice.signum() <= 0) {
            return ResponseEntity.badRequest()
                .body(AdminInventoryError("INVALID_PRODUCT", "Quantity must be zero or more and price must be positive"))
        }
        val product = inventoryService.adjustProduct(productId, request.quantityAvailable, request.unitPrice)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        return ResponseEntity.ok(products().first { it.productId == product.productId })
    }

    @GetMapping("/reservations/{orderId}")
    fun reservation(@PathVariable orderId: UUID): ResponseEntity<AdminReservationView> {
        val reservation = reservationRepository.findByOrderId(orderId) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(
            AdminReservationView(
                reservationId = reservation.id,
                orderId = reservation.orderId,
                productId = reservation.productId,
                quantity = reservation.quantity,
                status = reservation.status.name,
                expiresAt = reservation.expiresAt,
                createdAt = reservation.createdAt
            )
        )
    }

    @GetMapping("/outbox")
    fun outbox(@RequestParam aggregateId: UUID): List<OutboxEventView> {
        return outboxQueries.eventsFor(aggregateId)
    }

    @GetMapping("/outbox/health")
    fun outboxHealth(): OutboxHealth {
        return outboxQueries.health()
    }
}
