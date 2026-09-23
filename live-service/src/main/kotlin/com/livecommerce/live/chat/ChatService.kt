package com.livecommerce.live.chat

import com.livecommerce.live.config.LiveTopics
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedDeque

data class ChatMessage(
    val id: String,
    val author: String,
    val text: String,
    val sentAt: Instant
)

@Service
class ChatService(
    private val messagingTemplate: SimpMessagingTemplate
) {

    private val recentMessages = ConcurrentLinkedDeque<ChatMessage>()

    fun post(author: String, text: String): ChatMessage? {
        val cleanText = text.trim().take(MAX_TEXT_LENGTH)
        if (cleanText.isEmpty()) {
            return null
        }
        val cleanAuthor = author.trim().take(MAX_AUTHOR_LENGTH).ifBlank { ANONYMOUS_AUTHOR }
        val message = ChatMessage(UUID.randomUUID().toString(), cleanAuthor, cleanText, Instant.now())
        recentMessages.addLast(message)
        while (recentMessages.size > HISTORY_SIZE) {
            recentMessages.pollFirst()
        }
        messagingTemplate.convertAndSend(LiveTopics.CHAT, message)
        return message
    }

    fun history(): List<ChatMessage> {
        return recentMessages.toList()
    }

    companion object {
        private const val MAX_TEXT_LENGTH = 200
        private const val MAX_AUTHOR_LENGTH = 20
        private const val HISTORY_SIZE = 50
        private const val ANONYMOUS_AUTHOR = "익명"
    }
}
