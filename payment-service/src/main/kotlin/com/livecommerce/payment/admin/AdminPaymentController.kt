package com.livecommerce.payment.admin

import com.livecommerce.payment.domain.Payment
import com.livecommerce.payment.domain.PaymentRepository
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

data class AdminPaymentView(
    val paymentId: UUID,
    val orderId: UUID,
    val memberId: UUID,
    val amount: BigDecimal,
    val status: String,
    val method: String?,
    val paymentKeyPreview: String?,
    val approvedAt: Instant?,
    val failureCode: String?,
    val failureMessage: String?,
    val cancelledAt: Instant?,
    val createdAt: Instant
) {
    companion object {
        fun from(payment: Payment): AdminPaymentView {
            return AdminPaymentView(
                paymentId = payment.id,
                orderId = payment.orderId,
                memberId = payment.memberId,
                amount = payment.amount,
                status = payment.status.name,
                method = payment.method,
                paymentKeyPreview = payment.paymentKey?.let { if (it.length > PREVIEW_LENGTH) it.take(PREVIEW_LENGTH) + "…" else it },
                approvedAt = payment.approvedAt,
                failureCode = payment.failureCode,
                failureMessage = payment.failureMessage,
                cancelledAt = payment.cancelledAt,
                createdAt = payment.createdAt
            )
        }

        private const val PREVIEW_LENGTH = 10
    }
}

data class PaymentSummary(
    val countsByStatus: Map<String, Long>,
    val confirmedAmount: BigDecimal,
    val refundedAmount: BigDecimal
)

@RestController
@RequestMapping("/api/admin/payments")
class AdminPaymentController(
    private val paymentRepository: PaymentRepository,
    private val outboxQueries: OutboxAdminQueries,
    private val jdbcTemplate: JdbcTemplate
) {

    @GetMapping("/orders/{orderId}")
    fun byOrder(@PathVariable orderId: UUID): ResponseEntity<AdminPaymentView> {
        val payment = paymentRepository.findByOrderId(orderId) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(AdminPaymentView.from(payment))
    }

    @GetMapping("/summary")
    fun summary(): PaymentSummary {
        val counts = jdbcTemplate.query(
            "select status, count(*) from payments group by status",
            RowMapper { rs, _ -> rs.getString(1) to rs.getLong(2) }
        ).toMap()
        val totals = jdbcTemplate.queryForObject(
            """
            select coalesce(sum(amount) filter (where status = 'CONFIRMED'), 0),
                   coalesce(sum(amount) filter (where status = 'CANCELLED'), 0)
            from payments
            """.trimIndent(),
            RowMapper { rs, _ -> rs.getBigDecimal(1) to rs.getBigDecimal(2) }
        ) ?: (BigDecimal.ZERO to BigDecimal.ZERO)
        return PaymentSummary(counts, totals.first, totals.second)
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
