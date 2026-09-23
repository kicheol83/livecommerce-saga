package com.livecommerce.order.client

import org.springframework.http.client.ClientHttpRequestFactory
import org.springframework.http.client.SimpleClientHttpRequestFactory

private const val CONNECT_TIMEOUT_MS = 2000
private const val READ_TIMEOUT_MS = 5000

internal fun timeoutRequestFactory(): ClientHttpRequestFactory {
    return SimpleClientHttpRequestFactory().apply {
        setConnectTimeout(CONNECT_TIMEOUT_MS)
        setReadTimeout(READ_TIMEOUT_MS)
    }
}
