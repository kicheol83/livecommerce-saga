package com.livecommerce.order.admin

import com.livecommerce.order.domain.OrderRepository
import com.livecommerce.order.domain.OrderStatus
import com.livecommerce.order.saga.AdminIntervention
import com.livecommerce.order.saga.OrderSagaOrchestrator
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/admin/orders")
class AdminOrderController(
    private val orderRepository: OrderRepository,
    private val orchestrator: OrderSagaOrchestrator,
    private val queries: AdminOrderQueries
) {

    @GetMapping
    fun list(
        @RequestParam(required = false) status: OrderStatus?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): AdminPage<AdminOrderView> {
        val pageable = PageRequest.of(page.coerceAtLeast(0), size.coerceIn(1, MAX_PAGE_SIZE), Sort.by(Sort.Direction.DESC, "updatedAt"))
        val result = if (status == null) orderRepository.findAll(pageable) else orderRepository.findAllByStatus(status, pageable)
        return AdminPage(
            items = result.content.map { AdminOrderView.from(it) },
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages
        )
    }

    @GetMapping("/summary")
    fun summary(): OrderSummary {
        return queries.summary()
    }

    @GetMapping("/{orderId}")
    fun detail(@PathVariable orderId: UUID): ResponseEntity<AdminOrderView> {
        val order = orderRepository.findById(orderId).orElse(null) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(AdminOrderView.from(order))
    }

    @PostMapping("/{orderId}/retry")
    fun retry(@PathVariable orderId: UUID): ResponseEntity<Any> {
        return respond(orchestrator.retryNow(orderId), "NOT_RETRYABLE", "Order has no saga step to retry")
    }

    @PostMapping("/{orderId}/cancel")
    fun cancel(@PathVariable orderId: UUID): ResponseEntity<Any> {
        return respond(orchestrator.cancelByAdmin(orderId), "NOT_CANCELLABLE", "Only orders that are not paid yet can be cancelled")
    }

    private fun respond(result: AdminIntervention, conflictCode: String, conflictMessage: String): ResponseEntity<Any> {
        return when (result) {
            is AdminIntervention.Applied -> ResponseEntity.status(HttpStatus.ACCEPTED).body(AdminOrderView.from(result.order))
            AdminIntervention.NotFound -> ResponseEntity.notFound().build()
            AdminIntervention.NotApplicable -> ResponseEntity.status(HttpStatus.CONFLICT).body(AdminErrorResponse(conflictCode, conflictMessage))
        }
    }

    companion object {
        private const val MAX_PAGE_SIZE = 100
    }
}
