package com.livecommerce.gateway.ratelimit

import org.springframework.http.server.reactive.ServerHttpRequest
import java.net.Inet6Address
import java.net.InetAddress

object ClientAddress {

    private const val FORWARDED_FOR = "X-Forwarded-For"
    private val IPV4 = Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")
    private val IPV6 = Regex("^[0-9a-fA-F:.]*:[0-9a-fA-F:.]*$")
    private const val MAX_OCTET = 255

    fun resolve(request: ServerHttpRequest): String? {
        val forwarded = request.headers[FORWARDED_FOR].orEmpty()
            .flatMap { it.split(',') }
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        val chain = forwarded + listOfNotNull(request.remoteAddress?.address?.hostAddress)
        return chain.asReversed().firstOrNull { isPublic(it) }
    }

    fun isPublic(value: String): Boolean {
        val literal = (IPV4.matches(value) && value.split('.').all { it.toInt() <= MAX_OCTET }) || IPV6.matches(value)
        if (!literal) {
            return false
        }
        val address = runCatching { InetAddress.getByName(value) }.getOrNull() ?: return false
        if (address.isLoopbackAddress || address.isSiteLocalAddress || address.isLinkLocalAddress ||
            address.isAnyLocalAddress || address.isMulticastAddress
        ) {
            return false
        }
        if (address is Inet6Address && (address.address[0].toInt() and 0xfe) == 0xfc) {
            return false
        }
        return true
    }
}
