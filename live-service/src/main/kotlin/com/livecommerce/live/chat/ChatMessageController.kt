package com.livecommerce.live.chat

import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller

data class ChatMessageRequest(
    val author: String = "",
    val text: String = ""
)

@Controller
class ChatMessageController(
    private val chatService: ChatService
) {

    @MessageMapping("/live/chat")
    fun chat(request: ChatMessageRequest) {
        chatService.post(request.author, request.text)
    }
}
