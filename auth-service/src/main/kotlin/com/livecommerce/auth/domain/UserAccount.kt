package com.livecommerce.auth.domain

import com.livecommerce.common.shipping.ShippingAddress
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "users")
class UserAccount(
    @Id
    val id: UUID,

    @Column(nullable = false, unique = true)
    val email: String,

    @Column(name = "password_hash", nullable = false)
    var passwordHash: String,

    @Column(nullable = false, unique = true)
    var nickname: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    val role: UserRole,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "shipping_recipient")
    var shippingRecipient: String? = null,

    @Column(name = "shipping_phone")
    var shippingPhone: String? = null,

    @Column(name = "shipping_zip_code")
    var shippingZipCode: String? = null,

    @Column(name = "shipping_address1")
    var shippingAddress1: String? = null,

    @Column(name = "shipping_address2")
    var shippingAddress2: String? = null
) {
    fun shippingAddress(): ShippingAddress? {
        val recipient = shippingRecipient ?: return null
        val phone = shippingPhone ?: return null
        val zipCode = shippingZipCode ?: return null
        val address1 = shippingAddress1 ?: return null
        return ShippingAddress(recipient, phone, zipCode, address1, shippingAddress2)
    }

    fun changeShippingAddress(address: ShippingAddress) {
        shippingRecipient = address.recipientName
        shippingPhone = address.phone
        shippingZipCode = address.zipCode
        shippingAddress1 = address.address1
        shippingAddress2 = address.address2
    }

    fun roles(): List<String> {
        return if (role == UserRole.ADMIN) listOf(UserRole.USER.name, UserRole.ADMIN.name) else listOf(UserRole.USER.name)
    }
}
