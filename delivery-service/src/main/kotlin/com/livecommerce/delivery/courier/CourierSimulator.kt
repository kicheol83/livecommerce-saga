package com.livecommerce.delivery.courier

import com.fasterxml.jackson.databind.ObjectMapper
import com.livecommerce.delivery.domain.DeliveryStatus
import com.livecommerce.delivery.webhook.CourierWebhookEvent
import com.livecommerce.delivery.webhook.WebhookProperties
import com.livecommerce.delivery.webhook.WebhookSignature
import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.http.MediaType
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Instant

@ConfigurationProperties(prefix = "courier")
data class CourierProperties(
    val enabled: Boolean,
    val stepSeconds: Long,
    val webhookUrl: String
)

private data class CourierStep(
    val status: DeliveryStatus,
    val description: String,
    val location: (CourierJob) -> String
)

@Component
class CourierSimulator(
    private val jobs: CourierJobRepository,
    private val properties: CourierProperties,
    private val webhookProperties: WebhookProperties,
    private val objectMapper: ObjectMapper,
    restClientBuilder: RestClient.Builder
) {

    private val log = LoggerFactory.getLogger(CourierSimulator::class.java)

    private val client = restClientBuilder
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(CONNECT_TIMEOUT_MS)
                setReadTimeout(READ_TIMEOUT_MS)
            }
        )
        .build()

    fun register(trackingNumber: String, address: String, recipientName: String) {
        jobs.save(
            CourierJob(
                trackingNumber = trackingNumber,
                region = regionOf(address),
                recipientName = recipientName,
                nextEventAt = Instant.now().plusSeconds(properties.stepSeconds)
            )
        )
    }

    @Scheduled(fixedDelayString = "\${courier.poll-interval-ms:1000}")
    fun deliverDueEvents() {
        if (!properties.enabled) {
            return
        }
        jobs.findTop20ByStepLessThanAndNextEventAtBeforeOrderByNextEventAtAsc(SCRIPT.size, Instant.now()).forEach { job ->
            try {
                send(job)
                job.step += 1
                job.nextEventAt = Instant.now().plusSeconds(properties.stepSeconds)
                jobs.save(job)
            } catch (ex: Exception) {
                log.warn("Courier could not deliver webhook for {}: {}", job.trackingNumber, ex.message)
            }
        }
    }

    private fun send(job: CourierJob) {
        val step = SCRIPT[job.step]
        val event = CourierWebhookEvent(
            eventId = "${job.trackingNumber}-${job.step}",
            trackingNumber = job.trackingNumber,
            status = step.status,
            location = step.location(job),
            description = step.description,
            occurredAt = Instant.now()
        )
        val body = objectMapper.writeValueAsString(event)
        val timestamp = Instant.now().epochSecond
        client.post()
            .uri(properties.webhookUrl)
            .contentType(MediaType.APPLICATION_JSON)
            .header(WebhookSignature.TIMESTAMP_HEADER, timestamp.toString())
            .header(WebhookSignature.SIGNATURE_HEADER, WebhookSignature.sign(webhookProperties.webhookSecret, timestamp, body))
            .body(body)
            .retrieve()
            .toBodilessEntity()
    }

    private fun regionOf(address: String): String {
        val first = address.trim().substringBefore(" ")
        return REGION_SUFFIXES.fold(first) { current, suffix -> current.removeSuffix(suffix) }.ifBlank { DEFAULT_REGION }.take(MAX_REGION_LENGTH)
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 2000
        private const val READ_TIMEOUT_MS = 5000
        private const val DEFAULT_REGION = "대전"
        private const val MAX_REGION_LENGTH = 30
        private val REGION_SUFFIXES = listOf("특별자치시", "특별자치도", "특별시", "광역시")
        private val SCRIPT = listOf(
            CourierStep(DeliveryStatus.SHIPPED, "집화 완료") { "성동 영업소" },
            CourierStep(DeliveryStatus.IN_TRANSIT, "간선 상차") { "곤지암 허브" },
            CourierStep(DeliveryStatus.IN_TRANSIT, "간선 하차") { "${it.region} 허브" },
            CourierStep(DeliveryStatus.OUT_FOR_DELIVERY, "배송 출발") { "${it.region} 배송 캠프" },
            CourierStep(DeliveryStatus.DELIVERED, "배송 완료, 문 앞에 두었어요") { "${it.recipientName} 님 댁" }
        )
    }
}
