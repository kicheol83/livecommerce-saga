package com.livecommerce.live

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
class LiveServiceApplication

fun main(args: Array<String>) {
    runApplication<LiveServiceApplication>(*args)
}
