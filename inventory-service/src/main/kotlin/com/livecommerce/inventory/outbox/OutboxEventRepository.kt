package com.livecommerce.inventory.outbox

import jakarta.persistence.LockModeType
import jakarta.persistence.QueryHint
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.jpa.repository.QueryHints
import java.util.UUID

interface OutboxEventRepository : JpaRepository<OutboxEventEntity, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("select o from OutboxEventEntity o where o.status = com.livecommerce.common.outbox.OutboxStatus.PENDING order by o.createdAt asc")
    fun findPendingForUpdate(pageable: Pageable): List<OutboxEventEntity>
}
