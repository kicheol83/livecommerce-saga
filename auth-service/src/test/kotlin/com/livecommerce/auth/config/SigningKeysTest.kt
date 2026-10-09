package com.livecommerce.auth.config

import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.source.ImmutableJWKSet
import com.nimbusds.jose.proc.SecurityContext
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import java.security.KeyPairGenerator
import java.util.Base64

class SigningKeysTest {

    private val pem: String = run {
        val generator = KeyPairGenerator.getInstance("RSA")
        generator.initialize(2048)
        val der = generator.generateKeyPair().private.encoded
        "-----BEGIN PRIVATE KEY-----\n" + Base64.getMimeEncoder(64, "\n".toByteArray()).encodeToString(der) + "\n-----END PRIVATE KEY-----\n"
    }

    @Test
    fun `the same configured key gives the same key id after every restart`() {
        val first = SigningKeys.load(pem)
        val second = SigningKeys.load(pem)

        assertThat(first.keyID).isNotBlank()
        assertThat(second.keyID).isEqualTo(first.keyID)
        assertThat(second.toRSAPublicKey()).isEqualTo(first.toRSAPublicKey())
    }

    @Test
    fun `a token signed before a restart still verifies after it`() {
        val beforeRestart = SigningKeys.load(pem)
        val encoder = NimbusJwtEncoder(ImmutableJWKSet<SecurityContext>(JWKSet(beforeRestart)))
        val token = encoder.encode(JwtEncoderParameters.from(JwtClaimsSet.builder().subject("buyer-1").build())).tokenValue

        val afterRestart = SigningKeys.load(pem)
        val decoded = NimbusJwtDecoder.withPublicKey(afterRestart.toRSAPublicKey()).build().decode(token)

        assertThat(decoded.subject).isEqualTo("buyer-1")
    }

    @Test
    fun `accepts the PEM base64-encoded on one line, as it is stored in an env file`() {
        val oneLine = Base64.getEncoder().encodeToString(pem.toByteArray())

        assertThat(SigningKeys.load(oneLine).keyID).isEqualTo(SigningKeys.load(pem).keyID)
    }

    @Test
    fun `generated keys differ from each other`() {
        assertThat(SigningKeys.generate().keyID).isNotEqualTo(SigningKeys.generate().keyID)
    }

    @Test
    fun `rejects a value that is not a private key`() {
        assertThatThrownBy { SigningKeys.load(Base64.getEncoder().encodeToString("hello".toByteArray())) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }
}
