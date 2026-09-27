package com.livecommerce.order.admin

import org.springframework.beans.factory.annotation.Value
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.time.Instant

@Component
class AdminOrderQueries(
    private val jdbcTemplate: JdbcTemplate,
    @Value("\${saga.step-timeout-seconds:20}") private val stepTimeoutSeconds: Long
) {

    fun summary(): OrderSummary {
        val counts = jdbcTemplate.query(
            "select status, count(*) from orders group by status",
            RowMapper { rs, _ -> rs.getString(1) to rs.getLong(2) }
        ).toMap()
        val revenue = jdbcTemplate.queryForObject(
            "select coalesce(sum(amount), 0) from orders where status = 'COMPLETED'",
            BigDecimal::class.java
        ) ?: BigDecimal.ZERO
        val recent = jdbcTemplate.queryForObject(
            """
            select count(*), count(*) filter (where status = 'COMPLETED')
            from orders where created_at >= now() - interval '24 hours'
            """.trimIndent(),
            RowMapper { rs, _ -> rs.getLong(1) to rs.getLong(2) }
        ) ?: (0L to 0L)
        val stalled = jdbcTemplate.queryForObject(
            """
            select count(*) from orders
            where status in ('AWAITING_STOCK', 'PAYMENT_CONFIRMING', 'CONFIRMING_STOCK', 'COMPENSATING')
              and updated_at < now() - make_interval(secs => ?)
            """.trimIndent(),
            Long::class.javaObjectType,
            stepTimeoutSeconds
        ) ?: 0L
        val averageCompletion = jdbcTemplate.queryForObject(
            """
            select avg(extract(epoch from (updated_at - created_at)))
            from orders where status = 'COMPLETED' and created_at >= now() - interval '24 hours'
            """.trimIndent(),
            Double::class.javaObjectType
        )
        val perMinute = jdbcTemplate.query(
            """
            select extract(epoch from date_trunc('minute', created_at))::bigint,
                   count(*),
                   count(*) filter (where status = 'COMPLETED')
            from orders
            where created_at >= now() - interval '30 minutes'
            group by 1
            order by 1
            """.trimIndent(),
            RowMapper { rs, _ -> MinuteBucket(Instant.ofEpochSecond(rs.getLong(1)), rs.getLong(2), rs.getLong(3)) }
        )
        return OrderSummary(
            countsByStatus = counts,
            completedRevenue = revenue,
            ordersLast24h = recent.first,
            completedLast24h = recent.second,
            stalledOrders = stalled,
            averageCompletionSeconds = averageCompletion,
            ordersPerMinute = perMinute
        )
    }
}
