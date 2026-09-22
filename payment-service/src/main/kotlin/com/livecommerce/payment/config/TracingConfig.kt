package com.livecommerce.payment.config

import io.micrometer.observation.ObservationPredicate
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class TracingConfig {

    @Bean
    fun skipScheduledTaskObservations(): ObservationPredicate {
        return ObservationPredicate { name, _ -> name != "tasks.scheduled.execution" }
    }
}
