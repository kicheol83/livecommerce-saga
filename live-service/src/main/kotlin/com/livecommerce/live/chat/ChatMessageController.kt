package com.livecommerce.live.chat

import com.livecommerce.live.auth.LiveUser
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.simp.SimpMessageHeaderAccessor
import org.springframework.stereotype.Controller

data class ChatMessageRequest(
    val text: String = ""
)

@Controller
class ChatMessageController(
    private val chatService: ChatService
) {

    @MessageMapping("/live/chat")
    fun chat(request: ChatMessageRequest, headers: SimpMessageHeaderAccessor) {
        val user = headers.user as? LiveUser ?: return
        chatService.post(user.nickname, request.text)
    }
}
