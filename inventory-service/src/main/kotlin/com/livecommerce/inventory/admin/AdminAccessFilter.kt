package com.livecommerce.inventory.admin

import com.livecommerce.common.identity.IdentityHeaders
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class AdminAccessFilter : OncePerRequestFilter() {

    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        return !request.requestURI.startsWith(ADMIN_PREFIX)
    }

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, filterChain: FilterChain) {
        val roles = request.getHeader(IdentityHeaders.USER_ROLES)?.split(",")?.map { it.trim() } ?: emptyList()
        if (IdentityHeaders.ADMIN_ROLE !in roles) {
            response.status = HttpStatus.FORBIDDEN.value()
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.writer.write("""{"code":"ADMIN_ONLY","message":"Administrator role required"}""")
            return
        }
        filterChain.doFilter(request, response)
    }

    companion object {
        private const val ADMIN_PREFIX = "/api/admin/"
    }
}
