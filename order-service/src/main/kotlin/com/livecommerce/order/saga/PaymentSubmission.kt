package com.livecommerce.order.saga

import com.livecommerce.order.domain.Order

sealed interface PaymentSubmission {
    data class Accepted(val order: Order) : PaymentSubmission
    data object NotFound : PaymentSubmission
    data object NotPayable : PaymentSubmission
    data object AmountMismatch : PaymentSubmission
    data object WindowExpired : PaymentSubmission
}

sealed interface BuyerCancellation {
    data class Cancelled(val order: Order) : BuyerCancellation
    data object NotFound : BuyerCancellation
    data object NotCancellable : BuyerCancellation
}
