package com.livecommerce.gateway.ratelimit

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import java.net.InetSocketAddress

class ClientAddressTest {

    private val edgeProxy = InetSocketAddress("172.18.0.5", 40000)

    @Test
    fun `takes the client address the trusted proxies appended, not one the client sent`() {
        val request = MockServerHttpRequest.post("/api/auth/login")
            .header("X-Forwarded-For", "9.9.9.9, 203.0.113.7, 172.18.0.2")
            .remoteAddress(edgeProxy)
            .build()

        assertThat(ClientAddress.resolve(request)).isEqualTo("203.0.113.7")
    }

    @Test
    fun `has no public client address for requests from inside the network`() {
        val request = MockServerHttpRequest.post("/api/auth/login")
            .remoteAddress(InetSocketAddress("127.0.0.1", 50000))
            .build()

        assertThat(ClientAddress.resolve(request)).isNull()
    }

    @Test
    fun `uses the socket address when no proxy is involved`() {
        val request = MockServerHttpRequest.post("/api/auth/login")
            .remoteAddress(InetSocketAddress("198.51.100.20", 50000))
            .build()

        assertThat(ClientAddress.resolve(request)).isEqualTo("198.51.100.20")
    }

    @Test
    fun `treats private, loopback, link-local and unique-local addresses as internal`() {
        listOf("10.1.2.3", "172.16.0.1", "192.168.1.1", "127.0.0.1", "169.254.169.254", "::1", "fd00::1", "fe80::1")
            .forEach { assertThat(ClientAddress.isPublic(it)).describedAs(it).isFalse() }
        assertThat(ClientAddress.isPublic("2001:4860:4860::8888")).isTrue()
    }

    @Test
    fun `never resolves host names found in the header`() {
        assertThat(ClientAddress.isPublic("bad.cafe")).isFalse()
        assertThat(ClientAddress.isPublic("localhost")).isFalse()
        assertThat(ClientAddress.isPublic("999.1.1.1")).isFalse()
    }
}
