package com.livecommerce.inventory

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class InventoryServiceApplication

fun main(args: Array<String>) {
    runApplication<InventoryServiceApplication>(*args)
}
