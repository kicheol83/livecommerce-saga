package com.livecommerce.inventory.service

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class HoldExpiryScheduler(
    private val inventoryService: InventoryService
) {

    private val log = LoggerFactory.getLogger(HoldExpiryScheduler::class.java)

    @Scheduled(fixedDelayString = "\${inventory.hold-sweep-interval-ms:5000}")
    fun expireAbandonedHolds() {
        val expired = inventoryService.expireHolds()
        if (expired > 0) {
            log.info("Returned {} expired stock holds to inventory", expired)
        }
    }
}
