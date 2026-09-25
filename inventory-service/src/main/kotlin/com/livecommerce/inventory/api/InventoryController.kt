package com.livecommerce.inventory.api

import com.livecommerce.inventory.api.dto.ConfirmInventoryRequest
import com.livecommerce.inventory.api.dto.ProductStockResponse
import com.livecommerce.inventory.api.dto.ReleaseInventoryRequest
import com.livecommerce.inventory.api.dto.ReserveInventoryRequest
import com.livecommerce.inventory.service.InventoryService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/inventory")
class InventoryController(
    private val inventoryService: InventoryService
) {

    @GetMapping("/products/{productId}")
    fun product(@PathVariable productId: UUID): ResponseEntity<ProductStockResponse> {
        val product = inventoryService.findProduct(productId) ?: return ResponseEntity.notFound().build()
        return ResponseEntity.ok(ProductStockResponse(product.productId, product.quantityAvailable, product.unitPrice))
    }

    @PostMapping("/reserve")
    fun reserve(@RequestBody request: ReserveInventoryRequest): ResponseEntity<Void> {
        inventoryService.reserve(request.orderId, request.productId, request.quantity)
        return ResponseEntity.status(HttpStatus.ACCEPTED).build()
    }

    @PostMapping("/confirm")
    fun confirm(@RequestBody request: ConfirmInventoryRequest): ResponseEntity<Void> {
        inventoryService.confirm(request.orderId)
        return ResponseEntity.status(HttpStatus.ACCEPTED).build()
    }

    @PostMapping("/release")
    fun release(@RequestBody request: ReleaseInventoryRequest): ResponseEntity<Void> {
        inventoryService.release(request.orderId)
        return ResponseEntity.status(HttpStatus.ACCEPTED).build()
    }
}
