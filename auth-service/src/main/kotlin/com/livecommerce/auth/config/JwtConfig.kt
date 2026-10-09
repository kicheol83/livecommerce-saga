package com.livecommerce.auth.config

import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import com.nimbusds.jose.jwk.source.ImmutableJWKSet
import com.nimbusds.jose.proc.SecurityContext
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.crypto.factory.PasswordEncoderFactories
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder

@Configuration
class JwtConfig {

    private val log = LoggerFactory.getLogger(JwtConfig::class.java)

    @Bean
    fun signingKey(properties: AuthProperties): RSAKey {
        if (properties.signingKey.isNotBlank()) {
            return SigningKeys.load(properties.signingKey)
        }
        log.warn("auth.signing-key is not set; using a temporary key, so issued tokens stop working when this service restarts")
        return SigningKeys.generate()
    }

    @Bean
    fun jwtEncoder(signingKey: RSAKey): JwtEncoder {
        return NimbusJwtEncoder(ImmutableJWKSet<SecurityContext>(JWKSet(signingKey)))
    }

    @Bean
    fun jwtDecoder(signingKey: RSAKey): JwtDecoder {
        return NimbusJwtDecoder.withPublicKey(signingKey.toRSAPublicKey()).build()
    }

    @Bean
    fun passwordEncoder(): PasswordEncoder {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder()
    }
}
