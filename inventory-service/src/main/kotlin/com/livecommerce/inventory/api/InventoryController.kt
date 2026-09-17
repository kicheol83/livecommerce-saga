package com.livecommerce.inventory.api

import com.livecommerce.inventory.api.dto.ReserveInventoryRequest
import com.livecommerce.inventory.service.InventoryService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/inventory")
class InventoryController(
    private val inventoryService: InventoryService
) {

    @PostMapping("/reserve")
    fun reserve(@RequestBody request: ReserveInventoryRequest): ResponseEntity<Void> {
        inventoryService.reserve(request.orderId, request.productId, request.quantity)
        return ResponseEntity.status(HttpStatus.ACCEPTED).build()
    }
}
