package com.livecommerce.auth.api

import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.RSAKey
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class JwksController(
    private val signingKey: RSAKey
) {

    @GetMapping("/.well-known/jwks.json")
    fun jwks(): Map<String, Any> {
        return JWKSet(signingKey.toPublicJWK()).toJSONObject()
    }
}
