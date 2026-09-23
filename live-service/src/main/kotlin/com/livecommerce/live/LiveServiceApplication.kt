package com.livecommerce.live

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class LiveServiceApplication

fun main(args: Array<String>) {
    runApplication<LiveServiceApplication>(*args)
}
