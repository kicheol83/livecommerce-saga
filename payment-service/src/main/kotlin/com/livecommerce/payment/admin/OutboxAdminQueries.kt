package com.livecommerce.payment.admin

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

data class OutboxEventView(
    val id: UUID,
    val aggregateId: UUID,
    val eventType: String,
    val topic: String,
    val status: String,
    val attempts: Int,
    val lastError: String?,
    val traceParent: String?,
    val createdAt: Instant
)

data class OutboxHealth(
    val pending: Long,
    val oldestPendingAgeSeconds: Long?,
    val pendingWithErrors: Long,
    val publishedLastHour: Long,
    val recentErrors: List<OutboxEventView>
)

@Component
class OutboxAdminQueries(
    private val jdbcTemplate: JdbcTemplate
) {

    private val mapper = RowMapper { rs, _ -> toView(rs) }

    fun eventsFor(aggregateId: UUID): List<OutboxEventView> {
        return jdbcTemplate.query(
            "$SELECT_COLUMNS where aggregate_id = ? order by created_at asc",
            mapper,
            aggregateId
        )
    }

    fun health(): OutboxHealth {
        val totals = jdbcTemplate.queryForObject(
            """
            select count(*) filter (where status = 'PENDING'),
                   extract(epoch from now() - min(created_at) filter (where status = 'PENDING'))::bigint,
                   count(*) filter (where status = 'PENDING' and attempts > 0),
                   count(*) filter (where status = 'PUBLISHED' and created_at >= now() - interval '1 hour')
            from outbox_events
            """.trimIndent(),
            RowMapper { rs, _ ->
                val oldest = rs.getLong(2)
                OutboxHealth(
                    pending = rs.getLong(1),
                    oldestPendingAgeSeconds = if (rs.wasNull()) null else oldest,
                    pendingWithErrors = rs.getLong(3),
                    publishedLastHour = rs.getLong(4),
                    recentErrors = emptyList()
                )
            }
        ) ?: OutboxHealth(0, null, 0, 0, emptyList())
        val recentErrors = jdbcTemplate.query(
            "$SELECT_COLUMNS where last_error is not null order by created_at desc limit $RECENT_ERROR_LIMIT",
            mapper
        )
        return totals.copy(recentErrors = recentErrors)
    }

    private fun toView(rs: ResultSet): OutboxEventView {
        return OutboxEventView(
            id = rs.getObject("id", UUID::class.java),
            aggregateId = rs.getObject("aggregate_id", UUID::class.java),
            eventType = rs.getString("event_type"),
            topic = rs.getString("topic"),
            status = rs.getString("status"),
            attempts = rs.getInt("attempts"),
            lastError = rs.getString("last_error"),
            traceParent = rs.getString("trace_parent"),
            createdAt = rs.getTimestamp("created_at").toInstant()
        )
    }

    companion object {
        private const val SELECT_COLUMNS =
            "select id, aggregate_id, event_type, topic, status, attempts, last_error, trace_parent, created_at from outbox_events"
        private const val RECENT_ERROR_LIMIT = 10
    }
}
