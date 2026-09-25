package com.livecommerce.payment

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
class PaymentServiceApplication

fun main(args: Array<String>) {
    runApplication<PaymentServiceApplication>(*args)
}
