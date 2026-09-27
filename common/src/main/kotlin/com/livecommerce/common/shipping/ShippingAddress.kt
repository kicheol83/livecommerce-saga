package com.livecommerce.common.shipping

data class ShippingAddress(
    val recipientName: String = "",
    val phone: String = "",
    val zipCode: String = "",
    val address1: String = "",
    val address2: String? = null
) {
    fun normalized(): ShippingAddress {
        return ShippingAddress(
            recipientName = recipientName.trim(),
            phone = phone.trim(),
            zipCode = zipCode.trim(),
            address1 = address1.trim(),
            address2 = address2?.trim()?.ifBlank { null }
        )
    }

    fun violations(): Map<String, String> {
        val violations = mutableMapOf<String, String>()
        if (recipientName.isBlank() || recipientName.length > MAX_NAME_LENGTH) {
            violations["recipientName"] = "must be 1 to $MAX_NAME_LENGTH characters"
        }
        if (!PHONE_PATTERN.matches(phone)) {
            violations["phone"] = "must be a Korean phone number such as 010-1234-5678"
        }
        if (!ZIP_PATTERN.matches(zipCode)) {
            violations["zipCode"] = "must be a 5 digit postal code"
        }
        if (address1.isBlank() || address1.length > MAX_ADDRESS_LENGTH) {
            violations["address1"] = "must be 1 to $MAX_ADDRESS_LENGTH characters"
        }
        if ((address2?.length ?: 0) > MAX_DETAIL_LENGTH) {
            violations["address2"] = "must be at most $MAX_DETAIL_LENGTH characters"
        }
        return violations
    }

    companion object {
        private const val MAX_NAME_LENGTH = 30
        private const val MAX_ADDRESS_LENGTH = 200
        private const val MAX_DETAIL_LENGTH = 100
        private val PHONE_PATTERN = Regex("^0\\d{1,2}-?\\d{3,4}-?\\d{4}$")
        private val ZIP_PATTERN = Regex("^\\d{5}$")
    }
}
