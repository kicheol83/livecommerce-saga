package com.livecommerce.gateway.config

import com.livecommerce.common.identity.IdentityHeaders
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity
import org.springframework.security.config.web.server.ServerHttpSecurity
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter
import org.springframework.security.web.server.SecurityWebFilterChain

@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

    @Bean
    fun securityWebFilterChain(http: ServerHttpSecurity): SecurityWebFilterChain {
        return http
            .csrf { it.disable() }
            .httpBasic { it.disable() }
            .formLogin { it.disable() }
            .authorizeExchange {
                it.pathMatchers("/api/auth/**", "/actuator/health", "/ws/**").permitAll()
                it.pathMatchers(HttpMethod.GET, "/api/live/**").permitAll()
                it.pathMatchers("/api/admin/**").hasRole(IdentityHeaders.ADMIN_ROLE)
                it.pathMatchers(HttpMethod.POST, "/api/deliveries/webhooks/**").permitAll()
                it.pathMatchers("/api/orders/**", "/api/deliveries/**").authenticated()
                it.anyExchange().denyAll()
            }
            .oauth2ResourceServer { resourceServer ->
                resourceServer.jwt { it.jwtAuthenticationConverter(jwtAuthenticationConverter()) }
            }
            .build()
    }

    private fun jwtAuthenticationConverter(): ReactiveJwtAuthenticationConverterAdapter {
        val authorities = JwtGrantedAuthoritiesConverter()
        authorities.setAuthoritiesClaimName(ROLES_CLAIM)
        authorities.setAuthorityPrefix(ROLE_PREFIX)
        val converter = JwtAuthenticationConverter()
        converter.setJwtGrantedAuthoritiesConverter(authorities)
        return ReactiveJwtAuthenticationConverterAdapter(converter)
    }

    companion object {
        const val ROLES_CLAIM = "roles"
        const val ROLE_PREFIX = "ROLE_"
    }
}
