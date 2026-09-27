package com.livecommerce.delivery.courier

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository
import java.time.Instant

@Entity
@Table(name = "courier_jobs")
class CourierJob(
    @Id
    @Column(name = "tracking_number")
    val trackingNumber: String,

    @Column(nullable = false)
    val region: String,

    @Column(name = "recipient_name", nullable = false)
    val recipientName: String,

    @Column(nullable = false)
    var step: Int = 0,

    @Column(name = "next_event_at", nullable = false)
    var nextEventAt: Instant
)

interface CourierJobRepository : JpaRepository<CourierJob, String> {
    fun findTop20ByStepLessThanAndNextEventAtBeforeOrderByNextEventAtAsc(step: Int, now: Instant): List<CourierJob>
}
